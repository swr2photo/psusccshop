/** Shared chat media token parsing (stickers, images, voice, order refs) */

import { isAnimatedImageUrl } from '@/lib/chat-stickers';

export type ParsedChatMessage = {
  text: string;
  imageUrl: string | null;
  animated: boolean;
  voiceUrl: string | null;
  voiceDuration: number | null;
  orderRef: string | null;
  /** True when payload looks like a truncated voice token (e.g. realtime TOAST cut) */
  voiceBroken: boolean;
};

const VOICE_TOKEN_RE =
  /\[เสียง:\s*(data:(?:audio|video)\/[^\]|]+|\/api\/(?:image|voice)\/[^\]|]+|https?:\/\/[^\]|]+|\/[^\|\]]+)(?:\|(\d+))?\]/;
const STICKER_TOKEN_RE =
  /\[สติกเกอร์:\s*(\/api\/image\/[^\]]+|\/chat-stickers\/[^\]]+|https?:\/\/[^\]]+|\/[^\]]+)\]/;
const IMAGE_TOKEN_RE =
  /\[รูปภาพ:\s*(\/api\/image\/[^\]]+|\/chat-stickers\/[^\]]+|https?:\/\/[^\]]+|\/[^\]]+)\]/;
const ORDER_TOKEN_RE = /\[ORDER_REF:([^\]]+)\]/;

/** Detect truncated / corrupted voice payloads that should not render as raw base64 */
function looksLikeBrokenVoice(msg: string): boolean {
  if (!msg) return false;
  if (VOICE_TOKEN_RE.test(msg)) return false;
  if (/\[เสียง:/.test(msg)) return true;
  // Truncated realtime payload: mid-base64 ending with |N]
  if (/\|(\d{1,4})\]\s*$/.test(msg) && /[A-Za-z0-9+/=]{24,}/.test(msg) && !msg.includes('[สติกเกอร์:') && !msg.includes('[รูปภาพ:')) {
    return true;
  }
  return false;
}

export function parseChatMessage(msg: string): ParsedChatMessage {
  if (!msg || typeof msg !== 'string') {
    return {
      text: '',
      imageUrl: null,
      animated: false,
      voiceUrl: null,
      voiceDuration: null,
      orderRef: null,
      voiceBroken: false,
    };
  }

  let text = msg;
  let imageUrl: string | null = null;
  let animated = false;
  let voiceUrl: string | null = null;
  let voiceDuration: number | null = null;
  let orderRef: string | null = null;
  let voiceBroken = false;

  const voiceMatch = msg.match(VOICE_TOKEN_RE);
  if (voiceMatch) {
    voiceUrl = voiceMatch[1].replace(/\s/g, '');
    voiceDuration = voiceMatch[2] ? Number(voiceMatch[2]) : null;
    text = text.replace(voiceMatch[0], '').trim();
  } else if (looksLikeBrokenVoice(msg)) {
    voiceBroken = true;
    text = '';
  } else {
    const stickerMatch = msg.match(STICKER_TOKEN_RE);
    if (stickerMatch) {
      imageUrl = stickerMatch[1].trim();
      animated = true;
      text = text.replace(stickerMatch[0], '').trim();
    } else {
      const imageMatch = msg.match(IMAGE_TOKEN_RE);
      if (imageMatch) {
        imageUrl = imageMatch[1].trim();
        animated = isAnimatedImageUrl(imageUrl);
        text = text.replace(imageMatch[0], '').trim();
      }
    }
  }

  const orderMatch = msg.match(ORDER_TOKEN_RE);
  if (orderMatch) {
    orderRef = orderMatch[1];
    text = text.replace(orderMatch[0], '').trim();
  }

  return { text, imageUrl, animated, voiceUrl, voiceDuration, orderRef, voiceBroken };
}

/** Prefer keeping a fuller local copy when realtime delivers a truncated row */
export function preferCompleteMessage(existing: string, incoming: string): string {
  if (!existing) return incoming || '';
  if (!incoming) return existing;
  if (existing === incoming) return existing;

  const existingOk = Boolean(existing.match(VOICE_TOKEN_RE) || existing.match(STICKER_TOKEN_RE) || existing.match(IMAGE_TOKEN_RE));
  const incomingBroken = looksLikeBrokenVoice(incoming) || (incoming.length + 64 < existing.length && existingOk);

  if (incomingBroken && existing.length >= incoming.length) return existing;
  if (existing.startsWith('[เสียง:') && !incoming.startsWith('[เสียง:') && existing.length > incoming.length) {
    return existing;
  }
  if (existing.length > incoming.length + 100 && /\[(?:เสียง|สติกเกอร์|รูปภาพ):/.test(existing)) {
    return existing;
  }
  return incoming;
}
