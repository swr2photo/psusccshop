// src/lib/forms.ts
// Shared (client + server) types and pure helpers for the survey / vote / sign-up form system.
import { findFormFont } from './form-fonts';

export const FORM_QUESTION_TYPES = [
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
  'dropdown',
  'rating',
  'date',
] as const;

export type FormQuestionType = (typeof FORM_QUESTION_TYPES)[number];

export const FORM_QUESTION_TYPE_LABELS: Record<FormQuestionType, { th: string; en: string }> = {
  short_text: { th: 'ข้อความสั้น', en: 'Short text' },
  long_text: { th: 'ข้อความยาว / ความคิดเห็น', en: 'Long text / comment' },
  single_choice: { th: 'เลือกตอบ 1 ข้อ (โหวต)', en: 'Single choice (vote)' },
  multiple_choice: { th: 'เลือกได้หลายข้อ', en: 'Multiple choice' },
  dropdown: { th: 'เลือกจากรายการ (dropdown)', en: 'Dropdown' },
  rating: { th: 'ให้คะแนน 1–5', en: 'Rating 1–5' },
  date: { th: 'วันที่', en: 'Date' },
};

export const CHOICE_QUESTION_TYPES: readonly FormQuestionType[] = ['single_choice', 'multiple_choice', 'dropdown'];

// ───────────── Conditional logic types ─────────────

export const FORM_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'in',
  'not_in',
  'all_of',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'gt',
  'gte',
  'lt',
  'lte',
] as const;

export type FormConditionOperator = (typeof FORM_CONDITION_OPERATORS)[number];

export const CONDITION_OPERATOR_LABELS: Record<FormConditionOperator, string> = {
  equals: 'เท่ากับ',
  not_equals: 'ไม่เท่ากับ',
  in: 'เป็นข้อใดข้อหนึ่งใน',
  not_in: 'ไม่เป็นข้อใดเลยใน',
  all_of: 'เลือกครบทุกข้อที่ระบุ',
  contains: 'มี / เลือกตัวเลือก',
  not_contains: 'ไม่มี / ไม่ได้เลือกตัวเลือก',
  is_empty: 'ยังไม่ได้ตอบ',
  is_not_empty: 'ตอบคำถามนี้แล้ว',
  gt: 'มากกว่า (>)',
  gte: 'ตั้งแต่ / มากกว่าหรือเท่ากับ (≥)',
  lt: 'น้อยกว่า (<)',
  lte: 'ไม่เกิน / น้อยกว่าหรือเท่ากับ (≤)',
};

export interface FormConditionRule {
  id: string;
  questionId: string;
  operator: FormConditionOperator;
  /** Scalar comparison value (option id, text, rating string, or YYYY-MM-DD) */
  value?: string;
  /** Multi-value comparison (option ids / ratings for 'in', 'not_in', 'all_of', etc.) */
  values?: string[];
  /** Text comparison case sensitivity (default false) */
  caseSensitive?: boolean;
}

export interface FormConditionGroup {
  id: string;
  match: 'all' | 'any';
  rules: FormConditionRule[];
}

export interface FormConditionSet {
  enabled: boolean;
  match: 'all' | 'any';
  groups: FormConditionGroup[];
}

// ───────────── Text validation ─────────────

export const FORM_TEXT_FORMATS = ['none', 'number', 'email', 'phone', 'url', 'regex'] as const;
export type FormTextFormat = (typeof FORM_TEXT_FORMATS)[number];

export const FORM_TEXT_FORMAT_LABELS: Record<FormTextFormat, string> = {
  none: 'ข้อความทั่วไป',
  number: 'ตัวเลขเท่านั้น',
  email: 'อีเมล',
  phone: 'เบอร์โทรศัพท์',
  url: 'ลิงก์ URL',
  regex: 'รูปแบบเฉพาะ (Regex)',
};

export interface FormTextValidation {
  format?: FormTextFormat;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  patternMessage?: string;
}

// ───────────── Options & questions ─────────────

export type FormOptionActionType = 'next' | 'skip_to' | 'end_form';

export interface FormOption {
  id: string;
  label: string;
  /** Optional helper description shown under the option */
  description?: string;
  /** "Other (please specify)" — respondents type their own answer when they pick it */
  other?: boolean;
  /** Require respondent to specify extra details when choosing this option */
  requireDetail?: boolean;
  detailPlaceholder?: string;
  /** multiple_choice only: selecting this option clears all other selections */
  exclusive?: boolean;
  /** Maximum respondents allowed to choose this option (0 / null / undefined = unlimited) */
  maxChoices?: number | null;
  /** When maxChoices is reached: disable with "เต็มแล้ว" badge or hide completely */
  quotaFullBehavior?: 'disable' | 'hide';
  /** Temporarily prevent respondents from selecting this option */
  disabled?: boolean;
  /** Detailed visibility condition for this option */
  condition?: FormConditionSet | null;
  /** Branching for single_choice / dropdown */
  action?: FormOptionActionType;
  skipToQuestionId?: string | null;
  endMessage?: string;
}

/** Answer key holding the free text typed for a question's "other" option. */
export function otherAnswerKey(questionId: string): string {
  return `${questionId}__other`;
}

/** Answer key holding extra detail typed for a specific option with `requireDetail`. */
export function optionDetailAnswerKey(questionId: string, optionId: string): string {
  return `${questionId}__opt_${optionId}`;
}

export const OTHER_OPTION_LABEL = 'อื่น ๆ (โปรดระบุ)';

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  title: string;
  description?: string;
  required: boolean;
  /** When enabled, the question is required ONLY when this condition matches */
  requiredCondition?: FormConditionSet | null;
  /** When enabled, the question is visible ONLY when this condition matches */
  condition?: FormConditionSet | null;
  /** For single_choice / multiple_choice / dropdown */
  options?: FormOption[];
  /** multiple_choice: minimum selections (0 / undefined = none) */
  minSelections?: number;
  /** multiple_choice: max selections (0 / undefined = unlimited) */
  maxSelections?: number;
  /** For short_text / long_text */
  validation?: FormTextValidation | null;
}

export type FormStatus = 'draft' | 'open' | 'closed';

export interface FormBanner {
  type: 'image' | 'video';
  url: string;
}

/** Banner images must come from our own upload storage (Supabase public bucket or the image proxy). */
export function isAllowedBannerImageUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/[^\s"'<>]+$/i.test(url) || /^\/api\/image\/[^\s"'<>]+$/.test(url);
}

export interface VideoEmbed {
  provider: 'youtube' | 'vimeo';
  embedUrl: string;
  thumbnail?: string;
}

/** Turn a YouTube / Vimeo link into a privacy-friendly embed URL. Returns null for anything else. */
export function getVideoEmbed(url: string): VideoEmbed | null {
  const s = String(url || '').trim();
  const yt =
    s.match(/^https?:\/\/(?:www\.|m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    s.match(/^https?:\/\/(?:www\.|m\.)?youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1&playsinline=1`,
      thumbnail: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = s.match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vimeo) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  return null;
}

// ───────────── Who can answer ─────────────

/** 'login' = must sign in (optionally restricted by email); 'public' = anyone, anonymous. */
export type FormAccessMode = 'login' | 'public';

export interface FormAccess {
  mode: FormAccessMode;
  /** e.g. ['psu.ac.th', 'gmail.com'] — subdomains match too. Empty + no emails = any account. */
  allowedDomains: string[];
  /** Specific accounts allowed in addition to the domains (kept private, never sent to respondents). */
  allowedEmails: string[];
}

export const DEFAULT_FORM_ACCESS: FormAccess = { mode: 'login', allowedDomains: [], allowedEmails: [] };

const EMAIL_RE = /^[^\s@<>"']+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const DOMAIN_RE = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** "@PSU.ac.th " → "psu.ac.th"; returns '' when it isn't a domain. */
export function normalizeDomain(input: string): string {
  const d = String(input || '').trim().toLowerCase().replace(/^@+/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return DOMAIN_RE.test(d) ? d : '';
}

export function normalizeEmail(input: string): string {
  const e = String(input || '').trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : '';
}

export function getFormAccess(form: Pick<FormDefinition, 'access'> | null | undefined): FormAccess {
  const a = form?.access;
  return {
    mode: a?.mode === 'public' ? 'public' : 'login',
    allowedDomains: Array.isArray(a?.allowedDomains) ? a.allowedDomains : [],
    allowedEmails: Array.isArray(a?.allowedEmails) ? a.allowedEmails : [],
  };
}

/** Login-mode check: is this signed-in account allowed to answer? */
export function isEmailAllowed(access: FormAccess, email: string | null | undefined): boolean {
  if (access.mode === 'public') return true;
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  if (access.allowedDomains.length === 0 && access.allowedEmails.length === 0) return true;
  if (access.allowedEmails.includes(e)) return true;
  const domain = e.split('@')[1] || '';
  return access.allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Human-readable restriction for respondents, e.g. "อีเมล @psu.ac.th หรือ @gmail.com". */
export function describeAccess(access: FormAccess): string | null {
  if (access.mode === 'public') return null;
  const parts = access.allowedDomains.map((d) => `@${d}`);
  if (access.allowedEmails.length) parts.push('อีเมลที่ได้รับเชิญ');
  if (!parts.length) return null;
  return `เฉพาะอีเมล ${parts.join(' หรือ ')}`;
}

function sanitizeAccess(input: unknown): FormAccess {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<FormAccess>;
  const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));
  return {
    mode: raw.mode === 'public' ? 'public' : 'login',
    allowedDomains: uniq((Array.isArray(raw.allowedDomains) ? raw.allowedDomains : []).map(normalizeDomain)).slice(0, 20),
    allowedEmails: uniq((Array.isArray(raw.allowedEmails) ? raw.allowedEmails : []).map(normalizeEmail)).slice(0, 1000),
  };
}

// ───────────── PDPA configuration & consent record ─────────────

export interface FormPdpaConfig {
  enabled: boolean;
  /** How the PDPA notice is presented before filling: modal popup or inline card */
  displayMode?: 'popup' | 'inline';
  /** Policy version string for audit records */
  version: string;
  /** Data controller name */
  controllerName: string;
  /** Purpose of collecting and processing data */
  purpose: string;
  /** Description of personal data collected */
  dataCollected: string;
  /** Retention period in days (null = until deleted / no fixed expiration) */
  retentionDays: number | null;
  /** Optional extra note about retention */
  retentionNote?: string;
  /** DPO / contact email or channel */
  contactEmail: string;
  /** Link to privacy policy */
  privacyPolicyUrl: string;
  /** Require explicit consent checkbox before submitting */
  requireConsent: boolean;
  /** Label for the required consent checkbox */
  consentText: string;
  /** Optional secondary consent (e.g. news/updates) */
  marketingConsentEnabled: boolean;
  marketingConsentText: string;
  /** Allow respondent to withdraw consent and delete their own response */
  allowWithdrawConsent: boolean;
}

export interface FormPdpaConsentRecord {
  accepted: boolean;
  marketingAccepted?: boolean;
  acceptedAt: string;
  policyVersion: string;
  purposeSnapshot?: string;
  dataCollectedSnapshot?: string;
  retentionDays?: number | null;
  expiresAt?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

export const DEFAULT_FORM_PDPA: FormPdpaConfig = {
  enabled: true,
  displayMode: 'popup',
  version: '1.0',
  controllerName: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
  purpose: 'เพื่อเก็บรวบรวมข้อมูลประกอบการดำเนินกิจกรรม การสำรวจความคิดเห็น และการติดต่อประสานงานที่เกี่ยวข้องกับแบบฟอร์มนี้',
  dataCollected: 'ชื่อ-นามสกุล อีเมล และคำตอบที่ท่านระบุในแบบฟอร์ม',
  retentionDays: 365,
  retentionNote: '',
  contactEmail: 'psuscc@psuscc.club',
  privacyPolicyUrl: '/privacy',
  requireConsent: true,
  consentText: 'ข้าพเจ้าได้อ่านและรับทราบวัตถุประสงค์ในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตามรายละเอียดข้างต้น และยินยอมให้ดำเนินการตามที่ระบุไว้',
  marketingConsentEnabled: false,
  marketingConsentText: 'ยินยอมให้ติดต่อส่งข่าวสาร ประชาสัมพันธ์กิจกรรม หรือโครงการที่เกี่ยวข้องในอนาคต (ไม่บังคับ)',
  allowWithdrawConsent: true,
};

export function getFormPdpa(form: Pick<FormDefinition, 'pdpa'> | null | undefined): FormPdpaConfig {
  const p = form?.pdpa;
  if (!p) {
    // Existing legacy forms without a `pdpa` object stay disabled until enabled by an admin
    return { ...DEFAULT_FORM_PDPA, enabled: false };
  }
  const retention = p.retentionDays === null || p.retentionDays === undefined || Number(p.retentionDays) <= 0
    ? null
    : Math.min(3650, Math.max(1, Math.round(Number(p.retentionDays))));
  return {
    enabled: Boolean(p.enabled),
    displayMode: p.displayMode === 'inline' ? 'inline' : 'popup',
    version: clip(p.version, 30) || DEFAULT_FORM_PDPA.version,
    controllerName: clip(p.controllerName, 200) || DEFAULT_FORM_PDPA.controllerName,
    purpose: clip(p.purpose, 2500) || DEFAULT_FORM_PDPA.purpose,
    dataCollected: clip(p.dataCollected, 800) || DEFAULT_FORM_PDPA.dataCollected,
    retentionDays: retention,
    retentionNote: clip(p.retentionNote, 200) || '',
    contactEmail: clip(p.contactEmail, 200) || DEFAULT_FORM_PDPA.contactEmail,
    privacyPolicyUrl: clip(p.privacyPolicyUrl, 300) || DEFAULT_FORM_PDPA.privacyPolicyUrl,
    requireConsent: p.requireConsent !== false,
    consentText: clip(p.consentText, 500) || DEFAULT_FORM_PDPA.consentText,
    marketingConsentEnabled: Boolean(p.marketingConsentEnabled),
    marketingConsentText: clip(p.marketingConsentText, 400) || DEFAULT_FORM_PDPA.marketingConsentText,
    allowWithdrawConsent: p.allowWithdrawConsent !== false,
  };
}

function isSafePolicyUrl(url: string): string {
  const u = clip(url, 300);
  if (!u) return '/privacy';
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return '/privacy';
}

function sanitizePdpa(input: unknown): FormPdpaConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<FormPdpaConfig>;
  const retention = raw.retentionDays === null || raw.retentionDays === undefined || Number(raw.retentionDays) <= 0
    ? null
    : Math.min(3650, Math.max(1, Math.round(Number(raw.retentionDays))));
  return {
    enabled: Boolean(raw.enabled),
    displayMode: raw.displayMode === 'inline' ? 'inline' : 'popup',
    version: clip(raw.version, 30) || DEFAULT_FORM_PDPA.version,
    controllerName: clip(raw.controllerName, 200) || DEFAULT_FORM_PDPA.controllerName,
    purpose: clip(raw.purpose, 2500) || DEFAULT_FORM_PDPA.purpose,
    dataCollected: clip(raw.dataCollected, 800) || DEFAULT_FORM_PDPA.dataCollected,
    retentionDays: retention,
    retentionNote: clip(raw.retentionNote, 200) || '',
    contactEmail: clip(raw.contactEmail, 200) || DEFAULT_FORM_PDPA.contactEmail,
    privacyPolicyUrl: isSafePolicyUrl(raw.privacyPolicyUrl || '/privacy'),
    requireConsent: raw.requireConsent !== false,
    consentText: clip(raw.consentText, 500) || DEFAULT_FORM_PDPA.consentText,
    marketingConsentEnabled: Boolean(raw.marketingConsentEnabled),
    marketingConsentText: clip(raw.marketingConsentText, 400) || DEFAULT_FORM_PDPA.marketingConsentText,
    allowWithdrawConsent: raw.allowWithdrawConsent !== false,
  };
}

export function formatRetentionLabel(days: number | null | undefined, note?: string): string {
  if (!days || days <= 0) return note?.trim() || 'จนกว่าจะมีการร้องขอลบข้อมูล';
  const base =
    days === 365 ? '1 ปี (365 วัน)' :
    days === 730 ? '2 ปี (730 วัน)' :
    days === 180 ? '6 เดือน (180 วัน)' :
    days === 90 ? '3 เดือน (90 วัน)' :
    `${days.toLocaleString('th-TH')} วัน`;
  return note?.trim() ? `${base} · ${note.trim()}` : base;
}

/** What respondents may see: drop the private invite list. */
export function publicFormView(form: FormDefinition): FormDefinition {
  const access = getFormAccess(form);
  return { ...form, access: { ...access, allowedEmails: [] } };
}

/** Respondent key for anonymous answers (stored in place of an email). */
export const ANON_PREFIX = 'anon:';
export function isAnonymousRespondent(email: string | null | undefined): boolean {
  return String(email || '').startsWith(ANON_PREFIX);
}

function sanitizeBanner(input: unknown): FormBanner | null {
  const raw = (input && typeof input === 'object' ? input : null) as Partial<FormBanner> | null;
  const url = String(raw?.url ?? '').trim().slice(0, 1000);
  if (!raw || !url) return null;
  if (raw.type === 'image') {
    if (!isAllowedBannerImageUrl(url)) throw new Error('รูปแบนเนอร์ต้องอัปโหลดผ่านระบบเท่านั้น');
    return { type: 'image', url };
  }
  if (raw.type === 'video') {
    if (!getVideoEmbed(url)) throw new Error('ลิงก์วิดีโอต้องเป็น YouTube หรือ Vimeo');
    return { type: 'video', url };
  }
  return null;
}

export interface FormDefinition {
  id: string;
  title: string;
  description?: string;
  /** Header banner: an uploaded image or a YouTube / Vimeo preview video */
  banner?: FormBanner | null;
  /** Google Font family from FORM_FONTS (null = site default) */
  fontFamily?: string | null;
  /** Who may answer (missing = login required, any account) */
  access?: FormAccess;
  /** PDPA notice, consent & retention settings */
  pdpa?: FormPdpaConfig;
  status: FormStatus;
  questions: FormQuestion[];
  /** Respondents can see aggregated results after they answer */
  showResultsToRespondents: boolean;
  /** Respondents may change their answer while the form is open */
  allowEditResponse: boolean;
  /** Optional window (ISO strings). Outside it the form is treated as closed. */
  opensAt?: string | null;
  closesAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type FormAnswerValue = string | string[] | number;
export type FormAnswers = Record<string, FormAnswerValue>;

export interface FormResponse {
  formId: string;
  /** Account email, or `anon:<id>` for anonymous answers */
  email: string;
  name?: string | null;
  answers: FormAnswers;
  /** PDPA consent audit record */
  pdpaConsent?: FormPdpaConsentRecord | null;
  submittedAt: string;
  updatedAt: string;
}

/** Public summary shown in lists */
export interface FormListItem {
  id: string;
  title: string;
  description?: string;
  banner?: FormBanner | null;
  accessMode: FormAccessMode;
  /** e.g. "เฉพาะอีเมล @psu.ac.th" */
  accessNote?: string | null;
  pdpaEnabled?: boolean;
  status: FormStatus;
  isAcceptingResponses: boolean;
  questionCount: number;
  responseCount: number;
  closesAt?: string | null;
  hasResponded?: boolean;
  updatedAt: string;
}

export interface QuestionSummary {
  questionId: string;
  type: FormQuestionType;
  title: string;
  answered: number;
  /** choice / dropdown / rating counts, keyed by option id (or rating value as string) */
  counts?: Record<string, number>;
  /** rating */
  average?: number;
  /** text / date answers (most recent first, capped) */
  texts?: string[];
  /** free text typed for the "other" option (admin only) */
  otherTexts?: string[];
}

export interface FormSummary {
  formId: string;
  totalResponses: number;
  pdpaAcceptedCount?: number;
  marketingAcceptedCount?: number;
  questions: QuestionSummary[];
}

export const FORM_LIMITS = {
  maxQuestions: 50,
  maxOptions: 30,
  maxTitle: 200,
  maxDescription: 2000,
  maxShortText: 300,
  maxOtherText: 300,
  maxLongText: 3000,
} as const;

export function makeFormId(prefix = 'f'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function createEmptyConditionSet(): FormConditionSet {
  return {
    enabled: true,
    match: 'all',
    groups: [
      {
        id: makeFormId('cg'),
        match: 'all',
        rules: [],
      },
    ],
  };
}

export function createEmptyQuestion(type: FormQuestionType = 'single_choice'): FormQuestion {
  const q: FormQuestion = { id: makeFormId('q'), type, title: '', required: true };
  if (CHOICE_QUESTION_TYPES.includes(type)) {
    q.options = [
      { id: makeFormId('o'), label: '' },
      { id: makeFormId('o'), label: '' },
    ];
  }
  return q;
}

export function createEmptyForm(): FormDefinition {
  const now = new Date().toISOString();
  return {
    id: makeFormId('f'),
    title: '',
    description: '',
    banner: null,
    fontFamily: null,
    access: { ...DEFAULT_FORM_ACCESS },
    pdpa: { ...DEFAULT_FORM_PDPA, enabled: true },
    status: 'draft',
    questions: [createEmptyQuestion('single_choice')],
    showResultsToRespondents: true,
    allowEditResponse: false,
    opensAt: null,
    closesAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Whether a form currently accepts responses (status + time window). */
export function isFormAcceptingResponses(form: Pick<FormDefinition, 'status' | 'opensAt' | 'closesAt'>, now = Date.now()): boolean {
  if (form.status !== 'open') return false;
  if (form.opensAt) {
    const t = Date.parse(form.opensAt);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (form.closesAt) {
    const t = Date.parse(form.closesAt);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

function clip(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

// ───────────── Condition sanitization & evaluation ─────────────

export function isAnswerEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

function sanitizeConditionSet(
  input: unknown,
  allowedSourceQuestionIds: Set<string>,
): FormConditionSet | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<FormConditionSet>;
  if (!raw.enabled) return null;

  const rawGroups = Array.isArray(raw.groups) ? raw.groups.slice(0, 10) : [];
  const groups: FormConditionGroup[] = rawGroups
    .map((g) => {
      if (!g || typeof g !== 'object') return null;
      const rg = g as Partial<FormConditionGroup>;
      const rawRules = Array.isArray(rg.rules) ? rg.rules.slice(0, 20) : [];
      const rules: FormConditionRule[] = rawRules
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const rr = r as Partial<FormConditionRule>;
          const qid = clip(rr.questionId, 40).replace(/[^a-zA-Z0-9_-]/g, '');
          if (!qid || !allowedSourceQuestionIds.has(qid)) return null;
          const op = (FORM_CONDITION_OPERATORS as readonly string[]).includes(String(rr.operator))
            ? (rr.operator as FormConditionOperator)
            : 'equals';
          const values = Array.isArray(rr.values)
            ? Array.from(new Set(rr.values.map((v) => clip(v, 200)).filter(Boolean))).slice(0, 30)
            : undefined;
          const value = rr.value !== undefined && rr.value !== null ? clip(rr.value, 200) : undefined;
          const rule: FormConditionRule = {
            id: clip(rr.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || makeFormId('cr'),
            questionId: qid,
            operator: op,
          };
          if (value !== undefined && value !== '') rule.value = value;
          if (values && values.length > 0) rule.values = values;
          if (rr.caseSensitive) rule.caseSensitive = true;
          return rule;
        })
        .filter((x): x is FormConditionRule => x !== null);
      if (rules.length === 0) return null;
      return {
        id: clip(rg.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || makeFormId('cg'),
        match: rg.match === 'any' ? 'any' : 'all',
        rules,
      };
    })
    .filter((x): x is FormConditionGroup => x !== null);

  if (groups.length === 0) return null;
  return {
    enabled: true,
    match: raw.match === 'any' ? 'any' : 'all',
    groups,
  };
}

function sanitizeTextValidation(input: unknown, type: FormQuestionType): FormTextValidation | null {
  if ((type !== 'short_text' && type !== 'long_text') || !input || typeof input !== 'object') return null;
  const raw = input as Partial<FormTextValidation>;
  const format: FormTextFormat =
    type === 'short_text' && (FORM_TEXT_FORMATS as readonly string[]).includes(String(raw.format))
      ? (raw.format as FormTextFormat)
      : 'none';
  const maxAllowed = type === 'long_text' ? FORM_LIMITS.maxLongText : FORM_LIMITS.maxShortText;
  const minLength = raw.minLength && Number(raw.minLength) > 0 ? Math.min(maxAllowed, Math.round(Number(raw.minLength))) : undefined;
  const maxLength = raw.maxLength && Number(raw.maxLength) > 0 ? Math.min(maxAllowed, Math.round(Number(raw.maxLength))) : undefined;
  const minValue = format === 'number' && raw.minValue !== undefined && raw.minValue !== null && String(raw.minValue) !== '' && Number.isFinite(Number(raw.minValue))
    ? Number(raw.minValue)
    : undefined;
  const maxValue = format === 'number' && raw.maxValue !== undefined && raw.maxValue !== null && String(raw.maxValue) !== '' && Number.isFinite(Number(raw.maxValue))
    ? Number(raw.maxValue)
    : undefined;
  let pattern: string | undefined;
  if (format === 'regex' && raw.pattern) {
    const p = String(raw.pattern).slice(0, 200);
    try {
      new RegExp(p);
      pattern = p;
    } catch {
      throw new Error('รูปแบบ Regex ในคำถามไม่ถูกต้อง');
    }
  }
  const patternMessage = clip(raw.patternMessage, 200) || undefined;
  if (format === 'none' && !minLength && !maxLength && minValue === undefined && maxValue === undefined && !pattern && !patternMessage) {
    return null;
  }
  return {
    ...(format !== 'none' ? { format } : {}),
    ...(minLength ? { minLength } : {}),
    ...(maxLength ? { maxLength } : {}),
    ...(minValue !== undefined ? { minValue } : {}),
    ...(maxValue !== undefined ? { maxValue } : {}),
    ...(pattern ? { pattern } : {}),
    ...(patternMessage ? { patternMessage } : {}),
  };
}

/** Normalise + validate a form definition coming from the admin editor. Throws on invalid input. */
export function sanitizeFormDefinition(input: Partial<FormDefinition>, existing?: FormDefinition | null): FormDefinition {
  const now = new Date().toISOString();
  const title = clip(input.title, FORM_LIMITS.maxTitle);
  if (!title) throw new Error('กรุณาใส่ชื่อแบบฟอร์ม');

  const rawQuestions = Array.isArray(input.questions) ? input.questions.slice(0, FORM_LIMITS.maxQuestions) : [];
  if (rawQuestions.length === 0) throw new Error('ต้องมีคำถามอย่างน้อย 1 ข้อ');

  // First pass: stabilize question IDs in order so forward/backward checks are deterministic
  const seen = new Set<string>();
  const resolvedIds = rawQuestions.map((raw) => {
    let id = clip(raw?.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || makeFormId('q');
    if (seen.has(id)) id = makeFormId('q');
    seen.add(id);
    return id;
  });

  const earlierIds = new Set<string>();
  const questions: FormQuestion[] = rawQuestions.map((raw, idx) => {
    const type = (FORM_QUESTION_TYPES as readonly string[]).includes(String(raw?.type))
      ? (raw.type as FormQuestionType)
      : 'short_text';
    const id = resolvedIds[idx];
    const qTitle = clip(raw?.title, FORM_LIMITS.maxTitle);
    if (!qTitle) throw new Error(`คำถามข้อ ${idx + 1} ยังไม่มีหัวข้อ`);

    const laterIds = new Set(resolvedIds.slice(idx + 1));

    const q: FormQuestion = {
      id,
      type,
      title: qTitle,
      description: clip(raw?.description, 500) || undefined,
      required: Boolean(raw?.required),
    };

    const cond = sanitizeConditionSet(raw?.condition, earlierIds);
    if (cond) q.condition = cond;

    const reqCond = sanitizeConditionSet(raw?.requiredCondition, earlierIds);
    if (reqCond) {
      q.requiredCondition = reqCond;
      q.required = false; // conditional requirement governs when active
    }

    const validation = sanitizeTextValidation(raw?.validation, type);
    if (validation) q.validation = validation;

    if (CHOICE_QUESTION_TYPES.includes(type)) {
      const optSeen = new Set<string>();
      let hasOther = false;
      const options = (Array.isArray(raw?.options) ? raw.options : [])
        .slice(0, FORM_LIMITS.maxOptions)
        .map((o) => {
          let oid = clip(o?.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || makeFormId('o');
          if (optSeen.has(oid)) oid = makeFormId('o');
          optSeen.add(oid);
          const isOther = Boolean(o?.other) && !hasOther && type !== 'dropdown';
          if (isOther) hasOther = true;
          const label = clip(o?.label, 200) || (isOther ? OTHER_OPTION_LABEL : '');
          if (!label) return null;

          const option: FormOption = { id: oid, label };
          if (isOther) option.other = true;
          const desc = clip(o?.description, 250);
          if (desc) option.description = desc;
          if (!isOther && o?.requireDetail) {
            option.requireDetail = true;
            const ph = clip(o.detailPlaceholder, 120);
            if (ph) option.detailPlaceholder = ph;
          }
          if (type === 'multiple_choice' && o?.exclusive) option.exclusive = true;
          if (o?.disabled) option.disabled = true;
          const maxChoices = o?.maxChoices && Number(o.maxChoices) > 0 ? Math.min(100000, Math.round(Number(o.maxChoices))) : null;
          if (maxChoices) {
            option.maxChoices = maxChoices;
            option.quotaFullBehavior = o?.quotaFullBehavior === 'hide' ? 'hide' : 'disable';
          }
          const optCond = sanitizeConditionSet(o?.condition, earlierIds);
          if (optCond) option.condition = optCond;

          if (type === 'single_choice' || type === 'dropdown') {
            if (o?.action === 'end_form') {
              option.action = 'end_form';
              const endMsg = clip(o.endMessage, 300);
              if (endMsg) option.endMessage = endMsg;
            } else if (o?.action === 'skip_to' && o.skipToQuestionId && laterIds.has(String(o.skipToQuestionId))) {
              option.action = 'skip_to';
              option.skipToQuestionId = String(o.skipToQuestionId);
            }
          }
          return option;
        })
        .filter((o): o is FormOption => o !== null);

      if (options.length < 2) throw new Error(`คำถามข้อ ${idx + 1} ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`);
      // Keep "other" last, like every survey tool does
      q.options = [...options.filter((o) => !o.other), ...options.filter((o) => o.other)];
      if (type === 'multiple_choice') {
        const min = Math.max(0, Math.min(options.length, Number(raw?.minSelections) || 0));
        const max = Math.max(0, Math.min(options.length, Number(raw?.maxSelections) || 0));
        if (min > 0) q.minSelections = min;
        if (max > 0) q.maxSelections = min > 0 && max < min ? min : max;
      }
    }

    earlierIds.add(id);
    return q;
  });

  const status: FormStatus = input.status === 'open' || input.status === 'closed' ? input.status : 'draft';
  const toIso = (v: unknown) => {
    if (!v) return null;
    const t = Date.parse(String(v));
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };

  return {
    id: existing?.id || clip(input.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || makeFormId('f'),
    title,
    description: clip(input.description, FORM_LIMITS.maxDescription),
    banner: sanitizeBanner(input.banner),
    fontFamily: findFormFont(input.fontFamily)?.family || null,
    access: sanitizeAccess(input.access),
    pdpa: input.pdpa !== undefined ? sanitizePdpa(input.pdpa) : existing?.pdpa ? sanitizePdpa(existing.pdpa) : { ...DEFAULT_FORM_PDPA, enabled: false },
    status,
    questions,
    showResultsToRespondents: Boolean(input.showResultsToRespondents),
    allowEditResponse: Boolean(input.allowEditResponse),
    opensAt: toIso(input.opensAt),
    closesAt: toIso(input.closesAt),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || input.createdBy,
  };
}

// ───────────── Condition & branching evaluator ─────────────

export function evaluateConditionRule(
  rule: FormConditionRule,
  answers: Record<string, unknown>,
  visibleQuestionIds: Set<string>,
  questionById: Map<string, FormQuestion>,
): boolean {
  const sourceVisible = visibleQuestionIds.has(rule.questionId);
  const rawVal = sourceVisible ? answers[rule.questionId] : undefined;
  const empty = !sourceVisible || isAnswerEmptyValue(rawVal);

  if (rule.operator === 'is_empty') return empty;
  if (rule.operator === 'is_not_empty') return !empty;

  // Value-comparing operators require a visible, non-empty answer on the source question
  if (empty) return false;

  const q = questionById.get(rule.questionId);
  const strTarget = String(rule.value ?? '');
  const listTarget = (rule.values && rule.values.length > 0 ? rule.values : strTarget ? [strTarget] : []).map(String);

  if (q && q.type === 'multiple_choice') {
    const arr = Array.isArray(rawVal) ? rawVal.map(String) : [String(rawVal)];
    switch (rule.operator) {
      case 'contains':
        return strTarget !== '' && arr.includes(strTarget);
      case 'not_contains':
        return strTarget !== '' && !arr.includes(strTarget);
      case 'in':
        return listTarget.some((v) => arr.includes(v));
      case 'not_in':
        return listTarget.every((v) => !arr.includes(v));
      case 'all_of':
        return listTarget.length > 0 && listTarget.every((v) => arr.includes(v));
      case 'equals':
        return listTarget.length > 0 && arr.length === listTarget.length && listTarget.every((v) => arr.includes(v));
      case 'not_equals':
        return listTarget.length > 0 && !(arr.length === listTarget.length && listTarget.every((v) => arr.includes(v)));
      default:
        return false;
    }
  }

  if (q && (q.type === 'single_choice' || q.type === 'dropdown')) {
    const val = String(rawVal);
    switch (rule.operator) {
      case 'equals':
      case 'contains':
        return val === strTarget;
      case 'not_equals':
      case 'not_contains':
        return val !== strTarget;
      case 'in':
      case 'all_of':
        return listTarget.includes(val);
      case 'not_in':
        return !listTarget.includes(val);
      default:
        return false;
    }
  }

  if (q && q.type === 'rating') {
    const n = Number(rawVal);
    const target = Number(strTarget);
    switch (rule.operator) {
      case 'equals': return Number.isFinite(target) && n === target;
      case 'not_equals': return Number.isFinite(target) && n !== target;
      case 'gt': return Number.isFinite(target) && n > target;
      case 'gte': return Number.isFinite(target) && n >= target;
      case 'lt': return Number.isFinite(target) && n < target;
      case 'lte': return Number.isFinite(target) && n <= target;
      case 'in': return listTarget.map(Number).includes(n);
      case 'not_in': return !listTarget.map(Number).includes(n);
      default: return false;
    }
  }

  if (q && q.type === 'date') {
    const val = String(rawVal).slice(0, 10);
    const t = strTarget.slice(0, 10);
    switch (rule.operator) {
      case 'equals': return val === t;
      case 'not_equals': return val !== t;
      case 'gt': return Boolean(t) && val > t;
      case 'gte': return Boolean(t) && val >= t;
      case 'lt': return Boolean(t) && val < t;
      case 'lte': return Boolean(t) && val <= t;
      case 'in': return listTarget.includes(val);
      case 'not_in': return !listTarget.includes(val);
      default: return false;
    }
  }

  // short_text / long_text / fallback
  const rawStr = String(rawVal);
  const lhs = rule.caseSensitive ? rawStr : rawStr.toLowerCase();
  const rhs = rule.caseSensitive ? strTarget : strTarget.toLowerCase();
  switch (rule.operator) {
    case 'equals': return lhs === rhs;
    case 'not_equals': return lhs !== rhs;
    case 'contains': return rhs !== '' && lhs.includes(rhs);
    case 'not_contains': return rhs !== '' && !lhs.includes(rhs);
    case 'in': return listTarget.map((v) => (rule.caseSensitive ? v : v.toLowerCase())).includes(lhs);
    case 'not_in': return !listTarget.map((v) => (rule.caseSensitive ? v : v.toLowerCase())).includes(lhs);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const n1 = Number(rawStr.trim());
      const n2 = Number(strTarget.trim());
      if (rawStr.trim() === '' || strTarget.trim() === '' || !Number.isFinite(n1) || !Number.isFinite(n2)) return false;
      if (rule.operator === 'gt') return n1 > n2;
      if (rule.operator === 'gte') return n1 >= n2;
      if (rule.operator === 'lt') return n1 < n2;
      return n1 <= n2;
    }
    default:
      return false;
  }
}

export function evaluateConditionSet(
  set: FormConditionSet | null | undefined,
  answers: Record<string, unknown>,
  visibleQuestionIds: Set<string>,
  questionById: Map<string, FormQuestion>,
): boolean {
  if (!set || !set.enabled || !set.groups.length) return true;
  const evalGroup = (g: FormConditionGroup) => {
    if (!g.rules.length) return true;
    return g.match === 'any'
      ? g.rules.some((r) => evaluateConditionRule(r, answers, visibleQuestionIds, questionById))
      : g.rules.every((r) => evaluateConditionRule(r, answers, visibleQuestionIds, questionById));
  };
  return set.match === 'any' ? set.groups.some(evalGroup) : set.groups.every(evalGroup);
}

export interface EvaluatedFormLogic {
  visibleQuestions: FormQuestion[];
  visibleQuestionIds: Set<string>;
  requiredQuestionIds: Set<string>;
  visibleOptionsByQuestion: Map<string, FormOption[]>;
  disabledOptionIdsByQuestion: Map<string, Set<string>>;
  fullQuotaOptionIdsByQuestion: Map<string, Set<string>>;
  endedEarly: boolean;
  endNotice: string | null;
}

/** Deterministic top-to-bottom evaluation of question visibility, conditional requirements, option visibility, quotas, and branching. */
export function evaluateFormLogic(
  form: Pick<FormDefinition, 'questions'>,
  answers: Record<string, unknown>,
  opts?: { optionCounts?: Record<string, Record<string, number>> },
): EvaluatedFormLogic {
  const questions = form.questions || [];
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const indexById = new Map(questions.map((q, i) => [q.id, i]));

  const visibleQuestions: FormQuestion[] = [];
  const visibleQuestionIds = new Set<string>();
  const requiredQuestionIds = new Set<string>();
  const visibleOptionsByQuestion = new Map<string, FormOption[]>();
  const disabledOptionIdsByQuestion = new Map<string, Set<string>>();
  const fullQuotaOptionIdsByQuestion = new Map<string, Set<string>>();

  let skipUntilIndex = -1;
  let endedEarly = false;
  let endNotice: string | null = null;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (endedEarly || i < skipUntilIndex) continue;

    if (q.condition?.enabled && !evaluateConditionSet(q.condition, answers, visibleQuestionIds, questionById)) {
      continue;
    }

    visibleQuestions.push(q);
    visibleQuestionIds.add(q.id);

    const isReq = q.requiredCondition?.enabled
      ? evaluateConditionSet(q.requiredCondition, answers, visibleQuestionIds, questionById)
      : Boolean(q.required);
    if (isReq) requiredQuestionIds.add(q.id);

    if (CHOICE_QUESTION_TYPES.includes(q.type)) {
      const qCounts = opts?.optionCounts?.[q.id] || {};
      const visibleOpts: FormOption[] = [];
      const disabledIds = new Set<string>();
      const fullQuotaIds = new Set<string>();

      for (const o of q.options || []) {
        if (o.condition?.enabled && !evaluateConditionSet(o.condition, answers, visibleQuestionIds, questionById)) {
          continue;
        }
        const used = qCounts[o.id] || 0;
        const quotaFull = Boolean(o.maxChoices && o.maxChoices > 0 && used >= o.maxChoices);
        if (quotaFull) fullQuotaIds.add(o.id);
        if (quotaFull && o.quotaFullBehavior === 'hide') {
          continue;
        }
        visibleOpts.push(o);
        if (o.disabled || quotaFull) {
          disabledIds.add(o.id);
        }
      }

      visibleOptionsByQuestion.set(q.id, visibleOpts);
      disabledOptionIdsByQuestion.set(q.id, disabledIds);
      fullQuotaOptionIdsByQuestion.set(q.id, fullQuotaIds);

      if (q.type === 'single_choice' || q.type === 'dropdown') {
        const picked = answers[q.id];
        const pickedId = typeof picked === 'string' ? picked : '';
        const opt = pickedId ? visibleOpts.find((o) => o.id === pickedId && !disabledIds.has(o.id)) : undefined;
        if (opt?.action === 'end_form') {
          endedEarly = true;
          endNotice = opt.endMessage || null;
        } else if (opt?.action === 'skip_to' && opt.skipToQuestionId) {
          const targetIdx = indexById.get(opt.skipToQuestionId);
          if (targetIdx !== undefined && targetIdx > i) {
            skipUntilIndex = Math.max(skipUntilIndex, targetIdx);
          }
        }
      }
    }
  }

  return {
    visibleQuestions,
    visibleQuestionIds,
    requiredQuestionIds,
    visibleOptionsByQuestion,
    disabledOptionIdsByQuestion,
    fullQuotaOptionIdsByQuestion,
    endedEarly,
    endNotice,
  };
}

/** Human-readable Thai summary of a condition set (used in admin UI). */
export function describeConditionSet(set: FormConditionSet | null | undefined, questions: FormQuestion[]): string {
  if (!set || !set.enabled || !set.groups.length) return '';
  const qIndex = new Map(questions.map((q, i) => [q.id, i]));
  const qById = new Map(questions.map((q) => [q.id, q]));

  const formatRule = (r: FormConditionRule) => {
    const q = qById.get(r.questionId);
    const idx = qIndex.get(r.questionId);
    const qName = idx !== undefined ? `ข้อ ${idx + 1}` : 'คำถาม';
    const opLabel = CONDITION_OPERATOR_LABELS[r.operator] || r.operator;
    if (r.operator === 'is_empty' || r.operator === 'is_not_empty') return `${qName} ${opLabel}`;

    const resolveVal = (v: string) => {
      if (q?.options?.length) {
        const opt = q.options.find((o) => o.id === v);
        if (opt) return `"${opt.label}"`;
      }
      if (q?.type === 'rating') return `${v} ดาว`;
      return `"${v}"`;
    };

    const vals = r.values?.length ? r.values : r.value !== undefined ? [r.value] : [];
    const valStr = vals.length ? vals.map(resolveVal).join(', ') : '...';
    return `${qName} ${opLabel} ${valStr}`;
  };

  const groupStrs = set.groups
    .filter((g) => g.rules.length > 0)
    .map((g) => {
      const inner = g.rules.map(formatRule).join(g.match === 'any' ? ' หรือ ' : ' และ ');
      return set.groups.length > 1 && g.rules.length > 1 ? `(${inner})` : inner;
    });

  return groupStrs.join(set.match === 'any' ? ' หรือ ' : ' และ ');
}

export function formHasOptionQuotas(form: Pick<FormDefinition, 'questions'>): boolean {
  return (form.questions || []).some(
    (q) => CHOICE_QUESTION_TYPES.includes(q.type) && (q.options || []).some((o) => Boolean(o.maxChoices && o.maxChoices > 0)),
  );
}

// ───────────── Answer validation ─────────────

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;

export function validateTextFieldValue(q: FormQuestion, text: string): string | null {
  const v = q.validation;
  if (!v) return null;
  if (v.minLength && text.length < v.minLength) {
    return v.patternMessage || `กรุณาพิมพ์อย่างน้อย ${v.minLength} ตัวอักษร: ${q.title}`;
  }
  if (v.maxLength && text.length > v.maxLength) {
    return v.patternMessage || `พิมพ์ได้ไม่เกิน ${v.maxLength} ตัวอักษร: ${q.title}`;
  }
  switch (v.format) {
    case 'number': {
      if (!NUMBER_RE.test(text)) return v.patternMessage || `กรุณาระบุตัวเลขที่ถูกต้อง: ${q.title}`;
      const n = Number(text);
      if (v.minValue !== undefined && n < v.minValue) return v.patternMessage || `ค่าต้องไม่น้อยกว่า ${v.minValue}: ${q.title}`;
      if (v.maxValue !== undefined && n > v.maxValue) return v.patternMessage || `ค่าต้องไม่เกิน ${v.maxValue}: ${q.title}`;
      break;
    }
    case 'email':
      if (!EMAIL_RE.test(text)) return v.patternMessage || `กรุณาระบุอีเมลที่ถูกต้อง: ${q.title}`;
      break;
    case 'phone':
      if (!PHONE_RE.test(text)) return v.patternMessage || `กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง: ${q.title}`;
      break;
    case 'url':
      if (!URL_RE.test(text)) return v.patternMessage || `กรุณาระบุลิงก์ URL (ขึ้นต้นด้วย http:// หรือ https://): ${q.title}`;
      break;
    case 'regex':
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(text)) {
            return v.patternMessage || `รูปแบบข้อมูลไม่ถูกต้อง: ${q.title}`;
          }
        } catch {
          // ignore malformed regex at runtime
        }
      }
      break;
  }
  return null;
}

/** Validate a respondent's answers against the form, conditions, and quotas. Returns cleaned answers or an error message. */
export function validateFormAnswers(
  form: FormDefinition,
  input: unknown,
  opts?: { optionCounts?: Record<string, Record<string, number>> },
): { ok: true; answers: FormAnswers } | { ok: false; error: string; questionId?: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const logic = evaluateFormLogic(form, raw, { optionCounts: opts?.optionCounts });
  const answers: FormAnswers = {};

  for (const q of logic.visibleQuestions) {
    const value = raw[q.id];
    const empty = isAnswerEmptyValue(value);
    const required = logic.requiredQuestionIds.has(q.id);

    if (empty) {
      if (required) return { ok: false, error: `กรุณาตอบ: ${q.title}`, questionId: q.id };
      continue;
    }

    const visibleOpts = logic.visibleOptionsByQuestion.get(q.id) || [];
    const visibleById = new Map(visibleOpts.map((o) => [o.id, o]));
    const disabledIds = logic.disabledOptionIdsByQuestion.get(q.id) || new Set<string>();
    const fullQuotaIds = logic.fullQuotaOptionIdsByQuestion.get(q.id) || new Set<string>();
    const allById = new Map((q.options || []).map((o) => [o.id, o]));

    const checkOptionPick = (id: string): string | null => {
      if (fullQuotaIds.has(id)) {
        const opt = allById.get(id);
        return `ตัวเลือก "${opt?.label || id}" เต็มจำนวนแล้ว: ${q.title}`;
      }
      if (!visibleById.has(id)) {
        return `ตัวเลือกไม่ถูกต้องหรือไม่ตรงเงื่อนไข: ${q.title}`;
      }
      if (disabledIds.has(id)) {
        const opt = visibleById.get(id);
        return `ตัวเลือก "${opt?.label || id}" ปิดรับชั่วคราว: ${q.title}`;
      }
      return null;
    };

    const otherId = visibleOpts.find((o) => o.other)?.id;
    const keepExtras = (picked: string[]): string | null => {
      if (otherId && picked.includes(otherId)) {
        const text = clip(raw[otherAnswerKey(q.id)], FORM_LIMITS.maxOtherText);
        if (!text) return `กรุณาระบุคำตอบ "อื่น ๆ": ${q.title}`;
        answers[otherAnswerKey(q.id)] = text;
      }
      for (const id of picked) {
        const opt = visibleById.get(id);
        if (opt?.requireDetail && !opt.other) {
          const dKey = optionDetailAnswerKey(q.id, opt.id);
          const text = clip(raw[dKey], FORM_LIMITS.maxOtherText);
          if (!text) return `กรุณาระบุรายละเอียดเพิ่มเติมสำหรับ "${opt.label}": ${q.title}`;
          answers[dKey] = text;
        }
      }
      return null;
    };

    switch (q.type) {
      case 'short_text': {
        const clipped = clip(value, q.validation?.maxLength ? Math.min(FORM_LIMITS.maxShortText, q.validation.maxLength) : FORM_LIMITS.maxShortText);
        const err = validateTextFieldValue(q, clipped);
        if (err) return { ok: false, error: err, questionId: q.id };
        answers[q.id] = clipped;
        break;
      }
      case 'long_text': {
        const clipped = clip(value, q.validation?.maxLength ? Math.min(FORM_LIMITS.maxLongText, q.validation.maxLength) : FORM_LIMITS.maxLongText);
        const err = validateTextFieldValue(q, clipped);
        if (err) return { ok: false, error: err, questionId: q.id };
        answers[q.id] = clipped;
        break;
      }
      case 'single_choice':
      case 'dropdown': {
        const v = String(value);
        const pickErr = checkOptionPick(v);
        if (pickErr) return { ok: false, error: pickErr, questionId: q.id };
        const extraErr = keepExtras([v]);
        if (extraErr) return { ok: false, error: extraErr, questionId: q.id };
        answers[q.id] = v;
        break;
      }
      case 'multiple_choice': {
        const arr = Array.from(new Set((Array.isArray(value) ? value : [value]).map(String)));
        for (const id of arr) {
          const pickErr = checkOptionPick(id);
          if (pickErr) return { ok: false, error: pickErr, questionId: q.id };
        }
        const hasExclusive = arr.some((id) => visibleById.get(id)?.exclusive);
        if (arr.length > 1 && hasExclusive) {
          const ex = arr.map((id) => visibleById.get(id)).find((o) => o?.exclusive);
          return { ok: false, error: `ตัวเลือก "${ex?.label}" ไม่สามารถเลือกพร้อมข้ออื่นได้: ${q.title}`, questionId: q.id };
        }
        if (q.minSelections && !hasExclusive && arr.length < q.minSelections) {
          return { ok: false, error: `กรุณาเลือกอย่างน้อย ${q.minSelections} ข้อ: ${q.title}`, questionId: q.id };
        }
        if (q.maxSelections && arr.length > q.maxSelections) {
          return { ok: false, error: `เลือกได้ไม่เกิน ${q.maxSelections} ข้อ: ${q.title}`, questionId: q.id };
        }
        const extraErr = keepExtras(arr);
        if (extraErr) return { ok: false, error: extraErr, questionId: q.id };
        answers[q.id] = arr;
        break;
      }
      case 'rating': {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n) || n < 1 || n > 5) return { ok: false, error: `คะแนนต้องอยู่ระหว่าง 1–5: ${q.title}`, questionId: q.id };
        answers[q.id] = n;
        break;
      }
      case 'date': {
        const v = String(value).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `วันที่ไม่ถูกต้อง: ${q.title}`, questionId: q.id };
        answers[q.id] = v;
        break;
      }
    }
  }
  return { ok: true, answers };
}

/** Aggregate responses for charts. `includeTexts` = admin view (free-text answers). */
export function summarizeForm(form: FormDefinition, responses: FormResponse[], includeTexts = true): FormSummary {
  const questions: QuestionSummary[] = form.questions.map((q) => {
    const s: QuestionSummary = { questionId: q.id, type: q.type, title: q.title, answered: 0 };
    if (CHOICE_QUESTION_TYPES.includes(q.type)) {
      s.counts = Object.fromEntries((q.options || []).map((o) => [o.id, 0]));
    }
    if (q.type === 'rating') s.counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    if (includeTexts && (q.type === 'short_text' || q.type === 'long_text' || q.type === 'date')) s.texts = [];
    if (includeTexts && q.options?.some((o) => o.other || o.requireDetail)) s.otherTexts = [];
    return s;
  });

  const byId = new Map(questions.map((s) => [s.questionId, s]));
  const ratingSums = new Map<string, number>();
  let pdpaAcceptedCount = 0;
  let marketingAcceptedCount = 0;

  for (const r of responses) {
    if (r.pdpaConsent?.accepted) pdpaAcceptedCount += 1;
    if (r.pdpaConsent?.marketingAccepted) marketingAcceptedCount += 1;

    for (const q of form.questions) {
      const v = r.answers?.[q.id];
      if (v === undefined || v === null || v === '') continue;
      const s = byId.get(q.id)!;
      s.answered += 1;
      if (s.counts && q.type !== 'rating') {
        const pickedIds = Array.isArray(v) ? v : [String(v)];
        for (const id of pickedIds) {
          if (id in s.counts) s.counts[id] += 1;
        }
        if (s.otherTexts) {
          const other = r.answers?.[otherAnswerKey(q.id)];
          if (typeof other === 'string' && other && s.otherTexts.length < 500) s.otherTexts.push(other);
          for (const opt of q.options || []) {
            if (opt.requireDetail && !opt.other && pickedIds.includes(opt.id)) {
              const det = r.answers?.[optionDetailAnswerKey(q.id, opt.id)];
              if (typeof det === 'string' && det && s.otherTexts.length < 500) {
                s.otherTexts.push(`${opt.label}: ${det}`);
              }
            }
          }
        }
      } else if (q.type === 'rating') {
        const n = Number(v);
        if (s.counts && String(n) in s.counts) s.counts[String(n)] += 1;
        ratingSums.set(q.id, (ratingSums.get(q.id) || 0) + n);
      } else if (s.texts && s.texts.length < 500) {
        s.texts.push(String(v));
      }
    }
  }

  for (const s of questions) {
    if (s.type === 'rating' && s.answered > 0) {
      s.average = Math.round(((ratingSums.get(s.questionId) || 0) / s.answered) * 100) / 100;
    }
  }

  return {
    formId: form.id,
    totalResponses: responses.length,
    pdpaAcceptedCount,
    marketingAcceptedCount,
    questions,
  };
}

/** Human-readable answer (option labels instead of ids) — used for tables / CSV. */
export function formatAnswer(
  question: FormQuestion,
  value: FormAnswerValue | undefined,
  otherText?: FormAnswerValue,
  allAnswers?: FormAnswers,
): string {
  if (value === undefined || value === null || value === '') return '';
  if (CHOICE_QUESTION_TYPES.includes(question.type)) {
    const byId = new Map((question.options || []).map((o) => [o.id, o]));
    return (Array.isArray(value) ? value : [String(value)])
      .map((id) => {
        const o = byId.get(String(id));
        if (o?.other && typeof otherText === 'string' && otherText) return `อื่น ๆ: ${otherText}`;
        if (o?.requireDetail && !o.other && allAnswers) {
          const det = allAnswers[optionDetailAnswerKey(question.id, o.id)];
          if (typeof det === 'string' && det) return `${o.label} (${det})`;
        }
        return o?.label || String(id);
      })
      .join(', ');
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}
