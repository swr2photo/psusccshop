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

export type FlagshipHeroCopy = {
  /** Top-right tag on the hero rule (e.g. "ของชุมนุม / 2026") */
  topRightLabel?: string;
  /** Eyebrow above product name (e.g. "No. 01 — ของใหม่ประจำปี") */
  eyebrow?: string;
  /** Custom hero title override (defaults to linked product name or "เสื้อกีฬา SCC 2026") */
  title?: string;
  /** Hero description/subtitle (e.g. "พร้อมจองเสื้อกีฬา SCC 2026 — เลือกไซส์ ใส่ชื่อ และชำระง่าย") */
  subtitle?: string;
  /** Caption right label under the hero photo (e.g. "NEW JERSEY 2026") */
  captionRight?: string;
  /** Custom image URL override for the hero plate (optional; defaults to product coverImage) */
  heroImage?: string;
  /** Primary button label override when open (e.g. "สั่งจองเสื้อ") */
  ctaBuyLabel?: string;
  /** Secondary 360 link label override (e.g. "หมุนดูแบบ 360°") */
  cta360Label?: string;
  /** 4 numbered trust strip items under the hero (01 - 04) */
  highlights?: string[];
};

export type FlagshipProductConfig = {
  /** Whether the flagship page and its storefront links are active (default: true) */
  enabled?: boolean;
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
  /** Custom details and copy for the Home page Flagship Hero & Trust Strip */
  heroCopy?: {
    th: FlagshipHeroCopy;
    en: FlagshipHeroCopy;
  };
  stages: FlagshipLocalizedStages;
};

export const FLAGSHIP_PRODUCTS: Record<string, FlagshipProductConfig> = {
  'scc-jersey-2026': {
    enabled: true,
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
    heroCopy: {
      th: {
        topRightLabel: 'ของชุมนุม / 2026',
        eyebrow: 'No. 01 — ของใหม่ประจำปี',
        title: '',
        subtitle: 'พร้อมจองเสื้อกีฬา SCC 2026 — เลือกไซส์ ใส่ชื่อ และชำระง่าย',
        captionRight: 'NEW JERSEY 2026',
        heroImage: '',
        ctaBuyLabel: 'สั่งจองเสื้อ',
        cta360Label: 'หมุนดูแบบ 360°',
        highlights: [
          'เลือกไซส์ ใส่ชื่อได้',
          'จ่ายด้วย PromptPay + SlipOK',
          'รับที่ตึกคอมฯ',
          '500+ ออเดอร์',
        ],
      },
      en: {
        topRightLabel: 'Merch / 2026',
        eyebrow: 'No. 01 — New this season',
        title: '',
        subtitle: 'Pre-order the SCC 2026 jersey — pick a size, add your name, pay in a minute.',
        captionRight: 'NEW JERSEY 2026',
        heroImage: '',
        ctaBuyLabel: 'Order jersey',
        cta360Label: 'Spin it 360°',
        highlights: [
          'Pick a size, add your name',
          'Pay with PromptPay + SlipOK',
          'Pick up at CS dept.',
          '500+ orders',
        ],
      },
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
    enabled: dynamicCfg.enabled ?? base.enabled ?? true,
    brandLabel: {
      th: dynamicCfg.brandLabel?.th || base.brandLabel?.th || 'SCC Flagship',
      en: dynamicCfg.brandLabel?.en || base.brandLabel?.en || 'SCC Flagship',
    },
    heroCopy: {
      th: {
        ...(base.heroCopy?.th || {}),
        ...(dynamicCfg.heroCopy?.th || {}),
        highlights:
          dynamicCfg.heroCopy?.th?.highlights && dynamicCfg.heroCopy.th.highlights.length > 0
            ? dynamicCfg.heroCopy.th.highlights
            : (base.heroCopy?.th?.highlights || []),
      },
      en: {
        ...(base.heroCopy?.en || {}),
        ...(dynamicCfg.heroCopy?.en || {}),
        highlights:
          dynamicCfg.heroCopy?.en?.highlights && dynamicCfg.heroCopy.en.highlights.length > 0
            ? dynamicCfg.heroCopy.en.highlights
            : (base.heroCopy?.en?.highlights || []),
      },
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
