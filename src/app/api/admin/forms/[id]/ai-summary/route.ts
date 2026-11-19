// GET  /api/admin/forms/[id]/ai-summary  — load last saved AI analysis for this form
// POST /api/admin/forms/[id]/ai-summary  — run Gemini AI to analyze & organize form comments and results

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { checkCombinedRateLimitAsync, getRateLimitHeaders } from '@/lib/rate-limit';
import { secureJsonResponse } from '@/lib/payload-crypto';
import {
  CHOICE_QUESTION_TYPES,
  formatAnswer,
  otherAnswerKey,
  summarizeForm,
  type FormDefinition,
  type FormResponse,
} from '@/lib/forms';
import {
  getFormAiAnalysis,
  getFormDefinition,
  listResponses,
  saveFormAiAnalysis,
} from '@/lib/forms-server';
import type {
  FormAiAnalysis,
  FormAiOrganizedComment,
  FormAiSentiment,
  FormAiTheme,
  FormAiThemeSentiment,
} from '@/lib/form-ai-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

const MAX_COMMENTS_FOR_AI = 160;
const MAX_COMMENT_CHARS = 500;

interface ExtractedComment {
  index: number;
  questionTitle: string;
  originalText: string;
  choiceContext?: string;
}

const NOISE_COMMENT_RE = /^[-–—._/\\*•\s]+$/;

function isMeaningfulComment(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 2) return false;
  if (NOISE_COMMENT_RE.test(cleaned)) return false;
  if (/^(ไม่มี|ไม่มีครับ|ไม่มีค่ะ|ไม่|none|n\/a|na|-)$/i.test(cleaned)) return false;
  return true;
}

/** Extract anonymized text responses with choice context — never includes respondent name/email (PDPA-safe). */
function extractAnonymizedComments(form: FormDefinition, responses: FormResponse[]): ExtractedComment[] {
  const choiceQuestions = form.questions.filter((q) => CHOICE_QUESTION_TYPES.includes(q.type));
  const textQuestions = form.questions.filter((q) => q.type === 'short_text' || q.type === 'long_text');
  const extracted: ExtractedComment[] = [];

  for (const r of responses) {
    const choiceParts = choiceQuestions
      .map((cq) => formatAnswer(cq, r.answers?.[cq.id], r.answers?.[otherAnswerKey(cq.id)], r.answers))
      .filter(Boolean);
    const choiceContext = choiceParts.length > 0 ? choiceParts.join(' | ').slice(0, 140) : undefined;

    for (const tq of textQuestions) {
      const val = String(r.answers?.[tq.id] ?? '').trim();
      if (!isMeaningfulComment(val)) continue;
      extracted.push({
        index: extracted.length + 1,
        questionTitle: tq.title,
        originalText: val.slice(0, MAX_COMMENT_CHARS),
        choiceContext,
      });
    }

    // Also include "อื่นๆ (โปรดระบุ)" free-text answers from choice questions
    for (const cq of choiceQuestions) {
      const otherText = String(r.answers?.[otherAnswerKey(cq.id)] ?? '').trim();
      if (!isMeaningfulComment(otherText)) continue;
      extracted.push({
        index: extracted.length + 1,
        questionTitle: `${cq.title} (ระบุเพิ่มเติม)`,
        originalText: otherText.slice(0, MAX_COMMENT_CHARS),
        choiceContext,
      });
    }
  }

  return extracted;
}

function buildVoteSummaryBlock(form: FormDefinition, responses: FormResponse[]): string {
  const summary = summarizeForm(form, responses, false);
  const lines: string[] = [
    `หัวข้อแบบสำรวจ: ${form.title}`,
    ...(form.description ? [`รายละเอียด: ${form.description.slice(0, 600)}`] : []),
    `จำนวนผู้ตอบทั้งหมด: ${summary.totalResponses} คน`,
    '',
    'สรุปผลคะแนนแต่ละข้อ:',
  ];

  for (const q of form.questions) {
    const qs = summary.questions.find((x) => x.questionId === q.id);
    if (!qs) continue;
    if (CHOICE_QUESTION_TYPES.includes(q.type) && qs.counts) {
      lines.push(`- ${q.title} (ตอบ ${qs.answered} คน):`);
      for (const opt of q.options || []) {
        const c = qs.counts[opt.id] || 0;
        const p = qs.answered > 0 ? ((c / qs.answered) * 100).toFixed(1) : '0.0';
        lines.push(`    • ${opt.label}: ${c} คน (${p}%)`);
      }
    } else if (q.type === 'rating') {
      lines.push(`- ${q.title} (ตอบ ${qs.answered} คน): คะแนนเฉลี่ย ${qs.average ?? 0}/5`);
    }
  }

  return lines.join('\n');
}

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    executiveSummary: {
      type: 'string',
      description: 'สรุปภาพรวม 2-4 ประโยค ภาษาไทยทางการ ชัดเจน กระชับ เหมาะนำไปใช้นำเสนอ',
    },
    sentiment: {
      type: 'object',
      properties: {
        positive: { type: 'integer', description: 'ร้อยละความคิดเห็นเชิงสนับสนุน/บวก (0-100)' },
        neutral: { type: 'integer', description: 'ร้อยละความคิดเห็นเป็นกลาง/ข้อเสนอแนะทั่วไป (0-100)' },
        negative: { type: 'integer', description: 'ร้อยละข้อกังวล/ไม่เห็นด้วย (0-100)' },
      },
      required: ['positive', 'neutral', 'negative'],
    },
    themes: {
      type: 'array',
      description: 'จัดกลุ่มประเด็นสำคัญจากความคิดเห็น 3-6 หมวดหมู่ เรียงจากประเด็นที่มีผู้กล่าวถึงมากที่สุด',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'ชื่อหมวดหมู่ประเด็นสั้นกระชับภาษาไทย' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
          count: { type: 'integer', description: 'จำนวนความคิดเห็นโดยประมาณที่กล่าวถึงประเด็นนี้' },
          summary: { type: 'string', description: 'สรุปใจความสำคัญของหมวดหมู่นี้ 1-2 ประโยค' },
          quotes: {
            type: 'array',
            items: { type: 'string' },
            description: 'ตัวอย่างข้อความจริงจากผู้ตอบ 1-3 ประโยค (ห้ามแต่งขึ้นเอง)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'คำสำคัญสั้นๆ 2-4 คำ',
          },
        },
        required: ['title', 'sentiment', 'count', 'summary', 'quotes', 'tags'],
      },
    },
    highlights: {
      type: 'object',
      properties: {
        supporting: {
          type: 'array',
          items: { type: 'string' },
          description: 'เหตุผลสนับสนุนหลักที่พบบ่อย 2-5 ข้อ',
        },
        concerns: {
          type: 'array',
          items: { type: 'string' },
          description: 'ข้อกังวลหรือเหตุผลที่ไม่เห็นด้วย (ถ้าไม่มีให้ส่งอาร์เรย์ว่าง)',
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'ข้อเสนอแนะเชิงสร้างสรรค์ เช่น ดีไซน์ เนื้อผ้า ราคา การจัดทำ (ถ้าไม่มีให้ส่งอาร์เรย์ว่าง)',
        },
      },
      required: ['supporting', 'concerns', 'suggestions'],
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: 'ข้อเสนอแนะเชิงปฏิบัติสำหรับคณะทำงาน/การยื่นเรื่องต่อ 3-5 ข้อ',
    },
    formalDraft: {
      type: 'string',
      description: 'ร่างย่อหน้าบทสรุปผลสำรวจภาษาไทยทางการ 1-2 ย่อหน้า ไม่มีอีโมจิ เหมาะสำหรับคัดลอกแนบเอกสารเสนอพิจารณา',
    },
    commentClassifications: {
      type: 'array',
      description: 'จัดหมวดหมู่ความคิดเห็นแต่ละข้อตามหมายเลข #index ที่ส่งให้',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'หมายเลข #index ของความคิดเห็นต้นฉบับ' },
          category: { type: 'string', description: 'ชื่อหมวดหมู่สั้นๆ ที่สอดคล้องกับ themes' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          shortSummary: { type: 'string', description: 'สรุปสั้น 1 บรรทัดไม่เกิน 90 ตัวอักษร' },
        },
        required: ['index', 'category', 'sentiment', 'shortSummary'],
      },
    },
  },
  required: [
    'executiveSummary',
    'sentiment',
    'themes',
    'highlights',
    'recommendations',
    'formalDraft',
    'commentClassifications',
  ],
};

function extractInteractionOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as {
    output_text?: unknown;
    steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    outputs?: Array<{ type?: string; text?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
    return obj.output_text.trim();
  }

  if (Array.isArray(obj.steps)) {
    for (let i = obj.steps.length - 1; i >= 0; i--) {
      const step = obj.steps[i];
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        const joined = step.content
          .filter((c) => c?.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text as string)
          .join('')
          .trim();
        if (joined) return joined;
      }
    }
  }

  if (Array.isArray(obj.outputs)) {
    const joined = obj.outputs
      .map((o) => {
        if (typeof o?.text === 'string') return o.text;
        if (Array.isArray(o?.content)) {
          return o.content.filter((c) => typeof c?.text === 'string').map((c) => c.text).join('');
        }
        return '';
      })
      .join('')
      .trim();
    if (joined) return joined;
  }

  return null;
}

async function callGeminiInteractions(
  apiKey: string,
  systemInstruction: string,
  inputPrompt: string,
): Promise<{ text: string; model: string }> {
  let lastError = 'ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้';

  for (const model of GEMINI_MODEL_CHAIN) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch(GEMINI_INTERACTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          store: false,
          system_instruction: systemInstruction,
          input: inputPrompt,
          generation_config: {
            temperature: 0.25,
            max_output_tokens: 4096,
          },
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: RESPONSE_JSON_SCHEMA,
          },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const text = extractInteractionOutputText(json);
        if (text) {
          return { text, model };
        }
        lastError = `โมเดล ${model} ไม่ได้ส่งข้อมูลสรุปกลับมา`;
        continue;
      }

      const errText = await response.text().catch(() => '');
      console.warn(`[forms/ai-summary] model=${model} HTTP ${response.status}: ${errText.slice(0, 240)}`);
      lastError = `HTTP ${response.status}`;

      // Retry next model on transient capacity/rate/model issues
      if ([404, 408, 429, 500, 502, 503, 504].includes(response.status)) {
        continue;
      }
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[forms/ai-summary] model=${model} exception: ${msg}`);
      lastError = msg;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(lastError);
}

function clampSentiment(raw: unknown): { positive: number; neutral: number; negative: number } {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pos = Math.max(0, Math.round(Number(s.positive) || 0));
  const neu = Math.max(0, Math.round(Number(s.neutral) || 0));
  const neg = Math.max(0, Math.round(Number(s.negative) || 0));
  const total = pos + neu + neg;
  if (total <= 0) return { positive: 0, neutral: 100, negative: 0 };
  const p = Math.round((pos / total) * 100);
  const n = Math.round((neg / total) * 100);
  const m = Math.max(0, 100 - p - n);
  return { positive: p, neutral: m, negative: n };
}

function asSentiment(v: unknown): FormAiSentiment {
  return v === 'positive' || v === 'negative' ? v : 'neutral';
}

function asThemeSentiment(v: unknown): FormAiThemeSentiment {
  return v === 'positive' || v === 'negative' || v === 'mixed' ? v : 'neutral';
}

function cleanStringList(arr: unknown, maxItems = 8): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const admin = await requireAdminWithPermission('canManageEvents', request);
  if (admin instanceof NextResponse) return admin;
  try {
    const { id } = await params;
    const analysis = await getFormAiAnalysis(id);
    return await secureJsonResponse({
      status: 'success',
      analysis,
      aiEnabled: Boolean(process.env.GEMINI_API_KEY),
    });
  } catch (error) {
    console.error('[admin/forms/:id/ai-summary] GET', error);
    return await secureJsonResponse({ status: 'error', message: 'โหลดผลวิเคราะห์ AI ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const rateLimit = await checkCombinedRateLimitAsync(request, {
    maxRequests: 10,
    windowSeconds: 60,
    prefix: 'form-ai-summary',
  });
  if (!rateLimit.allowed) {
    return await secureJsonResponse(
      { status: 'error', message: 'เรียกใช้งาน AI ถี่เกินไป กรุณารอสักครู่' },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  const admin = await requireAdminWithPermission('canManageEvents', request);
  if (admin instanceof NextResponse) return admin;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return await secureJsonResponse(
      { status: 'error', message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์' },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const form = await getFormDefinition(id);
    if (!form) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่พบแบบฟอร์ม' }, { status: 404 });
    }

    const responses = await listResponses(form.id);
    if (responses.length === 0) {
      return await secureJsonResponse(
        { status: 'error', message: 'ยังไม่มีผู้ตอบแบบสำรวจสำหรับวิเคราะห์' },
        { status: 400 },
      );
    }

    const allComments = extractAnonymizedComments(form, responses);
    const sampledComments = allComments.slice(0, MAX_COMMENTS_FOR_AI);
    const voteBlock = buildVoteSummaryBlock(form, responses);

    const commentsBlock =
      sampledComments.length > 0
        ? sampledComments
            .map(
              (c) =>
                `[#${c.index}]${c.choiceContext ? ` (${c.choiceContext})` : ''} [${c.questionTitle}]: ${c.originalText.replace(/\s+/g, ' ')}`,
            )
            .join('\n')
        : '(ยังไม่มีข้อความความคิดเห็นเพิ่มเติมจากผู้ตอบ — ให้วิเคราะห์จากผลโหวตและตัวเลขสถิติเท่านั้น และส่ง themes/commentClassifications เป็นอาร์เรย์ว่าง)';

    const systemInstruction = [
      'คุณคือนักวิเคราะห์ข้อมูลแบบสำรวจระดับมืออาชีพสำหรับชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
      'หน้าที่ของคุณคืออ่านผลโหวตและความคิดเห็นทั้งหมดของผู้ตอบ แล้วจัดระเบียบ สรุปประเด็น แยกกลุ่มหัวข้อ และร่างรายงานทางการเป็นภาษาไทยที่ชัดเจน ถูกต้อง และเป็นกลาง',
      'กฎสำคัญ:',
      '1. ห้ามแต่งเติมข้อมูล ตัวเลข หรือคำพูดที่ไม่มีอยู่ในข้อมูลต้นฉบับเด็ดขาด',
      '2. ใช้ภาษาไทยทางการ สุภาพ กระชับ ห้ามใส่อีโมจิ',
      '3. ใน commentClassifications ให้จัดหมวดหมู่ความคิดเห็นตามหมายเลข #index ที่ได้รับให้ครบถ้วนที่สุด',
      '4. ตอบกลับเป็น JSON ตาม Schema ที่กำหนดเท่านั้น',
    ].join('\n');

    const inputPrompt = [
      voteBlock,
      '',
      `รายการความคิดเห็นแบบไม่ระบุตัวตน (${sampledComments.length} จากทั้งหมด ${allComments.length} ข้อความ):`,
      commentsBlock,
    ].join('\n');

    const { text, model } = await callGeminiInteractions(apiKey, systemInstruction, inputPrompt);

    let parsed: Record<string, unknown>;
    try {
      const cleanedJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleanedJson) as Record<string, unknown>;
    } catch {
      console.error('[forms/ai-summary] Failed to parse Gemini JSON:', text.slice(0, 400));
      return await secureJsonResponse(
        { status: 'error', message: 'AI ส่งรูปแบบข้อมูลไม่สมบูรณ์ กรุณากดลองใหม่อีกครั้ง' },
        { status: 502 },
      );
    }

    const rawThemes = Array.isArray(parsed.themes) ? parsed.themes : [];
    const themes: FormAiTheme[] = rawThemes
      .map((item, idx): FormAiTheme | null => {
        if (!item || typeof item !== 'object') return null;
        const t = item as Record<string, unknown>;
        const title = String(t.title ?? '').trim();
        const summary = String(t.summary ?? '').trim();
        if (!title || !summary) return null;
        return {
          id: `theme_${idx + 1}`,
          title,
          sentiment: asThemeSentiment(t.sentiment),
          count: Math.max(1, Math.round(Number(t.count) || 1)),
          summary,
          quotes: cleanStringList(t.quotes, 4),
          tags: cleanStringList(t.tags, 5),
        };
      })
      .filter((t): t is FormAiTheme => t !== null)
      .slice(0, 8);

    const byIndex = new Map<number, ExtractedComment>(sampledComments.map((c) => [c.index, c]));
    const seenIndexes = new Set<number>();
    const rawClassifications = Array.isArray(parsed.commentClassifications) ? parsed.commentClassifications : [];
    const organizedComments: FormAiOrganizedComment[] = [];

    for (const item of rawClassifications) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const idx = Math.round(Number(row.index) || 0);
      const source = byIndex.get(idx);
      if (!source || seenIndexes.has(idx)) continue;
      seenIndexes.add(idx);
      organizedComments.push({
        index: idx,
        category: String(row.category ?? '').trim() || 'ทั่วไป',
        sentiment: asSentiment(row.sentiment),
        shortSummary: String(row.shortSummary ?? '').trim() || source.originalText.slice(0, 80),
        originalText: source.originalText,
        questionTitle: source.questionTitle,
        ...(source.choiceContext ? { choiceContext: source.choiceContext } : {}),
      });
    }

    // Ensure any unmapped comments from sampledComments still appear under "อื่นๆ"
    for (const c of sampledComments) {
      if (seenIndexes.has(c.index)) continue;
      organizedComments.push({
        index: c.index,
        category: 'อื่นๆ',
        sentiment: 'neutral',
        shortSummary: c.originalText.slice(0, 90),
        originalText: c.originalText,
        questionTitle: c.questionTitle,
        ...(c.choiceContext ? { choiceContext: c.choiceContext } : {}),
      });
    }

    const rawHighlights = (parsed.highlights && typeof parsed.highlights === 'object'
      ? parsed.highlights
      : {}) as Record<string, unknown>;

    const lastResponseAt = responses.reduce<string | null>((latest, r) => {
      const ts = r.updatedAt || r.submittedAt;
      if (!ts) return latest;
      return !latest || ts > latest ? ts : latest;
    }, null);

    const analysis: FormAiAnalysis = {
      formId: form.id,
      generatedAt: new Date().toISOString(),
      model,
      responseCount: responses.length,
      commentCount: allComments.length,
      lastResponseAt,
      executiveSummary: String(parsed.executiveSummary ?? '').trim(),
      sentiment: clampSentiment(parsed.sentiment),
      themes,
      highlights: {
        supporting: cleanStringList(rawHighlights.supporting, 6),
        concerns: cleanStringList(rawHighlights.concerns, 6),
        suggestions: cleanStringList(rawHighlights.suggestions, 6),
      },
      recommendations: cleanStringList(parsed.recommendations, 6),
      formalDraft: String(parsed.formalDraft ?? '').trim(),
      organizedComments,
    };

    await saveFormAiAnalysis(form.id, analysis);

    return await secureJsonResponse({
      status: 'success',
      analysis,
    });
  } catch (error: unknown) {
    console.error('[admin/forms/:id/ai-summary] POST', error);
    const detail = error instanceof Error ? error.message : 'AI analysis failed';
    return await secureJsonResponse(
      {
        status: 'error',
        message:
          process.env.NODE_ENV === 'production'
            ? 'วิเคราะห์ความคิดเห็นด้วย AI ไม่สำเร็จในขณะนี้ กรุณาลองใหม่อีกครั้ง'
            : `วิเคราะห์ไม่สำเร็จ: ${detail}`,
      },
      { status: 502 },
    );
  }
}
