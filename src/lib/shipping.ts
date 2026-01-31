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

// New API v2.1 response format
interface Track123Response {
  code: string;  // "00000" = success
  msg: string;
  data?: {
    accepted?: {
      content?: Track123TrackingData[];
      totalElements?: string;
      totalPages?: string;
      currentPage?: string;
    };
    rejected?: any[];
  };
  // Legacy format support
  message?: string;
}

interface Track123TrackingData {
  id?: string;
  trackNo: string;
  createTime?: string;
  nextUpdateTime?: string;
  trackingStatus?: string;  // "001", "002", etc.
  transitStatus?: Track123Status;  // "NO_RECORD", "IN_TRANSIT", etc.
  localLogisticsInfo?: {
    courierCode?: string;
    courierNameCN?: string;
    courierNameEN?: string;
    courierHomePage?: string;
    courierTrackingLink?: string;
  };
  // Legacy fields
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
    
    // code "00000" = success (new format) or code 0 (legacy)
    return data.code === '00000' || data.code === 0;
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
    
    const rawData = await res.json();
    console.log('[Shipping] Track123 raw response:', JSON.stringify(rawData, null, 2));
    
    // Normalize response to expected format
    const data: Track123Response = rawData;
    return data;
  } catch (error) {
    console.error('[Shipping] Track123 query error:', error);
    return null;
  }
}

/**
 * Extract tracking data from Track123 response (handles both new and legacy formats)
 */
function extractTrack123Data(response: Track123Response): Track123TrackingData[] {
  // New format: data.accepted.content
  if (response.data?.accepted?.content) {
    return response.data.accepted.content;
  }
  // Legacy format: data as array
  if (Array.isArray(response.data)) {
    return response.data as unknown as Track123TrackingData[];
  }
  return [];
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
  let trackDataList = response ? extractTrack123Data(response) : [];
  
  // If no data, register and query again
  if (trackDataList.length === 0) {
    const effectiveCourierCode = courierCode || 
      (provider ? SHIPPING_PROVIDERS[provider]?.track123CourierCode : undefined);
    
    const registered = await registerTracking(trackingNumber, effectiveCourierCode);
    
    if (registered) {
      // Wait a bit for Track123 to fetch data
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await queryTrack123([trackingNumber]);
      trackDataList = response ? extractTrack123Data(response) : [];
    }
  }
  
  if (trackDataList.length === 0) {
    return createManualTrackingInfo(provider || 'custom', trackingNumber);
  }
  
  const trackData = trackDataList[0];
  
  // Additional safety check - if trackData is undefined or doesn't have trackNo
  if (!trackData || !trackData.trackNo) {
    return createManualTrackingInfo(provider || 'custom', trackingNumber);
  }
  
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
    const trackDataList = response ? extractTrack123Data(response) : [];
    
    for (const trackData of trackDataList) {
      // Safety check for valid trackData
      if (trackData && trackData.trackNo) {
        results.set(trackData.trackNo, parseTrack123Response(trackData));
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
  // Safety check for undefined data
  if (!data) {
    return createManualTrackingInfo(provider || 'custom', '');
  }
  
  // Use transitStatus (new format) or status (legacy format)
  const status: Track123Status = data.transitStatus || data.status || 'INIT';
  const mappedStatus = TRACK123_STATUS_MAP[status] || 'unknown';
  
  // Detect provider from courier code if not provided (check both new and legacy formats)
  let detectedProvider = provider;
  const courierCode = data.localLogisticsInfo?.courierCode || data.courierCode;
  if (!detectedProvider && courierCode) {
    const courierLower = courierCode.toLowerCase();
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
    : (data.localLogisticsInfo?.courierTrackingLink || data.trackUrl);
  
  // Get status text
  const statusTextRaw = data.lastEvent || status;
  const statusTextThai = TRACK123_STATUS_THAI[status] || TRACKING_STATUS_THAI[mappedStatus];
  
  return {
    provider: detectedProvider || 'custom',
    trackingNumber: data.trackNo,
    status: mappedStatus,
    statusText: statusTextRaw,
    statusTextThai: statusTextThai,
    lastUpdate: data.lastUpdateTime || data.createTime || lastEvent?.timestamp || new Date().toISOString(),
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

// ==================== THAILAND POST DIRECT API ====================

/**
 * Thailand Post tracking API response types
 */
interface ThailandPostTrackResponse {
  status: boolean;
  message?: string;
  response?: {
    // items is a Record where key is tracking number, value is ARRAY of events
    items?: Record<string, ThailandPostTrackItem[]>;
    track_count?: {
      track_date?: string;
      count_number?: number;
      track_count_limit?: number;
    };
  };
}

interface ThailandPostTrackItem {
  barcode?: string;
  status?: string;  // "103", "201", "206", "211", "301", "501", etc.
  status_description?: string;
  status_detail?: string;
  status_date?: string;
  location?: string;
  postcode?: string;
  delivery_status?: string;  // "S" = success
  delivery_description?: string;
  delivery_datetime?: string;
  receiver_name?: string;
  signature?: string;
  delivery_officer_name?: string;
  delivery_officer_tel?: string;
  office_name?: string;
  office_tel?: string;
  call_center_tel?: string;
}

// Token cache for Thailand Post API
let thaiPostToken: { token: string; expiresAt: number } | null = null;

/**
 * Get Thailand Post API token
 * Note: Thailand Post requires registration at https://track.thailandpost.co.th/developerGuide
 */
async function getThailandPostToken(): Promise<string | null> {
  const apiKey = process.env.THAILANDPOST_API_KEY;
  
  if (!apiKey) {
    console.warn('[Shipping] Thailand Post API key not configured');
    return null;
  }
  
  // Return cached token if still valid
  if (thaiPostToken && thaiPostToken.expiresAt > Date.now()) {
    return thaiPostToken.token;
  }
  
  try {
    const res = await fetch('https://trackapi.thailandpost.co.th/post/api/v1/authenticate/token', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      console.error('[Shipping] Thailand Post token failed:', res.status);
      return null;
    }
    
    const data = await res.json();
    
    if (data.expire && data.token) {
      // Cache token (typically valid for 30 days, but refresh daily)
      thaiPostToken = {
        token: data.token,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      return data.token;
    }
    
    return null;
  } catch (error) {
    console.error('[Shipping] Thailand Post token error:', error);
    return null;
  }
}

/**
 * Track via Thailand Post Direct API (fallback when Track123 fails)
 */
export async function trackViaThailandPost(
  trackingNumber: string
): Promise<TrackingInfo | null> {
  const token = await getThailandPostToken();
  
  if (!token) {
    return null;
  }
  
  try {
    const res = await fetch('https://trackapi.thailandpost.co.th/post/api/v1/track', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'all',
        language: 'TH',
        barcode: [trackingNumber],
      }),
    });
    
    if (!res.ok) {
      console.error('[Shipping] Thailand Post track failed:', res.status);
      return null;
    }
    
    const data: ThailandPostTrackResponse = await res.json();
    
    if (!data.status || !data.response?.items) {
      console.warn('[Shipping] Thailand Post no tracking data:', data.message);
      return null;
    }
    
    const itemsArray = data.response.items[trackingNumber];
    if (!itemsArray || itemsArray.length === 0) {
      return null;
    }
    
    return parseThailandPostResponse(itemsArray, trackingNumber);
  } catch (error) {
    console.error('[Shipping] Thailand Post track error:', error);
    return null;
  }
}

/**
 * Map Thailand Post status to our status
 * Status codes from Thailand Post API:
 * - 103: รับฝาก (picked up)
 * - 201: ออกจากที่ทำการ (left post office, in transit)
 * - 206: ถึงที่ทำการปลายทาง (arrived at destination)
 * - 211: รับเข้า ณ ศูนย์คัดแยก (received at sorting center)
 * - 301: อยู่ระหว่างการนำจ่าย (out for delivery)
 * - 401: ไม่สำเร็จ/ตีกลับ (failed/returned)
 * - 501: นำจ่ายสำเร็จ (delivered successfully)
 */
function mapThailandPostStatus(status?: string, description?: string): TrackingStatus {
  if (!status) return 'unknown';
  
  // Check by status code first (most reliable)
  switch (status) {
    case '501': return 'delivered';  // นำจ่ายสำเร็จ
    case '301': return 'out_for_delivery';  // อยู่ระหว่างการนำจ่าย
    case '206': return 'in_transit';  // ถึงที่ทำการปลายทาง
    case '211': return 'in_transit';  // รับเข้า ณ ศูนย์คัดแยก
    case '201': return 'in_transit';  // ออกจากที่ทำการ
    case '103': return 'picked_up';  // รับฝาก
    case '401': return 'failed';  // ไม่สำเร็จ
    case '601': return 'returned';  // ส่งคืน
  }
  
  // Fallback: check description text
  const descLower = (description || '').toLowerCase();
  
  if (descLower.includes('นำจ่ายสำเร็จ') || descLower.includes('delivered')) {
    return 'delivered';
  }
  if (descLower.includes('อยู่ระหว่างการนำจ่าย') || descLower.includes('out for delivery')) {
    return 'out_for_delivery';
  }
  if (descLower.includes('ถึงที่ทำการ') || descLower.includes('รับเข้า') || descLower.includes('ออกจาก')) {
    return 'in_transit';
  }
  if (descLower.includes('รับฝาก')) {
    return 'picked_up';
  }
  if (descLower.includes('ส่งคืน') || descLower.includes('ตีกลับ')) {
    return 'returned';
  }
  if (descLower.includes('ไม่สำเร็จ')) {
    return 'failed';
  }
  
  return 'in_transit'; // Default
}

/**
 * Parse Thailand Post API response (array of events)
 */
function parseThailandPostResponse(
  items: ThailandPostTrackItem[],
  trackingNumber: string
): TrackingInfo {
  // Sort by date (newest first)
  const sortedItems = [...items].sort((a, b) => {
    const dateA = parseThaiDate(a.status_date || '');
    const dateB = parseThaiDate(b.status_date || '');
    return dateB.getTime() - dateA.getTime();
  });
  
  // Get latest item for current status
  const latest = sortedItems[0];
  const status = mapThailandPostStatus(latest?.status, latest?.status_description);
  const statusText = latest?.status_description || latest?.status || '';
  
  // Create events from all items
  const events: TrackingEvent[] = sortedItems.map(item => {
    const eventStatus = mapThailandPostStatus(item.status, item.status_description);
    return {
      timestamp: parseThaiDate(item.status_date || '').toISOString(),
      status: eventStatus,
      description: item.status_detail || item.status_description || '',
      descriptionThai: item.status_detail || item.status_description || '',
      location: item.location || '',
    };
  });
  
  return {
    provider: 'thailand_post',
    trackingNumber,
    status,
    statusText,
    statusTextThai: statusText,
    lastUpdate: parseThaiDate(latest?.status_date || '').toISOString(),
    events,
    rawResponse: items,
    trackingUrl: getTrackingUrl('thailand_post', trackingNumber),
    track123Url: getTrack123Url(trackingNumber),
  };
}

/**
 * Parse Thai date format (DD/MM/YYYY HH:MM:SS+07:00) to Date
 * Thai Buddhist year = Gregorian year + 543
 */
function parseThaiDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  try {
    // Format: "25/10/2568 11:35:28+07:00"
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hour, minute, second] = match;
      // Convert Buddhist year to Gregorian (2568 -> 2025)
      const gregorianYear = parseInt(year) - 543;
      return new Date(gregorianYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
    }
  } catch (e) {
    console.warn('[Shipping] Failed to parse Thai date:', dateStr);
  }
  
  return new Date();
}

// ==================== ENHANCED TRACKING WITH BOTH APIs ====================

/**
 * Merge tracking results from multiple sources
 * Prioritizes more complete/recent data
 */
function mergeTrackingResults(
  primary: TrackingInfo | null,
  secondary: TrackingInfo | null,
  trackingNumber: string,
  provider: ShippingProvider
): TrackingInfo {
  // If both are null, return manual tracking
  if (!primary && !secondary) {
    return createManualTrackingInfo(provider, trackingNumber);
  }
  
  // If only one exists, return it
  if (!primary) return secondary!;
  if (!secondary) return primary;
  
  // IMPORTANT: If either one says "delivered", trust it!
  // This is the final status and should always be prioritized
  if (primary.status === 'delivered' && secondary.status !== 'delivered') {
    console.log('[Shipping] Primary says delivered, using primary');
    return {
      ...primary,
      events: mergeEvents(primary.events, secondary.events),
      rawResponse: { track123: primary.rawResponse, thailandPost: secondary.rawResponse },
    };
  }
  if (secondary.status === 'delivered' && primary.status !== 'delivered') {
    console.log('[Shipping] Secondary says delivered, using secondary');
    return {
      ...secondary,
      events: mergeEvents(secondary.events, primary.events),
      rawResponse: { track123: primary.rawResponse, thailandPost: secondary.rawResponse },
    };
  }
  
  // Both exist - merge them intelligently
  // Use the one with more events or better status
  const primaryScore = scoreTrackingInfo(primary);
  const secondaryScore = scoreTrackingInfo(secondary);
  
  // Use the better one as base
  const base = primaryScore >= secondaryScore ? primary : secondary;
  const other = primaryScore >= secondaryScore ? secondary : primary;
  
  // Merge events (remove duplicates by timestamp)
  const allEvents = [...base.events];
  const existingTimestamps = new Set(allEvents.map(e => e.timestamp));
  
  for (const event of other.events) {
    if (!existingTimestamps.has(event.timestamp)) {
      allEvents.push(event);
    }
  }
  
  // Sort events by timestamp (newest first)
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return {
    ...base,
    events: allEvents,
    // Keep raw response from both sources
    rawResponse: {
      track123: primary.rawResponse,
      thailandPost: secondary.rawResponse,
    },
  };
}

/**
 * Merge events from two sources (remove duplicates)
 */
function mergeEvents(baseEvents: TrackingEvent[], otherEvents: TrackingEvent[]): TrackingEvent[] {
  const allEvents = [...baseEvents];
  const existingTimestamps = new Set(allEvents.map(e => e.timestamp));
  
  for (const event of otherEvents) {
    if (!existingTimestamps.has(event.timestamp)) {
      allEvents.push(event);
    }
  }
  
  // Sort by timestamp (newest first)
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return allEvents;
}

/**
 * Score tracking info quality (higher = better data)
 */
function scoreTrackingInfo(info: TrackingInfo): number {
  let score = 0;
  
  // More events = better
  score += info.events.length * 10;
  
  // Status quality
  if (info.status === 'delivered') score += 50;
  else if (info.status === 'out_for_delivery') score += 40;
  else if (info.status === 'in_transit') score += 30;
  else if (info.status === 'picked_up') score += 20;
  else if (info.status === 'pending') score += 5;
  else if (info.status === 'unknown') score += 0;
  
  // Has estimated delivery
  if (info.estimatedDelivery) score += 5;
  
  // Recent update
  const lastUpdate = new Date(info.lastUpdate).getTime();
  const now = Date.now();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  if (hoursSinceUpdate < 1) score += 15;
  else if (hoursSinceUpdate < 24) score += 10;
  else if (hoursSinceUpdate < 72) score += 5;
  
  return score;
}

/**
 * Track shipment using both Track123 and Thailand Post APIs
 * For Thailand Post: prioritize Thailand Post Direct API (more accurate)
 */
export async function trackShipmentWithFallback(
  provider: ShippingProvider,
  trackingNumber: string,
  courierCode?: string
): Promise<TrackingInfo | null> {
  // Pickup doesn't need tracking
  if (provider === 'pickup') {
    return null;
  }
  
  // For Thailand Post, PRIORITIZE Thailand Post Direct API
  if (provider === 'thailand_post') {
    console.log('[Shipping] Tracking Thailand Post package:', trackingNumber);
    
    // Try Thailand Post Direct API FIRST (more accurate for Thai Post)
    console.log('[Shipping] Trying Thailand Post Direct API first...');
    const thaiPostResult = await trackViaThailandPost(trackingNumber);
    
    if (thaiPostResult && thaiPostResult.events && thaiPostResult.events.length > 0) {
      console.log('[Shipping] Thailand Post API success! Status:', thaiPostResult.status, 'events:', thaiPostResult.events.length);
      return thaiPostResult;
    }
    
    console.log('[Shipping] Thailand Post API returned no events, trying Track123...');
    
    // Fallback to Track123 if Thailand Post has no data
    const track123Result = await trackViaTrack123(
      trackingNumber, 
      provider, 
      courierCode || SHIPPING_PROVIDERS[provider]?.track123CourierCode
    );
    
    if (track123Result) {
      console.log('[Shipping] Track123 result: status:', track123Result.status, 'events:', track123Result.events?.length || 0);
    }
    
    return track123Result || createManualTrackingInfo(provider, trackingNumber);
  }
  
  // For other providers, use Track123 only
  const track123Result = await trackViaTrack123(
    trackingNumber, 
    provider, 
    courierCode || SHIPPING_PROVIDERS[provider]?.track123CourierCode
  );
  
  return track123Result || createManualTrackingInfo(provider, trackingNumber);
}

/**
 * Track shipment with only Track123 (for non-Thailand Post providers)
 */
export async function trackShipmentTrack123Only(
  provider: ShippingProvider,
  trackingNumber: string,
  courierCode?: string
): Promise<TrackingInfo | null> {
  if (provider === 'pickup') {
    return null;
  }
  
  return trackViaTrack123(
    trackingNumber, 
    provider, 
    courierCode || SHIPPING_PROVIDERS[provider]?.track123CourierCode
  );
}

/**
 * Track shipment with only Thailand Post Direct API
 */
export async function trackShipmentThaiPostOnly(
  trackingNumber: string
): Promise<TrackingInfo | null> {
  return trackViaThailandPost(trackingNumber);
}
