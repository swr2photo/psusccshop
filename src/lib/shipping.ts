// src/lib/shipping.ts
// Client-safe shipping types, constants, and pure helpers.
// Track123 / Thailand Post API I/O lives in `@/lib/shipping-server`.

// ==================== TYPES ====================

export type ShippingProvider = 
  | 'thailand_post'    // ไปรษณีย์ไทย
  | 'kerry'            // Kerry Express
  | 'jandt'            // J&T Express
  | 'flash'            // Flash Express
  | 'pickup'           // รับหน้าร้าน
  | 'custom';          // กำหนดเอง

export interface ShippingOption {
  id: string;
  provider: ShippingProvider;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  /** Base shipping fee */
  baseFee: number;
  /** Additional fee per item */
  perItemFee?: number;
  /** Free shipping threshold */
  freeShippingMinimum?: number;
  /** Estimated delivery days */
  estimatedDays?: { min: number; max: number };
  /** Is this option enabled */
  enabled: boolean;
  /** Tracking URL template (use {tracking} placeholder) */
  trackingUrlTemplate?: string;
  /** Track123 courier code */
  track123CourierCode?: string;
  /** Notes for admin */
  notes?: string;
}

export interface ShippingConfig {
  /** Default shipping option ID */
  defaultOptionId?: string;
  /** Available shipping options */
  options: ShippingOption[];
  /** Global free shipping minimum (overrides per-option) */
  globalFreeShippingMinimum?: number;
  /** Show shipping options to customer */
  showOptions: boolean;
  /** Allow pickup */
  allowPickup: boolean;
  /** Pickup location */
  pickupLocation?: string;
  /** Pickup instructions */
  pickupInstructions?: string;
}

export interface TrackingInfo {
  provider: ShippingProvider;
  trackingNumber: string;
  status: TrackingStatus;
  statusText: string;
  statusTextThai: string;
  lastUpdate: string;
  estimatedDelivery?: string;
  events: TrackingEvent[];
  rawResponse?: any;
  /** Tracking URL for external tracking page */
  trackingUrl?: string;
  /** Track123 tracking URL */
  track123Url?: string;
}

export type TrackingStatus = 
  | 'pending'           // รอรับพัสดุ
  | 'picked_up'         // รับพัสดุแล้ว
  | 'in_transit'        // กำลังจัดส่ง
  | 'out_for_delivery'  // กำลังนำส่ง
  | 'delivered'         // จัดส่งแล้ว
  | 'returned'          // ส่งคืน
  | 'failed'            // จัดส่งไม่สำเร็จ
  | 'unknown';          // ไม่ทราบสถานะ

export interface TrackingEvent {
  timestamp: string;
  status: TrackingStatus;
  description: string;
  descriptionThai?: string;
  location?: string;
}


// ==================== PROVIDER CONFIGS ====================

export const SHIPPING_PROVIDERS: Record<ShippingProvider, {
  name: string;
  nameThai: string;
  logo?: string;
  trackingUrlTemplate: string;
  track123CourierCode: string;
  requiresApiKey: boolean;
}> = {
  thailand_post: {
    name: 'Thailand Post',
    nameThai: 'ไปรษณีย์ไทย',
    trackingUrlTemplate: 'https://track.thailandpost.co.th/?trackNumber={tracking}',
    track123CourierCode: 'thailand-post',
    requiresApiKey: false,
  },
  kerry: {
    name: 'Kerry Express',
    nameThai: 'เคอรี่ เอ็กซ์เพรส',
    trackingUrlTemplate: 'https://th.kerryexpress.com/th/track/?track={tracking}',
    track123CourierCode: 'kerry-express-thailand',
    requiresApiKey: false,
  },
  jandt: {
    name: 'J&T Express',
    nameThai: 'เจแอนด์ที เอ็กซ์เพรส',
    trackingUrlTemplate: 'https://www.jtexpress.co.th/index/query/gzquery.html?bills={tracking}',
    track123CourierCode: 'jt-express-thailand',
    requiresApiKey: false,
  },
  flash: {
    name: 'Flash Express',
    nameThai: 'แฟลช เอ็กซ์เพรส',
    trackingUrlTemplate: 'https://www.flashexpress.co.th/tracking/?se={tracking}',
    track123CourierCode: 'flash-express',
    requiresApiKey: false,
  },
  pickup: {
    name: 'Pickup',
    nameThai: 'รับหน้าร้าน',
    trackingUrlTemplate: '',
    track123CourierCode: '',
    requiresApiKey: false,
  },
  custom: {
    name: 'Custom',
    nameThai: 'กำหนดเอง',
    trackingUrlTemplate: '',
    track123CourierCode: '',
    requiresApiKey: false,
  },
};

// ==================== STATUS TRANSLATIONS ====================

export const TRACKING_STATUS_THAI: Record<TrackingStatus, string> = {
  pending: 'รอรับพัสดุ',
  picked_up: 'รับพัสดุแล้ว',
  in_transit: 'กำลังจัดส่ง',
  out_for_delivery: 'กำลังนำส่ง',
  delivered: 'จัดส่งแล้ว',
  returned: 'ส่งคืนผู้ส่ง',
  failed: 'จัดส่งไม่สำเร็จ',
  unknown: 'ไม่ทราบสถานะ',
};

// ==================== DEFAULT CONFIG ====================

/**
 * Guest-safe shipping config: enabled options only, no admin/tracking internals.
 */
export function toPublicShippingConfig(cfg: ShippingConfig): ShippingConfig {
  return {
    showOptions: cfg.showOptions,
    allowPickup: cfg.allowPickup,
    ...(cfg.pickupLocation ? { pickupLocation: cfg.pickupLocation } : {}),
    ...(cfg.pickupInstructions ? { pickupInstructions: cfg.pickupInstructions } : {}),
    ...(cfg.defaultOptionId ? { defaultOptionId: cfg.defaultOptionId } : {}),
    ...(typeof cfg.globalFreeShippingMinimum === 'number'
      ? { globalFreeShippingMinimum: cfg.globalFreeShippingMinimum }
      : {}),
    options: (cfg.options || [])
      .filter((opt) => opt.enabled)
      .map((opt) => ({
        id: opt.id,
        provider: opt.provider,
        name: opt.name,
        ...(opt.nameEn ? { nameEn: opt.nameEn } : {}),
        ...(opt.description ? { description: opt.description } : {}),
        ...(opt.descriptionEn ? { descriptionEn: opt.descriptionEn } : {}),
        baseFee: opt.baseFee ?? 0,
        ...(typeof opt.perItemFee === 'number' ? { perItemFee: opt.perItemFee } : {}),
        ...(typeof opt.freeShippingMinimum === 'number'
          ? { freeShippingMinimum: opt.freeShippingMinimum }
          : {}),
        ...(opt.estimatedDays ? { estimatedDays: opt.estimatedDays } : {}),
        enabled: true,
      })),
  };
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  showOptions: true,
  allowPickup: true,
  pickupLocation: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.',
  options: [
    {
      id: 'pickup',
      provider: 'pickup',
      name: 'รับหน้าร้าน',
      nameEn: 'Pickup',
      description: 'รับสินค้าที่ชุมนุมคอมพิวเตอร์',
      descriptionEn: 'Pick up at Computer Club',
      baseFee: 0,
      enabled: true,
    },
    {
      id: 'thailand_post_ems',
      provider: 'thailand_post',
      name: 'EMS ไปรษณีย์ไทย',
      nameEn: 'EMS Thailand Post',
      description: '1-3 วันทำการ',
      descriptionEn: '1-3 business days',
      baseFee: 50,
      estimatedDays: { min: 1, max: 3 },
      enabled: true,
      trackingUrlTemplate: 'https://track.thailandpost.co.th/?trackNumber={tracking}',
      track123CourierCode: 'thailand-post',
    },
    {
      id: 'thailand_post_reg',
      provider: 'thailand_post',
      name: 'ลงทะเบียน ไปรษณีย์ไทย',
      nameEn: 'Registered Mail Thailand Post',
      description: '3-7 วันทำการ',
      descriptionEn: '3-7 business days',
      baseFee: 30,
      estimatedDays: { min: 3, max: 7 },
      enabled: true,
      trackingUrlTemplate: 'https://track.thailandpost.co.th/?trackNumber={tracking}',
      track123CourierCode: 'thailand-post',
    },
    {
      id: 'kerry',
      provider: 'kerry',
      name: 'Kerry Express',
      nameEn: 'Kerry Express',
      description: '1-2 วันทำการ',
      descriptionEn: '1-2 business days',
      baseFee: 60,
      estimatedDays: { min: 1, max: 2 },
      enabled: false,
      trackingUrlTemplate: 'https://th.kerryexpress.com/th/track/?track={tracking}',
      track123CourierCode: 'kerry-express-thailand',
    },
    {
      id: 'jandt',
      provider: 'jandt',
      name: 'J&T Express',
      nameEn: 'J&T Express',
      description: '2-4 วันทำการ',
      descriptionEn: '2-4 business days',
      baseFee: 45,
      estimatedDays: { min: 2, max: 4 },
      enabled: false,
      trackingUrlTemplate: 'https://www.jtexpress.co.th/index/query/gzquery.html?bills={tracking}',
      track123CourierCode: 'jt-express-thailand',
    },
    {
      id: 'flash',
      provider: 'flash',
      name: 'Flash Express',
      nameEn: 'Flash Express',
      description: '1-3 วันทำการ',
      descriptionEn: '1-3 business days',
      baseFee: 55,
      estimatedDays: { min: 1, max: 3 },
      enabled: false,
      trackingUrlTemplate: 'https://www.flashexpress.co.th/tracking/?se={tracking}',
      track123CourierCode: 'flash-express',
    },
  ],
};

// ==================== TRACKING FUNCTIONS ====================

/**
 * Get tracking URL for a tracking number
 */
export function getTrackingUrl(provider: ShippingProvider, trackingNumber: string): string {
  const providerConfig = SHIPPING_PROVIDERS[provider];
  if (!providerConfig?.trackingUrlTemplate) return '';
  return providerConfig.trackingUrlTemplate.replace('{tracking}', trackingNumber);
}

/**
 * Get Track123 tracking page URL
 */
export function getTrack123Url(trackingNumber: string): string {
  return `https://www.track123.com/tracking/${trackingNumber}`;
}

/**
 * Calculate shipping fee based on cart
 */
export function calculateShippingFee(
  option: ShippingOption,
  itemCount: number,
  cartTotal: number,
  globalFreeShippingMinimum?: number
): number {
  // Check free shipping
  const freeThreshold = globalFreeShippingMinimum || option.freeShippingMinimum;
  if (freeThreshold && cartTotal >= freeThreshold) {
    return 0;
  }
  
  // Calculate fee
  let fee = option.baseFee;
  if (option.perItemFee && itemCount > 1) {
    fee += option.perItemFee * (itemCount - 1);
  }
  
  return fee;
}
