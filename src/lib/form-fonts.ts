// Google Fonts that support Thai, selectable per form.

export type FormFontCategory = 'sans' | 'serif' | 'display';

export interface FormFont {
  family: string;
  category: FormFontCategory;
  /** Weights the family actually ships (Google Fonts rejects requests for missing weights) */
  weights: number[];
  note?: string;
}

const W4_7 = [400, 500, 600, 700];
const W4_8 = [400, 500, 600, 700, 800];
const W4_9 = [400, 500, 600, 700, 800, 900];

export const FORM_FONTS: FormFont[] = [
  { family: 'Sarabun', category: 'sans', weights: W4_8, note: 'ทางการ อ่านง่าย' },
  { family: 'Prompt', category: 'sans', weights: W4_9, note: 'ทันสมัย' },
  { family: 'Kanit', category: 'sans', weights: W4_9, note: 'หัวเรื่องหนักแน่น' },
  { family: 'Noto Sans Thai', category: 'sans', weights: W4_9 },
  { family: 'Noto Sans Thai Looped', category: 'sans', weights: W4_7, note: 'มีหัว อ่านง่าย' },
  { family: 'IBM Plex Sans Thai', category: 'sans', weights: W4_7, note: 'สายเทค' },
  { family: 'Anuphan', category: 'sans', weights: W4_7 },
  { family: 'Bai Jamjuree', category: 'sans', weights: W4_7 },
  { family: 'Chakra Petch', category: 'sans', weights: W4_7, note: 'เหลี่ยม เกมมิ่ง' },
  { family: 'K2D', category: 'sans', weights: W4_8 },
  { family: 'Kodchasan', category: 'sans', weights: W4_7, note: 'มน สดใส' },
  { family: 'Mitr', category: 'sans', weights: W4_7 },
  { family: 'Niramit', category: 'sans', weights: W4_7 },
  { family: 'Krub', category: 'sans', weights: W4_7 },
  { family: 'Athiti', category: 'sans', weights: W4_7 },
  { family: 'Pridi', category: 'serif', weights: W4_7, note: 'มีหัว' },
  { family: 'Trirong', category: 'serif', weights: W4_9 },
  { family: 'Taviraj', category: 'serif', weights: W4_9 },
  { family: 'Noto Serif Thai', category: 'serif', weights: W4_9 },
  { family: 'Maitree', category: 'serif', weights: W4_7, note: 'หนังสือ / ทางการ' },
  { family: 'Mali', category: 'display', weights: W4_7, note: 'น่ารัก' },
  { family: 'Playpen Sans Thai', category: 'display', weights: W4_7, note: 'ลายมือน่ารัก' },
  { family: 'Itim', category: 'display', weights: [400], note: 'ลายมือ' },
  { family: 'Sriracha', category: 'display', weights: [400], note: 'ลายมือเข้ม' },
  { family: 'Pattaya', category: 'display', weights: [400], note: 'หัวเรื่องโค้งมน' },
  { family: 'Charm', category: 'display', weights: [400, 700], note: 'ตัวเขียน' },
  { family: 'Chonburi', category: 'display', weights: [400], note: 'หัวเรื่อง' },
];

export const FORM_FONT_CATEGORY_LABEL: Record<FormFontCategory, string> = {
  sans: 'ไม่มีหัว',
  serif: 'มีหัว',
  display: 'ตกแต่ง / ลายมือ',
};

export function findFormFont(family?: string | null): FormFont | null {
  if (!family) return null;
  return FORM_FONTS.find((f) => f.family === family) || null;
}

/** Stylesheet URL for one family (all of its weights). */
export function googleFontCssUrl(font: FormFont): string {
  const fam = `${encodeURIComponent(font.family).replace(/%20/g, '+')}:wght@${font.weights.join(';')}`;
  return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
}

/** One small request that loads only the glyphs needed to preview every font in the picker. */
export function googleFontPreviewUrl(sample: string): string {
  const families = FORM_FONTS.map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}`).join('&');
  const text = Array.from(new Set(Array.from(sample + FORM_FONTS.map((f) => f.family).join('')))).join('');
  return `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(text)}&display=swap`;
}

/** CSS font-family value with Thai/system fallbacks (avoid undefined CSS vars that invalidate the rule). */
export function formFontStack(family?: string | null): string | undefined {
  const font = findFormFont(family);
  if (!font) return undefined;
  const generic = font.category === 'serif' ? 'serif' : 'sans-serif';
  return `"${font.family}", "Noto Sans Thai", system-ui, ${generic}`;
}
