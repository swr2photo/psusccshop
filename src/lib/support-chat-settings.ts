/** Shared support-chat settings types, defaults, and helpers. */

export type QuickReplyCategory = 'greeting' | 'payment' | 'shipping' | 'general';

export type QuickReplyItem = {
  id: string;
  text: string;
  /** Slash alias without leading slash, e.g. "hello" */
  slash: string;
  category: QuickReplyCategory;
};

export type NotificationSoundId = 'chime' | 'bubble' | 'bell';

export type SupportChatSettings = {
  admin_display_name: string;
  auto_reply_enabled: boolean;
  auto_reply_message: string;
  working_hours_enabled: boolean;
  working_hours_start: string;
  working_hours_end: string;
  /** 0=Sun … 6=Sat */
  working_days: number[];
  working_hours_message: string;
  quick_replies: QuickReplyItem[];
  notification_sound: boolean;
  notification_sound_id: NotificationSoundId;
  notification_desktop: boolean;
  auto_assign_enabled: boolean;
  /** Round-robin cursor into admin pool */
  auto_assign_cursor: number;
  auto_close_enabled: boolean;
  /** Close active chats after this many hours of customer silence */
  auto_close_hours: number;
};

export const QUICK_REPLY_CATEGORIES: Array<{ id: QuickReplyCategory; label: string }> = [
  { id: 'greeting', label: 'ทักทาย' },
  { id: 'payment', label: 'ชำระเงิน' },
  { id: 'shipping', label: 'การจัดส่ง' },
  { id: 'general', label: 'ทั่วไป' },
];

export const NOTIFICATION_SOUNDS: Array<{ id: NotificationSoundId; label: string }> = [
  { id: 'chime', label: 'Chime' },
  { id: 'bubble', label: 'Bubble' },
  { id: 'bell', label: 'Bell' },
];

export const DEFAULT_SUPPORT_CHAT_SETTINGS: SupportChatSettings = {
  admin_display_name: 'ทีมงาน PSU SCC',
  auto_reply_enabled: true,
  auto_reply_message: 'ขอบคุณที่ติดต่อมา ทีมงานจะตอบกลับโดยเร็วที่สุดค่ะ',
  working_hours_enabled: false,
  working_hours_start: '09:00',
  working_hours_end: '18:00',
  working_days: [1, 2, 3, 4, 5],
  working_hours_message:
    'ขณะนี้อยู่นอกเวลาทำการ ทีมงานจะตอบกลับในวันถัดไปเวลา 09:00 น. นัดหมายไว้ก่อนได้เลยค่ะ',
  quick_replies: [
    { id: 'qr_hello', text: 'สวัสดีค่ะ มีอะไรให้ช่วยเหลือคะ?', slash: 'hello', category: 'greeting' },
    { id: 'qr_wait', text: 'รอสักครู่นะคะ กำลังตรวจสอบให้', slash: 'wait', category: 'general' },
    { id: 'qr_thanks', text: 'ขอบคุณที่รอค่ะ', slash: 'thanks', category: 'general' },
    { id: 'qr_welcome', text: 'ยินดีให้บริการค่ะ', slash: 'welcome', category: 'greeting' },
  ],
  notification_sound: true,
  notification_sound_id: 'chime',
  notification_desktop: true,
  auto_assign_enabled: false,
  auto_assign_cursor: 0,
  auto_close_enabled: false,
  auto_close_hours: 48,
};

function newId() {
  return `qr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function slugifySlash(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .replace(/^\//, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 24);
  return cleaned || fallback;
}

function inferCategory(text: string): QuickReplyCategory {
  const t = text.toLowerCase();
  if (/สวัสดี|hello|hi|หวัดดี|ยินดี/.test(t)) return 'greeting';
  if (/โอน|บัญชี|ชำระ|payment|slip|สลิป|เงิน/.test(t)) return 'payment';
  if (/จัดส่ง|shipping|พัสดุ|ems|kerry|ไปรษณีย์|tracking/.test(t)) return 'shipping';
  return 'general';
}

function inferSlash(text: string, index: number): string {
  if (/สวัสดี|hello|hi/.test(text)) return 'hello';
  if (/รอสักครู่|รอสักครู|wait/.test(text)) return 'wait';
  if (/ขอบคุณ/.test(text)) return 'thanks';
  if (/ยินดี/.test(text)) return 'welcome';
  if (/โอน|บัญชี|ชำระ/.test(text)) return 'account';
  if (/จัดส่ง|shipping|พัสดุ/.test(text)) return 'ship';
  if (/คำถาม|question|เพิ่มเติม|more|สอบถาม/.test(text)) return 'question';
  // Prefer a short readable alias over bare numbers like /4
  const latin = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .find((w) => w.length >= 2);
  if (latin) return latin.slice(0, 16);
  return `reply${index + 1}`;
}

/** Normalize legacy string[] quick_replies and partial settings payloads. */
export function normalizeSupportChatSettings(raw: unknown): SupportChatSettings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = { ...DEFAULT_SUPPORT_CHAT_SETTINGS, ...input } as SupportChatSettings & {
    quick_replies: unknown;
  };

  const repliesRaw = Array.isArray(input.quick_replies)
    ? input.quick_replies
    : DEFAULT_SUPPORT_CHAT_SETTINGS.quick_replies;

  const usedSlashes = new Set<string>();
  const quick_replies: QuickReplyItem[] = repliesRaw.map((item, i) => {
    if (typeof item === 'string') {
      let slash = inferSlash(item, i);
      if (usedSlashes.has(slash)) slash = `${slash}${i + 1}`;
      usedSlashes.add(slash);
      return {
        id: newId(),
        text: item,
        slash,
        category: inferCategory(item),
      };
    }
    const obj = (item || {}) as Partial<QuickReplyItem>;
    // Rewrite bare numeric aliases (e.g. "/4") to semantic ones from message text
    let slash = slugifySlash(obj.slash || '', '');
    if (!slash || /^\d+$/.test(slash)) {
      slash = inferSlash(String(obj.text || ''), i);
    }
    if (usedSlashes.has(slash)) slash = `${slash}${i + 1}`;
    usedSlashes.add(slash);
    return {
      id: obj.id || newId(),
      text: String(obj.text || ''),
      slash,
      category: (obj.category as QuickReplyCategory) || inferCategory(String(obj.text || '')),
    };
  });

  const days = Array.isArray(input.working_days)
    ? (input.working_days as number[]).filter((d) => d >= 0 && d <= 6)
    : DEFAULT_SUPPORT_CHAT_SETTINGS.working_days;

  const soundId = (input.notification_sound_id as NotificationSoundId) || 'chime';

  return {
    ...DEFAULT_SUPPORT_CHAT_SETTINGS,
    ...base,
    quick_replies,
    working_days: days.length ? days : DEFAULT_SUPPORT_CHAT_SETTINGS.working_days,
    notification_sound_id: ['chime', 'bubble', 'bell'].includes(soundId) ? soundId : 'chime',
    auto_assign_cursor: Number(base.auto_assign_cursor) || 0,
    auto_close_hours: Math.max(1, Number(base.auto_close_hours) || 48),
  };
}

export function createEmptyQuickReply(category: QuickReplyCategory = 'general'): QuickReplyItem {
  return {
    id: newId(),
    text: '',
    slash: '',
    category,
  };
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Bangkok-local wall clock check against configured hours/days. */
export function isWithinWorkingHours(
  settings: Pick<
    SupportChatSettings,
    'working_hours_enabled' | 'working_hours_start' | 'working_hours_end' | 'working_days'
  >,
  now = new Date()
): boolean {
  if (!settings.working_hours_enabled) return true;

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = dayMap[weekday] ?? 1;
  if (!settings.working_days.includes(day)) return false;

  const cur = hour * 60 + minute;
  const start = parseHm(settings.working_hours_start);
  const end = parseHm(settings.working_hours_end);
  if (end <= start) {
    // overnight window e.g. 22:00–06:00
    return cur >= start || cur < end;
  }
  return cur >= start && cur < end;
}

export function resolveAutoReplyMessage(settings: SupportChatSettings): string | null {
  if (!settings.auto_reply_enabled) return null;
  if (settings.working_hours_enabled && !isWithinWorkingHours(settings)) {
    return settings.working_hours_message?.trim() || settings.auto_reply_message?.trim() || null;
  }
  return settings.auto_reply_message?.trim() || null;
}

export function quickReplyTexts(settings: SupportChatSettings): string[] {
  return settings.quick_replies.map((r) => r.text).filter(Boolean);
}

/** Play a short UI tone without external audio files. */
export function playNotificationTone(id: NotificationSoundId = 'chime') {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  const beep = (freq: number, start: number, dur: number, type: OscillatorType, gain = 0.08) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + start);
    g.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };

  if (id === 'bubble') {
    beep(520, 0, 0.08, 'sine', 0.06);
    beep(380, 0.07, 0.1, 'sine', 0.05);
  } else if (id === 'bell') {
    beep(880, 0, 0.25, 'triangle', 0.07);
    beep(1320, 0.02, 0.2, 'sine', 0.04);
  } else {
    beep(660, 0, 0.12, 'sine', 0.07);
    beep(990, 0.1, 0.16, 'sine', 0.06);
  }

  window.setTimeout(() => void ctx.close(), 800);
}
