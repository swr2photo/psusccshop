import type { QuickReplyItem } from '@/lib/support-chat-settings';

export type QuickReplySlashItem = {
  alias: string;
  text: string;
  command: string;
  category?: string;
};

/** Build slash-command entries from configured quick replies (objects or legacy strings). */
export function buildQuickReplySlashItems(
  replies: Array<string | QuickReplyItem>
): QuickReplySlashItem[] {
  const used = new Set<string>();
  return replies
    .map((item, i) => {
      const text = typeof item === 'string' ? item.trim() : String(item?.text || '').trim();
      if (!text) return null;
      let alias =
        typeof item === 'string'
          ? ''
          : String(item.slash || '')
              .replace(/^\//, '')
              .toLowerCase()
              .replace(/[^a-z0-9_-]+/g, '');
      if (!alias || /^\d+$/.test(alias)) {
        if (/สวัสดี|hello|hi/i.test(text)) alias = 'hello';
        else if (/รอสักครู่|รอสักครู|wait/i.test(text)) alias = 'wait';
        else if (/ขอบคุณ|thanks/i.test(text)) alias = 'thanks';
        else if (/ยินดี|welcome/i.test(text)) alias = 'welcome';
        else if (/คำถาม|question|เพิ่มเติม|more|สอบถาม/i.test(text)) alias = 'question';
        else {
          const latin = text
            .toLowerCase()
            .replace(/[^a-z0-9\s_-]+/g, ' ')
            .trim()
            .split(/\s+/)
            .find((w) => w.length >= 2);
          alias = latin ? latin.slice(0, 16) : `reply${i + 1}`;
        }
      }
      if (used.has(alias)) alias = `${alias}${i + 1}`;
      used.add(alias);
      return {
        alias,
        text,
        command: `/${alias}`,
        category: typeof item === 'string' ? undefined : item.category,
      };
    })
    .filter(Boolean) as QuickReplySlashItem[];
}

/** Active `/query` at start of composer value (no trailing space yet). */
export function getSlashQuery(value: string): string | null {
  const m = value.match(/^\/([^\n]*)$/);
  if (!m) return null;
  return m[1].toLowerCase();
}

export function filterSlashItems(
  items: QuickReplySlashItem[],
  query: string
): QuickReplySlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.alias.startsWith(q) ||
      item.command.slice(1).startsWith(q) ||
      item.text.toLowerCase().includes(q) ||
      (item.category && item.category.startsWith(q))
  );
}
