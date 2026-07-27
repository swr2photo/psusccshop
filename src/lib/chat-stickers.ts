/** Built-in animated GIF sticker pack (served from /public/chat-stickers) */
export type ChatSticker = {
  id: string;
  label: string;
  emoji: string;
  src: string;
};

export const CHAT_STICKERS: ChatSticker[] = [
  { id: 'hi', label: 'ทักทาย', emoji: '👋', src: '/chat-stickers/hi.gif' },
  { id: 'wave', label: 'โบกมือ', emoji: '🌊', src: '/chat-stickers/wave.gif' },
  { id: 'love', label: 'รัก', emoji: '❤️', src: '/chat-stickers/love.gif' },
  { id: 'ok', label: 'โอเค', emoji: '👌', src: '/chat-stickers/ok.gif' },
  { id: 'yes', label: 'ใช่', emoji: '✅', src: '/chat-stickers/yes.gif' },
  { id: 'no', label: 'ไม่', emoji: '❌', src: '/chat-stickers/no.gif' },
  { id: 'thanks', label: 'ขอบคุณ', emoji: '🙏', src: '/chat-stickers/thanks.gif' },
  { id: 'clap', label: 'ปรบมือ', emoji: '👏', src: '/chat-stickers/clap.gif' },
  { id: 'party', label: 'ปาร์ตี้', emoji: '🎉', src: '/chat-stickers/party.gif' },
  { id: 'fire', label: 'ไฟ', emoji: '🔥', src: '/chat-stickers/fire.gif' },
  { id: 'wow', label: 'ว้าว', emoji: '🤩', src: '/chat-stickers/wow.gif' },
  { id: 'cry', label: 'ร้องไห้', emoji: '😢', src: '/chat-stickers/cry.gif' },
];

export function isChatStickerUrl(url: string): boolean {
  return url.startsWith('/chat-stickers/');
}

export function isAnimatedImageUrl(url: string): boolean {
  return /\.gif($|\?|#)/i.test(url) || isChatStickerUrl(url);
}

/** Message token for GIF stickers (keeps animation even via /api/image proxy) */
export function formatStickerMessage(url: string): string {
  return `[สติกเกอร์: ${url}]`;
}

/** @deprecated Use parseChatMessage from '@/lib/chat-message' */
export function parseChatMedia(msg: string): {
  text: string;
  imageUrl: string | null;
  animated: boolean;
} {
  const stickerMatch = msg.match(
    /\[สติกเกอร์:\s*(\/api\/image\/[^\]]+|\/chat-stickers\/[^\]]+|https?:\/\/[^\]]+)\]/
  );
  if (stickerMatch) {
    const imageUrl = stickerMatch[1];
    const text = msg.replace(stickerMatch[0], '').trim();
    return { text, imageUrl, animated: true };
  }

  const imageMatch = msg.match(
    /\[รูปภาพ:\s*(\/api\/image\/[^\]]+|\/chat-stickers\/[^\]]+|https?:\/\/[^\]]+)\]/
  );
  if (imageMatch) {
    const imageUrl = imageMatch[1];
    const text = msg.replace(imageMatch[0], '').trim();
    return {
      text,
      imageUrl,
      animated: isAnimatedImageUrl(imageUrl),
    };
  }

  return { text: msg, imageUrl: null, animated: false };
}
