/** Chat voice message helpers */

export function formatVoiceMessage(url: string, durationSec: number): string {
  const sec = Math.max(1, Math.round(durationSec));
  return `[เสียง: ${url}|${sec}]`;
}

/** @deprecated Use parseChatMessage from '@/lib/chat-message' */
export function parseVoiceToken(msg: string): {
  text: string;
  voiceUrl: string | null;
  voiceDuration: number | null;
} {
  const match = msg.match(
    /\[เสียง:\s*(data:(?:audio|video)\/[^\]|]+|\/api\/(?:image|voice)\/[^\]|]+|https?:\/\/[^\]|]+)(?:\|(\d+))?\]/
  );
  if (!match) {
    return { text: msg, voiceUrl: null, voiceDuration: null };
  }
  return {
    text: msg.replace(match[0], '').trim(),
    voiceUrl: match[1].replace(/\s/g, ''),
    voiceDuration: match[2] ? Number(match[2]) : null,
  };
}

/**
 * Prefer storage URLs in chat messages.
 * Tiny data-URL fallback only when upload fails (keeps realtime payloads small).
 */
export const VOICE_DATA_URL_FALLBACK_MAX = 120_000;

export function formatVoiceDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function detectAudioContentType(buffer: Buffer | Uint8Array): string | null {
  if (buffer.length < 12) return null;
  const b = buffer;
  // EBML / WebM
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return 'audio/webm';
  }
  // Ogg
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
    return 'audio/ogg';
  }
  // RIFF WAVE
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45
  ) {
    return 'audio/wav';
  }
  // ftyp (mp4 / m4a)
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    return 'audio/mp4';
  }
  // ID3 / MPEG
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg';
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return null;
}
