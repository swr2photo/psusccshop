/**
 * Flagship scrollytelling product config.
 *
 * To add a new flagship experience:
 * 1. Add an entry to FLAGSHIP_PRODUCTS keyed by URL slug
 * 2. Point productId (or match rules) at a real catalog product
 * 3. Drop frame sequences under public/flagship/<slug>/frames/
 *    as frame_0001.webp … frame_NNNN.webp (or list explicit `frames`)
 *
 * Without frames, the canvas falls back to 1–3 product images with
 * scroll-linked scale / opacity / pan.
 */

export type FlagshipSide = 'left' | 'right';

export type FlagshipStageCopy = {
  title: string;
  body: string;
  side: FlagshipSide;
  /** Optional eyebrow above the title */
  eyebrow?: string;
};

export type FlagshipLocalizedStages = {
  th: FlagshipStageCopy[];
  en: FlagshipStageCopy[];
};

export type FlagshipProductConfig = {
  /** URL segment: /flagship/[slug] */
  slug: string;
  /** Preferred: exact product id from shop config */
  productId?: string;
  /**
   * Fallback matchers when productId is missing or not found
   * (useful before production ids are known).
   */
  match?: {
    slug?: string;
    idIncludes?: string[];
    nameIncludes?: string[];
  };
  /** Explicit frame URLs (preferred when not using folder pattern) */
  frames?: string[];
  /**
   * Folder under /public, e.g. `/flagship/scc-jersey-2026/frames`
   * Expects frame_0001.webp … frame_{frameCount}.webp (zero-padded to 4).
   */
  framesFolder?: string;
  /** Total frames in folder pattern (desktop). Default 60. */
  frameCount?: number;
  /** Frame filename extension. Default webp */
  frameExt?: 'webp' | 'jpg' | 'png' | 'jpeg';
  /** Desktop subsample step (1 = all). Default 1 */
  frameStep?: number;
  /** Mobile subsample step — fewer frames. Default 2 (~half) */
  mobileFrameStep?: number;
  /** Cap mobile frames to this count. Default 30 */
  mobileMaxFrames?: number;
  brandLabel?: { th: string; en: string };
  stages: FlagshipLocalizedStages;
};

export const FLAGSHIP_PRODUCTS: Record<string, FlagshipProductConfig> = {
  'scc-jersey-2026': {
    slug: 'scc-jersey-2026',
    productId: 'dev-jersey-1',
    match: {
      idIncludes: ['jersey', 'scc-2026', 'scc2026'],
      nameIncludes: ['SCC 2026', 'เสื้อกีฬา SCC', 'Jersey 2026'],
    },
    framesFolder: '/flagship/scc-jersey-2026/frames',
    frameCount: 60,
    frameExt: 'webp',
    frameStep: 1,
    mobileFrameStep: 2,
    mobileMaxFrames: 28,
    brandLabel: {
      th: 'SCC Flagship',
      en: 'SCC Flagship',
    },
    stages: {
      th: [
        {
          side: 'left',
          eyebrow: 'Stage 01',
          title: 'เผยโฉมเสื้อกีฬา',
          body: 'หมุนชมทุกรายละเอียด — ดีไซน์ที่ออกแบบมาเพื่อ SCC 2026',
        },
        {
          side: 'right',
          eyebrow: 'Cool Elite',
          title: 'เนื้อผ้า Cool Elite',
          body: 'ระบายอากาศได้ดี เบาสบาย เหมาะกับการเคลื่อนไหวตลอดวัน',
        },
        {
          side: 'left',
          eyebrow: 'Customize',
          title: 'ใส่ชื่อและเบอร์ของคุณ',
          body: 'สกรีนชื่อและหมายเลขด้านหลัง ให้เป็นตัวตนของคุณบนสนาม',
        },
        {
          side: 'right',
          eyebrow: 'Yours',
          title: 'เลือกไซส์ แล้วใส่ตะกร้า',
          body: 'เลือกขนาดที่พอดี แล้วเริ่มสั่งซื้อได้ทันที',
        },
      ],
      en: [
        {
          side: 'left',
          eyebrow: 'Stage 01',
          title: 'Reveal the jersey',
          body: 'Scroll to explore every angle — designed for SCC 2026.',
        },
        {
          side: 'right',
          eyebrow: 'Cool Elite',
          title: 'Cool Elite fabric',
          body: 'Breathable and lightweight — built to move with you all day.',
        },
        {
          side: 'left',
          eyebrow: 'Customize',
          title: 'Make it yours',
          body: 'Add your name and number on the back — your identity on the field.',
        },
        {
          side: 'right',
          eyebrow: 'Yours',
          title: 'Pick a size & add to cart',
          body: 'Choose your fit and order in one scroll.',
        },
      ],
    },
  },
};

export function getFlagshipConfig(slug: string): FlagshipProductConfig | null {
  return FLAGSHIP_PRODUCTS[slug] ?? null;
}

/** Merge static defaults with dynamic shop config from admin */
export function getMergedFlagshipConfig(
  slug: string,
  shopConfig?: { flagshipConfig?: Partial<FlagshipProductConfig>; flagshipConfigs?: Record<string, Partial<FlagshipProductConfig>> } | null
): FlagshipProductConfig {
  const base = FLAGSHIP_PRODUCTS[slug] || {
    slug,
    framesFolder: `/flagship/${slug}/frames`,
    frameCount: 60,
    frameExt: 'webp',
    frameStep: 1,
    mobileFrameStep: 2,
    mobileMaxFrames: 28,
    brandLabel: { th: 'SCC Flagship', en: 'SCC Flagship' },
    stages: { th: [], en: [] },
  };

  const dynamicCfg = shopConfig?.flagshipConfigs?.[slug] || (shopConfig?.flagshipConfig?.slug === slug ? shopConfig?.flagshipConfig : null) || shopConfig?.flagshipConfig;
  if (!dynamicCfg) return base;

  return {
    ...base,
    ...dynamicCfg,
    brandLabel: {
      th: dynamicCfg.brandLabel?.th || base.brandLabel?.th || 'SCC Flagship',
      en: dynamicCfg.brandLabel?.en || base.brandLabel?.en || 'SCC Flagship',
    },
    stages: {
      th: dynamicCfg.stages?.th && dynamicCfg.stages.th.length > 0 ? dynamicCfg.stages.th : base.stages.th,
      en: dynamicCfg.stages?.en && dynamicCfg.stages.en.length > 0 ? dynamicCfg.stages.en : base.stages.en,
    },
  };
}

export function listFlagshipSlugs(): string[] {
  return Object.keys(FLAGSHIP_PRODUCTS);
}

/** Resolve which flagship slug (if any) maps to a catalog product */
export function getFlagshipSlugForProduct(product: {
  id?: string;
  slug?: string;
  name?: string;
  nameEn?: string;
}): string | null {
  for (const cfg of Object.values(FLAGSHIP_PRODUCTS)) {
    if (cfg.productId && product.id === cfg.productId) return cfg.slug;
    if (cfg.match?.slug && product.slug === cfg.match.slug) return cfg.slug;
    if (cfg.match?.idIncludes?.some((frag) => product.id?.toLowerCase().includes(frag.toLowerCase()))) {
      return cfg.slug;
    }
    const names = `${product.name || ''} ${product.nameEn || ''}`.toLowerCase();
    if (cfg.match?.nameIncludes?.some((frag) => names.includes(frag.toLowerCase()))) {
      return cfg.slug;
    }
  }
  return null;
}

/**
 * Build frame URL list from config.
 * Returns [] when folder assets are not yet supplied — caller should use product-image fallback.
 */
export function buildFrameUrls(cfg: FlagshipProductConfig, opts?: { mobile?: boolean }): string[] {
  if (cfg.frames?.length) {
    const step = opts?.mobile ? (cfg.mobileFrameStep ?? 2) : (cfg.frameStep ?? 1);
    const max = opts?.mobile ? (cfg.mobileMaxFrames ?? 28) : Infinity;
    const sampled = cfg.frames.filter((_, i) => i % step === 0);
    return sampled.slice(0, max === Infinity ? undefined : max);
  }

  if (!cfg.framesFolder || !cfg.frameCount) return [];

  const ext = cfg.frameExt ?? 'webp';
  const step = opts?.mobile ? (cfg.mobileFrameStep ?? 2) : (cfg.frameStep ?? 1);
  const max = opts?.mobile ? (cfg.mobileMaxFrames ?? 28) : cfg.frameCount;
  const urls: string[] = [];
  for (let i = 1; i <= cfg.frameCount; i += step) {
    if (urls.length >= max) break;
    const n = String(i).padStart(4, '0');
    urls.push(`${cfg.framesFolder}/frame_${n}.${ext}`);
  }
  return urls;
}
