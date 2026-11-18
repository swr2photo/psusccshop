// GET    /api/forms/[id] — form + the viewer's own answer (+ results / quota counts when allowed)
// POST   /api/forms/[id] — submit an answer + PDPA consent proof
// DELETE /api/forms/[id] — withdraw PDPA consent and delete own response (when enabled)
//   access.mode 'login'  → sign-in required, optionally restricted to email domains / an invite list
//   access.mode 'public' → no sign-in, anonymous; one answer per browser (cookie)
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminEmailAsync, requireAuth } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { API_CACHE, rateLimitOrNull } from '@/lib/api-helpers';
import {
  describeAccess,
  formHasOptionQuotas,
  getFormAccess,
  getFormPdpa,
  isEmailAllowed,
  isFormAcceptingResponses,
  publicFormView,
  summarizeForm,
  type FormPdpaConsentRecord,
} from '@/lib/forms';
import {
  anonRespondentKey,
  computeQuotaOptionCounts,
  deleteResponse,
  getFormDefinition,
  getUserResponse,
  hashClientIp,
  hashRespondent,
  listResponses,
  newAnonId,
  readAnonId,
  setAnonCookie,
  validateAndSubmitResponse,
} from '@/lib/forms-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    const email = session?.user?.email || null;

    const form = await getFormDefinition(id);
    const isAdmin = email ? await isAdminEmailAsync(email) : false;
    if (!form || (form.status === 'draft' && !isAdmin)) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่พบแบบฟอร์มนี้' }, { status: 404 });
    }

    const access = getFormAccess(form);
    const anonId = readAnonId(request);
    const respondentKey = access.mode === 'public' ? (anonId ? anonRespondentKey(anonId) : null) : email;
    const myResponse = respondentKey ? await getUserResponse(form.id, respondentKey) : null;
    const accepting = isFormAcceptingResponses(form);
    const canSeeResults = form.showResultsToRespondents && (Boolean(myResponse) || !accepting);
    const needsQuotas = formHasOptionQuotas(form);
    const responses = canSeeResults || needsQuotas ? await listResponses(form.id) : [];

    const summary = canSeeResults ? summarizeForm(form, responses, false) : null;
    const optionCounts = needsQuotas
      ? computeQuotaOptionCounts(form, responses, myResponse && form.allowEditResponse ? respondentKey : null)
      : undefined;

    return await secureJsonResponse(
      {
        status: 'success',
        form: publicFormView(form),
        isAcceptingResponses: accepting,
        loggedIn: Boolean(email),
        viewerEmail: email,
        accessMode: access.mode,
        accessNote: describeAccess(access),
        // null = not signed in yet (login mode); false = signed in with an account that isn't allowed
        canRespond: access.mode === 'public' ? true : email ? isEmailAllowed(access, email) : null,
        myResponse: myResponse
          ? {
              answers: myResponse.answers,
              pdpaConsent: myResponse.pdpaConsent ?? null,
              submittedAt: myResponse.submittedAt,
              updatedAt: myResponse.updatedAt,
            }
          : null,
        summary,
        optionCounts,
      },
      { headers: { 'Cache-Control': API_CACHE.private } },
    );
  } catch (error) {
    console.error('[forms] GET one', error);
    return await secureJsonResponse({ status: 'error', message: 'โหลดแบบฟอร์มไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const limited = await rateLimitOrNull(request, { maxRequests: 10, windowSeconds: 60, prefix: 'forms-submit' });
  if (limited) return limited;

  try {
    const { id } = await params;
    const form = await getFormDefinition(id);
    if (!form || form.status === 'draft') {
      return await secureJsonResponse({ status: 'error', message: 'ไม่พบแบบฟอร์มนี้' }, { status: 404 });
    }
    const access = getFormAccess(form);

    // Who is answering?
    let respondent: { key: string; name: string | null; newAnonId?: string };
    if (access.mode === 'public') {
      const existing = readAnonId(request);
      const anonId = existing || newAnonId();
      respondent = { key: anonRespondentKey(anonId), name: null, newAnonId: existing ? undefined : anonId };
    } else {
      const auth = await requireAuth(request);
      if (auth instanceof NextResponse) return auth;
      if (!isEmailAllowed(access, auth.email)) {
        return await secureJsonResponse(
          { status: 'error', message: `บัญชีนี้ไม่มีสิทธิ์ตอบ (${describeAccess(access) || 'จำกัดผู้ตอบ'})`, code: 'EMAIL_NOT_ALLOWED' },
          { status: 403 },
        );
      }
      const session = await getSession(request);
      respondent = { key: auth.email, name: session?.user?.name || null };
    }

    if (!isFormAcceptingResponses(form)) {
      return await secureJsonResponse({ status: 'error', message: 'แบบฟอร์มนี้ปิดรับคำตอบแล้ว' }, { status: 409 });
    }

    const body = await secureJsonRequest(request);
    const pdpa = getFormPdpa(form);
    const now = new Date().toISOString();

    let pdpaConsent: FormPdpaConsentRecord | null = null;
    if (pdpa.enabled) {
      const accepted = Boolean(body?.pdpaConsent?.accepted);
      if (pdpa.requireConsent && !accepted) {
        return await secureJsonResponse(
          {
            status: 'error',
            message: 'กรุณายอมรับข้อตกลงคุ้มครองข้อมูลส่วนบุคคล (PDPA) ก่อนส่งคำตอบ',
            code: 'PDPA_CONSENT_REQUIRED',
          },
          { status: 400 },
        );
      }

      const clientIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null;
      const ua = (request.headers.get('user-agent') || '').slice(0, 200) || null;

      pdpaConsent = {
        accepted: pdpa.requireConsent ? true : accepted,
        ...(pdpa.marketingConsentEnabled ? { marketingAccepted: Boolean(body?.pdpaConsent?.marketingAccepted) } : {}),
        acceptedAt: now,
        policyVersion: pdpa.version,
        purposeSnapshot: pdpa.purpose,
        dataCollectedSnapshot: pdpa.dataCollected,
        retentionDays: pdpa.retentionDays,
        expiresAt: pdpa.retentionDays ? new Date(Date.now() + pdpa.retentionDays * 86_400_000).toISOString() : null,
        ipHash: access.mode === 'public' ? null : hashClientIp(clientIp),
        userAgent: access.mode === 'public' ? null : ua,
      };
    }

    const result = await validateAndSubmitResponse({
      form,
      respondentEmail: respondent.key,
      respondentName: respondent.name,
      rawAnswers: body?.answers,
      pdpaConsent,
    });

    if (!result.ok) {
      const duplicateMsg =
        result.status === 409 && result.error === 'คุณตอบแบบฟอร์มนี้ไปแล้ว'
          ? access.mode === 'public'
            ? 'คุณตอบแบบฟอร์มนี้ไปแล้ว'
            : 'คุณตอบแบบฟอร์มนี้ไปแล้ว (ตอบได้ 1 ครั้งต่อบัญชี)'
          : result.error;
      return await secureJsonResponse(
        { status: 'error', message: duplicateMsg, questionId: result.questionId },
        { status: result.status },
      );
    }

    const needsQuotas = formHasOptionQuotas(form);
    const responses = form.showResultsToRespondents || needsQuotas ? await listResponses(form.id) : [];
    const summary = form.showResultsToRespondents ? summarizeForm(form, responses, false) : null;
    const optionCounts = needsQuotas
      ? computeQuotaOptionCounts(form, responses, form.allowEditResponse ? respondent.key : null)
      : undefined;

    const res = await secureJsonResponse({
      status: 'success',
      outcome: result.outcome,
      summary,
      pdpaConsent,
      optionCounts,
    });
    if (respondent.newAnonId) setAnonCookie(res, respondent.newAnonId);
    return res;
  } catch (error) {
    console.error('[forms] POST', error);
    return await secureJsonResponse({ status: 'error', message: 'บันทึกคำตอบไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const limited = await rateLimitOrNull(request, { maxRequests: 10, windowSeconds: 60, prefix: 'forms-withdraw' });
  if (limited) return limited;

  try {
    const { id } = await params;
    const form = await getFormDefinition(id);
    if (!form || form.status === 'draft') {
      return await secureJsonResponse({ status: 'error', message: 'ไม่พบแบบฟอร์มนี้' }, { status: 404 });
    }

    const pdpa = getFormPdpa(form);
    if (!pdpa.enabled || !pdpa.allowWithdrawConsent) {
      return await secureJsonResponse(
        { status: 'error', message: 'แบบฟอร์มนี้ไม่อนุญาตให้ถอนคำตอบด้วยตนเอง กรุณาติดต่อผู้ดูแล' },
        { status: 403 },
      );
    }

    const access = getFormAccess(form);
    let respondentKey: string | null = null;
    if (access.mode === 'public') {
      const anonId = readAnonId(request);
      respondentKey = anonId ? anonRespondentKey(anonId) : null;
    } else {
      const auth = await requireAuth(request);
      if (auth instanceof NextResponse) return auth;
      respondentKey = auth.email;
    }

    if (!respondentKey) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่พบข้อมูลคำตอบของท่าน' }, { status: 404 });
    }

    const deleted = await deleteResponse(form.id, hashRespondent(respondentKey));
    return await secureJsonResponse({
      status: 'success',
      deleted,
      message: deleted ? 'ถอนความยินยอมและลบคำตอบของท่านเรียบร้อยแล้ว' : 'ไม่พบข้อมูลคำตอบของท่าน',
    });
  } catch (error) {
    console.error('[forms] DELETE', error);
    return await secureJsonResponse({ status: 'error', message: 'ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
