// src/lib/shipping.ts
// Shipping providers and tracking API integrations via Track123

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
  description?: string;
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

// ==================== TRACK123 TYPES ====================

interface Track123Response {
  code: number;
  message: string;
  data?: Track123TrackingData[];
}

interface Track123TrackingData {
  trackNo: string;
  courierCode?: string;
  courierName?: string;
  status?: Track123Status;
  subStatus?: string;
  lastEvent?: string;
  lastUpdateTime?: string;
  signedBy?: string;
  estimatedDeliveryDate?: string;
  originCountry?: string;
  destinationCountry?: string;
  trackUrl?: string;
  checkpoints?: Track123Checkpoint[];
}

interface Track123Checkpoint {
  timestamp?: string;
  time?: string;
  message?: string;
  location?: string;
  status?: Track123Status;
}

type Track123Status = 
  | 'INIT'
  | 'NO_RECORD'
  | 'INFO_RECEIVED'
  | 'IN_TRANSIT'
  | 'WAITING_DELIVERY'
  | 'DELIVERY_FAILED'
  | 'ABNORMAL'
  | 'DELIVERED'
  | 'EXPIRED';

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

// Map Track123 status to our status
const TRACK123_STATUS_MAP: Record<Track123Status, TrackingStatus> = {
  'INIT': 'pending',
  'NO_RECORD': 'pending',
  'INFO_RECEIVED': 'picked_up',
  'IN_TRANSIT': 'in_transit',
  'WAITING_DELIVERY': 'out_for_delivery',
  'DELIVERY_FAILED': 'failed',
  'ABNORMAL': 'failed',
  'DELIVERED': 'delivered',
  'EXPIRED': 'unknown',
};

// Map Track123 status to Thai text
const TRACK123_STATUS_THAI: Record<Track123Status, string> = {
  'INIT': 'รอข้อมูล',
  'NO_RECORD': 'ยังไม่มีข้อมูล',
  'INFO_RECEIVED': 'รับข้อมูลแล้ว',
  'IN_TRANSIT': 'กำลังจัดส่ง',
  'WAITING_DELIVERY': 'รอนำส่ง',
  'DELIVERY_FAILED': 'จัดส่งไม่สำเร็จ',
  'ABNORMAL': 'มีปัญหา',
  'DELIVERED': 'จัดส่งแล้ว',
  'EXPIRED': 'หมดอายุ',
};

// ==================== DEFAULT CONFIG ====================

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  showOptions: true,
  allowPickup: true,
  pickupLocation: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.',
  options: [
    {
      id: 'pickup',
      provider: 'pickup',
      name: 'รับหน้าร้าน',
      description: 'รับสินค้าที่ชุมนุมคอมพิวเตอร์',
      baseFee: 0,
      enabled: true,
    },
    {
      id: 'thailand_post_ems',
      provider: 'thailand_post',
      name: 'EMS ไปรษณีย์ไทย',
      description: '1-3 วันทำการ',
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
      description: '3-7 วันทำการ',
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
      description: '1-2 วันทำการ',
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
      description: '2-4 วันทำการ',
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
      description: '1-3 วันทำการ',
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

// ==================== TRACK123 API FUNCTIONS ====================

const TRACK123_API_BASE = 'https://api.track123.com/gateway/open-api';

/**
 * Register a tracking number with Track123
 * This is required before querying tracking info
 */
export async function registerTracking(
  trackingNumber: string,
  courierCode?: string
): Promise<boolean> {
  const apiKey = process.env.TRACK123_API_KEY;
  
  if (!apiKey) {
    console.warn('[Shipping] Track123 API key not configured');
    return false;
  }
  
  try {
    const payload = [{
      trackNo: trackingNumber,
      ...(courierCode && { courierCode }),
    }];
    
    const res = await fetch(`${TRACK123_API_BASE}/tk/v2/track/import`, {
      method: 'POST',
      headers: {
        'Track123-Api-Secret': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      console.error('[Shipping] Track123 register failed:', res.status);
      return false;
    }
    
    const data = await res.json();
    console.log('[Shipping] Track123 register response:', data);
    
    // code 0 = success
    return data.code === 0;
  } catch (error) {
    console.error('[Shipping] Track123 register error:', error);
    return false;
  }
}

/**
 * Query tracking information from Track123
 */
export async function queryTrack123(
  trackingNumbers: string[]
): Promise<Track123Response | null> {
  const apiKey = process.env.TRACK123_API_KEY;
  
  if (!apiKey) {
    console.warn('[Shipping] Track123 API key not configured');
    return null;
  }
  
  try {
    const res = await fetch(`${TRACK123_API_BASE}/tk/v2.1/track/query`, {
      method: 'POST',
      headers: {
        'Track123-Api-Secret': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trackNos: trackingNumbers,
      }),
    });
    
    if (!res.ok) {
      console.error('[Shipping] Track123 query failed:', res.status);
      return null;
    }
    
    const data: Track123Response = await res.json();
    return data;
  } catch (error) {
    console.error('[Shipping] Track123 query error:', error);
    return null;
  }
}

/**
 * Track shipment via Track123 API
 */
export async function trackViaTrack123(
  trackingNumber: string,
  provider?: ShippingProvider,
  courierCode?: string
): Promise<TrackingInfo | null> {
  const apiKey = process.env.TRACK123_API_KEY;
  
  if (!apiKey) {
    console.warn('[Shipping] Track123 API key not configured');
    return createManualTrackingInfo(provider || 'custom', trackingNumber);
  }
  
  // First, try to query existing tracking
  let response = await queryTrack123([trackingNumber]);
  
  // If no data, register and query again
  if (!response?.data || response.data.length === 0) {
    const effectiveCourierCode = courierCode || 
      (provider ? SHIPPING_PROVIDERS[provider]?.track123CourierCode : undefined);
    
    const registered = await registerTracking(trackingNumber, effectiveCourierCode);
    
    if (registered) {
      // Wait a bit for Track123 to fetch data
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await queryTrack123([trackingNumber]);
    }
  }
  
  if (!response?.data || response.data.length === 0) {
    return createManualTrackingInfo(provider || 'custom', trackingNumber);
  }
  
  const trackData = response.data[0];
  return parseTrack123Response(trackData, provider);
}

/**
 * Universal tracking function using Track123
 */
export async function trackShipment(
  provider: ShippingProvider,
  trackingNumber: string,
  courierCode?: string
): Promise<TrackingInfo | null> {
  // Pickup doesn't need tracking
  if (provider === 'pickup') {
    return null;
  }
  
  // Use Track123 for all providers
  return trackViaTrack123(
    trackingNumber, 
    provider, 
    courierCode || SHIPPING_PROVIDERS[provider]?.track123CourierCode
  );
}

/**
 * Batch track multiple shipments
 */
export async function trackMultipleShipments(
  trackingNumbers: string[]
): Promise<Map<string, TrackingInfo>> {
  const results = new Map<string, TrackingInfo>();
  
  if (trackingNumbers.length === 0) {
    return results;
  }
  
  const apiKey = process.env.TRACK123_API_KEY;
  
  if (!apiKey) {
    console.warn('[Shipping] Track123 API key not configured');
    // Return manual tracking info for all
    for (const trackNo of trackingNumbers) {
      results.set(trackNo, createManualTrackingInfo('custom', trackNo));
    }
    return results;
  }
  
  // Track123 supports up to 100 at a time
  const batches: string[][] = [];
  for (let i = 0; i < trackingNumbers.length; i += 100) {
    batches.push(trackingNumbers.slice(i, i + 100));
  }
  
  for (const batch of batches) {
    const response = await queryTrack123(batch);
    
    if (response?.data) {
      for (const trackData of response.data) {
        if (trackData.trackNo) {
          results.set(trackData.trackNo, parseTrack123Response(trackData));
        }
      }
    }
  }
  
  // Fill in missing ones with manual tracking
  for (const trackNo of trackingNumbers) {
    if (!results.has(trackNo)) {
      results.set(trackNo, createManualTrackingInfo('custom', trackNo));
    }
  }
  
  return results;
}

// ==================== RESPONSE PARSER ====================

function parseTrack123Response(
  data: Track123TrackingData,
  provider?: ShippingProvider
): TrackingInfo {
  const status = data.status || 'INIT';
  const mappedStatus = TRACK123_STATUS_MAP[status] || 'unknown';
  
  // Detect provider from courier code if not provided
  let detectedProvider = provider;
  if (!detectedProvider && data.courierCode) {
    const courierLower = data.courierCode.toLowerCase();
    if (courierLower.includes('thailand-post')) {
      detectedProvider = 'thailand_post';
    } else if (courierLower.includes('kerry')) {
      detectedProvider = 'kerry';
    } else if (courierLower.includes('jt') || courierLower.includes('j&t')) {
      detectedProvider = 'jandt';
    } else if (courierLower.includes('flash')) {
      detectedProvider = 'flash';
    }
  }
  
  const events: TrackingEvent[] = (data.checkpoints || []).map(cp => ({
    timestamp: cp.timestamp || cp.time || new Date().toISOString(),
    status: cp.status ? (TRACK123_STATUS_MAP[cp.status] || 'unknown') : mappedStatus,
    description: cp.message || '',
    descriptionThai: cp.message || '',
    location: cp.location || '',
  }));
  
  const lastEvent = events[0];
  const trackingUrl = detectedProvider 
    ? getTrackingUrl(detectedProvider, data.trackNo) 
    : data.trackUrl;
  
  return {
    provider: detectedProvider || 'custom',
    trackingNumber: data.trackNo,
    status: mappedStatus,
    statusText: data.lastEvent || status,
    statusTextThai: TRACK123_STATUS_THAI[status] || TRACKING_STATUS_THAI[mappedStatus],
    lastUpdate: data.lastUpdateTime || lastEvent?.timestamp || new Date().toISOString(),
    estimatedDelivery: data.estimatedDeliveryDate,
    events,
    rawResponse: data,
    trackingUrl,
    track123Url: getTrack123Url(data.trackNo),
  };
}

// ==================== HELPER FUNCTIONS ====================

function createManualTrackingInfo(
  provider: ShippingProvider,
  trackingNumber: string
): TrackingInfo {
  const trackingUrl = getTrackingUrl(provider, trackingNumber);
  
  return {
    provider,
    trackingNumber,
    status: 'pending',
    statusText: 'กรุณาตรวจสอบที่เว็บไซต์ขนส่ง',
    statusTextThai: 'กรุณาตรวจสอบที่เว็บไซต์ขนส่ง',
    lastUpdate: new Date().toISOString(),
    events: [],
    trackingUrl,
    track123Url: getTrack123Url(trackingNumber),
  };
}

// ==================== CARRIER LIST ====================

/**
 * Get list of supported carriers from Track123
 */
export async function getCarrierList(): Promise<any[]> {
  const apiKey = process.env.TRACK123_API_KEY;
  
  if (!apiKey) {
    return [];
  }
  
  try {
    const res = await fetch(`${TRACK123_API_BASE}/carrier/v1/carriers`, {
      method: 'GET',
      headers: {
        'Track123-Api-Secret': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      return [];
    }
    
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error('[Shipping] Get carriers error:', error);
    return [];
  }
}
