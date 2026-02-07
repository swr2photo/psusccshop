// src/lib/ai-chatbot.ts
// AI-powered chatbot using Google Gemini with real-time shop database context + order lookup

import { getShopConfig, getAllOrders, getOrdersByEmail, getOrderByRef } from './supabase';
import { SHIRT_FAQ, findShirtFAQ, QUICK_QUESTIONS } from './shirt-faq';

// ==================== Types ====================
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationContext {
  messages: ChatMessage[];
  lastProductMentioned?: string;
  lastSizeMentioned?: string;
}

export interface ChatResponse {
  answer: string;
  source: 'ai' | 'faq' | 'fallback';
  suggestions?: string[];
  relatedQuestions?: string[];
  productInfo?: any;
  confidence?: number;
  productImages?: { name: string; image: string; }[];
  modelUsed?: string; // ชื่อโมเดล AI ที่ใช้
}

export interface ShopData {
  config: any;
  products: any[];
  announcements: any[];
  bankAccount: any;
  isOpen: boolean;
  stats?: {
    totalProducts: number;
    availableProducts: number;
    priceRange: { min: number; max: number };
  };
}

// ==================== Caching ====================
let shopDataCache: { data: ShopData; timestamp: number } | null = null;
const SHOP_CACHE_TTL = 60_000; // 1 minute cache

let orderStatsCache: { data: OrderStats; timestamp: number } | null = null;
const ORDER_STATS_CACHE_TTL = 120_000; // 2 minutes cache

interface OrderStats {
  totalOrders: number;
  statusBreakdown: Record<string, number>;
  recentOrders: number; // last 24h
  popularProducts: { name: string; count: number }[];
  avgOrderAmount: number;
}

// ==================== Database Functions ====================

/**
 * ดึงข้อมูลร้านค้าแบบละเอียดจาก database
 */
export async function getShopData(): Promise<ShopData> {
  // Return cached data if fresh
  if (shopDataCache && Date.now() - shopDataCache.timestamp < SHOP_CACHE_TTL) {
    return shopDataCache.data;
  }
  
  try {
    const config = await getShopConfig();
    
    if (!config) {
      return {
        config: null,
        products: [],
        announcements: [],
        bankAccount: {},
        isOpen: false,
      };
    }

    const products = config.products || [];
    const availableProducts = products.filter((p: any) => p.available !== false);
    
    // Calculate price range - support sizePricing object, sizes array, and basePrice
    let minPrice = Infinity;
    let maxPrice = 0;
    products.forEach((p: any) => {
      // Check sizePricing object first (new format)
      if (p.sizePricing && Object.keys(p.sizePricing).length > 0) {
        Object.values(p.sizePricing as Record<string, number>).forEach((price) => {
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        });
      } else if (p.sizes && p.sizes.length > 0) {
        // Check sizes array (old format)
        (p.sizes || []).forEach((s: any) => {
          if (s.price < minPrice) minPrice = s.price;
          if (s.price > maxPrice) maxPrice = s.price;
        });
      } else if (p.basePrice) {
        // Use basePrice if no sizes
        if (p.basePrice < minPrice) minPrice = p.basePrice;
        if (p.basePrice > maxPrice) maxPrice = p.basePrice;
      }
    });

    // Store in cache
    const result: ShopData = {
      config,
      products,
      announcements: config.announcements || [],
      bankAccount: config.bankAccount || {},
      isOpen: config.isOpen !== false,
      stats: {
        totalProducts: products.length,
        availableProducts: availableProducts.length,
        priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice },
      },
    };
    shopDataCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.error('Error fetching shop data:', error);
    return {
      config: null,
      products: [],
      announcements: [],
      bankAccount: {},
      isOpen: false,
    };
  }
}

/**
 * ค้นหาสินค้าตามชื่อหรือประเภท
 */
export async function findProduct(query: string): Promise<any | null> {
  const shopData = await getShopData();
  const q = query.toLowerCase();
  
  // Exact match first
  let product = shopData.products.find((p: any) => 
    (p.name || '').toLowerCase() === q || 
    (p.type || '').toLowerCase() === q
  );
  
  // Partial match
  if (!product) {
    product = shopData.products.find((p: any) => 
      (p.name || '').toLowerCase().includes(q) || 
      (p.type || '').toLowerCase().includes(q) ||
      q.includes((p.name || '').toLowerCase()) ||
      q.includes((p.type || '').toLowerCase())
    );
  }
  
  // Type keywords
  if (!product) {
    const typeKeywords: Record<string, string[]> = {
      'jersey': ['jersey', 'เจอร์ซีย์', 'เสื้อกีฬา', 'กีฬา'],
      'crew': ['crew', 'ครูว์', 'คอกลม', 'เสื้อยืด', 'ยืด'],
    };
    
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(k => q.includes(k))) {
        product = shopData.products.find((p: any) => 
          (p.type || '').toLowerCase().includes(type) ||
          (p.name || '').toLowerCase().includes(type)
        );
        if (product) break;
      }
    }
  }
  
  return product || null;
}

/**
 * ค้นหาไซซ์และราคา
 */
export function findSizePrice(product: any, size: string): { size: string; price: number } | null {
  if (!product?.sizes) return null;
  
  const s = size.toUpperCase();
  const sizeData = product.sizes.find((sz: any) => 
    (sz.size || '').toUpperCase() === s
  );
  
  return sizeData ? { size: sizeData.size, price: sizeData.price } : null;
}

// ==================== Order Lookup Functions ====================

/**
 * ดึงสถิติออเดอร์รวม (cached)
 */
export async function getOrderStats(): Promise<OrderStats> {
  if (orderStatsCache && Date.now() - orderStatsCache.timestamp < ORDER_STATS_CACHE_TTL) {
    return orderStatsCache.data;
  }
  
  try {
    const { orders, total } = await getAllOrders({ limit: 500 });
    
    const statusBreakdown: Record<string, number> = {};
    const productCounts: Record<string, number> = {};
    let totalAmount = 0;
    let recentCount = 0;
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    orders.forEach((o: any) => {
      // Status breakdown
      const s = o.status || 'UNKNOWN';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      
      // Recent orders
      const orderTime = new Date(o.createdAt || o.date).getTime();
      if (orderTime > dayAgo) recentCount++;
      
      // Total amount
      totalAmount += o.totalAmount || o.amount || 0;
      
      // Popular products
      (o.cart || []).forEach((item: any) => {
        const name = item.name || item.productName || 'Unknown';
        productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
      });
    });
    
    const popularProducts = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    const stats: OrderStats = {
      totalOrders: total,
      statusBreakdown,
      recentOrders: recentCount,
      popularProducts,
      avgOrderAmount: total > 0 ? Math.round(totalAmount / total) : 0,
    };
    
    orderStatsCache = { data: stats, timestamp: Date.now() };
    return stats;
  } catch (error) {
    console.error('Error getting order stats:', error);
    return {
      totalOrders: 0,
      statusBreakdown: {},
      recentOrders: 0,
      popularProducts: [],
      avgOrderAmount: 0,
    };
  }
}

/**
 * ค้นหาออเดอร์จาก reference number
 */
export async function lookupOrderByRef(ref: string): Promise<string> {
  try {
    const order = await getOrderByRef(ref.toUpperCase());
    if (!order) {
      return `ไม่พบออเดอร์หมายเลข "${ref}" ในระบบค่ะ กรุณาตรวจสอบหมายเลขออเดอร์อีกครั้งนะคะ`;
    }
    return formatOrderForChat(order);
  } catch (error) {
    console.error('Order lookup error:', error);
    return 'ไม่สามารถค้นหาออเดอร์ได้ในขณะนี้ค่ะ กรุณาลองใหม่อีกครั้งนะคะ';
  }
}

/**
 * ดึงออเดอร์ทั้งหมดของ user (ตาม email)
 */
export async function lookupOrdersByEmail(email: string): Promise<string> {
  try {
    const { orders, total } = await getOrdersByEmail(email, { limit: 10 });
    if (!orders.length) {
      return 'ยังไม่มีประวัติการสั่งซื้อค่ะ';
    }
    
    let result = `พบ ${total} ออเดอร์ (แสดง ${orders.length} รายการล่าสุด)\n\n`;
    result += '| หมายเลข | วันที่ | สถานะ | ยอดรวม |\n';
    result += '|---------|--------|--------|--------|\n';
    
    orders.forEach((o: any) => {
      const date = new Date(o.createdAt || o.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      const statusThai = getStatusThai(o.status);
      result += `| ${o.ref} | ${date} | ${statusThai} | ${(o.totalAmount || 0).toLocaleString()}฿ |\n`;
    });
    
    return result;
  } catch (error) {
    console.error('Orders by email error:', error);
    return 'ไม่สามารถดึงข้อมูลประวัติการสั่งซื้อได้ในขณะนี้ค่ะ';
  }
}

/**
 * Format order data for chat display
 */
function formatOrderForChat(order: any): string {
  const statusThai = getStatusThai(order.status);
  const date = new Date(order.createdAt || order.date).toLocaleDateString('th-TH', { 
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
  
  let result = `ข้อมูลออเดอร์ ${order.ref}\n\n`;
  result += `| รายการ | รายละเอียด |\n`;
  result += `|--------|------------|\n`;
  result += `| หมายเลข | ${order.ref} |\n`;
  result += `| วันที่สั่ง | ${date} |\n`;
  result += `| สถานะ | ${statusThai} |\n`;
  result += `| ยอดรวม | ${(order.totalAmount || 0).toLocaleString()} บาท |\n`;
  
  if (order.paymentMethod) {
    result += `| วิธีชำระ | ${order.paymentMethod} |\n`;
  }
  
  if (order.shippingOption) {
    const shipping = typeof order.shippingOption === 'object' 
      ? order.shippingOption.name 
      : order.shippingOption;
    result += `| การจัดส่ง | ${shipping} |\n`;
  }
  
  if (order.trackingNumber) {
    result += `| เลขพัสดุ | ${order.trackingNumber} |\n`;
    if (order.shippingProvider) {
      result += `| ขนส่ง | ${order.shippingProvider} |\n`;
    }
    if (order.trackingStatus) {
      result += `| สถานะพัสดุ | ${order.trackingStatus} |\n`;
    }
  }
  
  // Refund info
  if (order.refundStatus) {
    const refundStatusThai = getRefundStatusThai(order.refundStatus);
    result += `| การคืนเงิน | ${refundStatusThai} |\n`;
    if (order.refundAmount) {
      result += `| จำนวนคืน | ${order.refundAmount.toLocaleString()} บาท |\n`;
    }
  }
  
  // Cart items
  if (order.cart && order.cart.length > 0) {
    result += '\n\nรายการสินค้า\n\n';
    result += '| สินค้า | ไซซ์ | จำนวน | ราคา |\n';
    result += '|--------|------|--------|------|\n';
    order.cart.forEach((item: any) => {
      const name = item.name || item.productName || '-';
      const size = item.size || '-';
      const qty = item.quantity || 1;
      const price = item.price || item.totalPrice || 0;
      const extras = [];
      if (item.options?.customName) extras.push(`ชื่อ: ${item.options.customName}`);
      if (item.options?.customNumber) extras.push(`เบอร์: ${item.options.customNumber}`);
      if (item.options?.isLongSleeve) extras.push('แขนยาว');
      const extraText = extras.length > 0 ? ` (${extras.join(', ')})` : '';
      result += `| ${name}${extraText} | ${size} | ${qty} | ${price.toLocaleString()}฿ |\n`;
    });
  }
  
  // Status-specific messages
  result += '\n';
  switch (order.status) {
    case 'WAITING_PAYMENT':
    case 'AWAITING_PAYMENT':
    case 'PENDING':
      result += 'กรุณาชำระเงินและอัปโหลดสลิปภายใน 24 ชั่วโมงค่ะ';
      break;
    case 'VERIFYING':
      result += 'ทีมงานกำลังตรวจสอบการชำระเงินค่ะ โปรดรอสักครู่';
      break;
    case 'PAID':
    case 'CONFIRMED':
      result += 'ชำระเงินเรียบร้อยแล้วค่ะ รอทีมงานจัดเตรียมสินค้า';
      break;
    case 'PREPARING':
      result += 'กำลังจัดเตรียมสินค้าให้ค่ะ';
      break;
    case 'SHIPPED':
      result += order.trackingNumber 
        ? `สินค้าจัดส่งแล้วค่ะ ติดตามพัสดุได้ที่หมายเลข ${order.trackingNumber}`
        : 'สินค้าจัดส่งแล้วค่ะ';
      break;
    case 'READY':
      result += 'สินค้าพร้อมรับแล้วค่ะ มารับได้ที่ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.';
      break;
    case 'COMPLETED':
    case 'DELIVERED':
      result += 'ออเดอร์เสร็จสมบูรณ์แล้วค่ะ ขอบคุณที่อุดหนุนนะคะ';
      break;
    case 'CANCELLED':
      result += 'ออเดอร์นี้ถูกยกเลิกแล้วค่ะ';
      break;
    case 'REFUNDED':
      result += 'ออเดอร์นี้ได้รับการคืนเงินแล้วค่ะ';
      break;
  }
  
  return result;
}

function getStatusThai(status: string): string {
  const map: Record<string, string> = {
    'WAITING_PAYMENT': 'รอชำระเงิน',
    'AWAITING_PAYMENT': 'รอชำระเงิน',
    'PENDING': 'รอดำเนินการ',
    'VERIFYING': 'กำลังตรวจสอบ',
    'PAID': 'ชำระแล้ว',
    'CONFIRMED': 'ยืนยันแล้ว',
    'PREPARING': 'กำลังจัดเตรียม',
    'SHIPPED': 'จัดส่งแล้ว',
    'READY': 'พร้อมรับ',
    'COMPLETED': 'เสร็จสมบูรณ์',
    'DELIVERED': 'ส่งถึงแล้ว',
    'CANCELLED': 'ยกเลิก',
    'EXPIRED': 'หมดอายุ',
    'REFUNDED': 'คืนเงินแล้ว',
  };
  return map[status] || status;
}

function getRefundStatusThai(status: string): string {
  const map: Record<string, string> = {
    'requested': 'ขอคืนเงิน',
    'approved': 'อนุมัติแล้ว',
    'rejected': 'ปฏิเสธ',
    'completed': 'คืนเงินแล้ว',
  };
  return map[status] || status;
}

/**
 * ตรวจจับว่าข้อความถามเกี่ยวกับออเดอร์หรือไม่
 */
export function detectOrderQuery(message: string): { isOrderQuery: boolean; orderRef?: string; isMyOrders?: boolean } {
  const q = message.toLowerCase().trim();
  
  // Check for order reference number pattern (e.g., SCC-XXXXXX, ORD-XXXXX, or just alphanumeric refs)
  const refPatterns = [
    /(?:ออเดอร์|order|คำสั่งซื้อ|หมายเลข|เลขที่|ref|#)\s*[:\s]?\s*([A-Z0-9-]{6,20})/i,
    /\b(SCC-[A-Z0-9]+)\b/i,
    /\b(ORD-[A-Z0-9]+)\b/i,
    /\b([A-Z]{2,4}-\d{6,})\b/,
  ];
  
  for (const pattern of refPatterns) {
    const match = q.match(pattern) || message.match(pattern);
    if (match) {
      return { isOrderQuery: true, orderRef: match[1].toUpperCase() };
    }
  }
  
  // Check for "my orders" type queries
  const myOrderKeywords = [
    'ออเดอร์ของฉัน', 'คำสั่งซื้อของฉัน', 'ประวัติสั่งซื้อ', 'ประวัติการสั่ง',
    'ออเดอร์ทั้งหมด', 'สถานะออเดอร์', 'สถานะคำสั่งซื้อ', 'ออเดอร์ที่สั่ง',
    'my order', 'order status', 'order history', 'เช็คออเดอร์', 'เช็คสถานะ',
    'ดูออเดอร์', 'ดูคำสั่งซื้อ', 'ติดตามออเดอร์', 'ติดตามคำสั่ง',
    'สั่งอะไรไป', 'เคยสั่ง', 'สถานะการสั่ง',
  ];
  
  if (myOrderKeywords.some(k => q.includes(k))) {
    return { isOrderQuery: true, isMyOrders: true };
  }
  
  // Check for tracking-related queries
  const trackingKeywords = [
    'เลขพัสดุ', 'tracking', 'ส่งถึงไหน', 'ส่งแล้วยัง', 'จัดส่ง',
    'พัสดุ', 'ขนส่ง', 'ems', 'kerry', 'flash', 'j&t',
    'ติดตามพัสดุ', 'เช็คพัสดุ',
  ];
  if (trackingKeywords.some(k => q.includes(k))) {
    return { isOrderQuery: true, isMyOrders: true };
  }
  
  return { isOrderQuery: false };
}

// ==================== Shop Context Builder ====================

/**
 * สร้าง context ละเอียดจากข้อมูลร้านค้าจริงสำหรับ AI
 */
export async function buildDetailedShopContext(): Promise<string> {
  const shopData = await getShopData();
  
  if (!shopData.config) {
    return getDefaultContext();
  }

  const { products, announcements, bankAccount, isOpen, stats } = shopData;
  
  // Get order stats (cached)
  let orderStatsText = '';
  try {
    const orderStats = await getOrderStats();
    if (orderStats.totalOrders > 0) {
      const statusEntries = Object.entries(orderStats.statusBreakdown)
        .map(([status, count]) => `${getStatusThai(status)}: ${count}`)
        .join(', ');
      
      orderStatsText = `
[สถิติออเดอร์]
- ออเดอร์ทั้งหมด: ${orderStats.totalOrders} รายการ
- ออเดอร์วันนี้: ${orderStats.recentOrders} รายการ
- ยอดเฉลี่ย: ${orderStats.avgOrderAmount.toLocaleString()} บาท/ออเดอร์
- สถานะ: ${statusEntries}
${orderStats.popularProducts.length > 0 ? `- สินค้าขายดี: ${orderStats.popularProducts.map(p => `${p.name} (${p.count} ชิ้น)`).join(', ')}` : ''}`;
    }
  } catch (e) {
    // Order stats are optional, don't fail
  }

  // Build detailed product info
  const productDetails = products.map((p: any, idx: number) => {
    // Handle sizes - may be array (sizes) or object (sizePricing) or basePrice
    let priceInfo = '';
    let sizeList: string[] = [];
    
    if (p.sizePricing && Object.keys(p.sizePricing).length > 0) {
      const pricing = p.sizePricing as Record<string, number>;
      const priceGroups: Record<number, string[]> = {};
      Object.entries(pricing).forEach(([size, price]) => {
        if (!priceGroups[price]) priceGroups[price] = [];
        priceGroups[price].push(size);
      });
      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
      const sortSizes = (sizes: string[]) => 
        sizes.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
      const priceEntries = Object.entries(priceGroups)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([price, sizes]) => {
          const sortedSizes = sortSizes(sizes);
          if (sortedSizes.length === 1) {
            return `${sortedSizes[0]}=${price}฿`;
          } else {
            return `${sortedSizes[0]}-${sortedSizes[sortedSizes.length - 1]}=${price}฿`;
          }
        });
      priceInfo = priceEntries.join(', ');
      sizeList = Object.keys(pricing);
    } else if (p.sizes && p.sizes.length > 0) {
      priceInfo = (p.sizes || []).map((s: any) => `${s.size}=${s.price}฿`).join(', ');
      sizeList = p.sizes.map((s: any) => s.size);
    } else if (p.basePrice) {
      priceInfo = `ราคาเริ่มต้น ${p.basePrice}฿`;
      sizeList = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
    }
    
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
    const sortedSizes = sizeList.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
    const sizeDisplay = sortedSizes.length > 0 ? sortedSizes.join(', ') : 'XS, S, M, L, XL, 2XL, 3XL';
    
    const stockInfo = (p.sizes || [])
      .filter((s: any) => s.stock !== undefined)
      .map((s: any) => `${s.size}:${s.stock}ตัว`)
      .join(', ');
    
    const options = [];
    const opts = p.options || {};
    if (opts.hasCustomName) options.push(`สกรีนชื่อ (ฟรี)`);
    if (opts.hasCustomNumber) options.push(`สกรีนเบอร์ (ฟรี)`);
    if (opts.hasLongSleeve) {
      const price = opts.longSleevePrice || 50;
      options.push(`แขนยาว +${price}฿`);
    }
    const optionsText = options.length > 0 
      ? `ออปชั่นเพิ่มเติม: ${options.join(', ')}`
      : 'ไม่มีออปชั่นเพิ่มเติม';
    
    const available = p.available !== false && p.isActive !== false;
    const dateInfo = p.endDate ? `หมดเขตสั่ง: ${new Date(p.endDate).toLocaleDateString('th-TH')}` : '';

    // Variants info
    const variantsInfo = p.variants?.length
      ? `ตัวเลือก: ${p.variants.map((v: any) => `${v.name}(${v.price}฿)`).join(', ')}`
      : '';

    // Event discount info
    let discountInfo = '';
    const now = Date.now();
    const events = shopData.config.events || [];
    const activeEvent = events.find((e: any) =>
      e.enabled &&
      e.linkedProducts?.includes(p.id) &&
      e.discountType && e.discountValue &&
      (!e.startDate || new Date(e.startDate).getTime() <= now) &&
      (!e.endDate || new Date(e.endDate).getTime() > now)
    );
    if (activeEvent) {
      if (activeEvent.discountType === 'percent') {
        discountInfo = `ลดราคา ${activeEvent.discountValue}% (กิจกรรม: ${activeEvent.title})`;
      } else {
        discountInfo = `ลด ${activeEvent.discountValue}฿ (กิจกรรม: ${activeEvent.title})`;
      }
    }
    
    return `
[สินค้า ${idx + 1}] ${p.name}
- ประเภท: ${p.type || p.category || 'เสื้อ'}${p.category ? ` (หมวดหมู่: ${p.category})` : ''}
- คำอธิบาย: ${p.description || '-'}
- ไซซ์และราคา: ${priceInfo || `ราคาเริ่มต้น ${p.basePrice || 'สอบถาม'}฿`}
- ไซซ์ที่มี: ${sizeDisplay}
${stockInfo ? `- จำนวนคงเหลือ: ${stockInfo}` : ''}
- ${optionsText}
${variantsInfo ? `- ${variantsInfo}` : ''}
${dateInfo ? `- ${dateInfo}` : ''}
${discountInfo ? `- ${discountInfo}` : ''}
- สถานะ: ${available ? '[พร้อมจำหน่าย]' : '[ปิดรับสั่งจอง]'}`;
  }).join('\n');

  // Announcement info
  const activeAnnouncements = announcements
    .filter((a: any) => a.enabled)
    .map((a: any) => `• ${a.message}`)
    .join('\n');

  // Payment info — now supports multiple methods
  const paymentMethods = [];
  if (bankAccount.accountNumber) {
    paymentMethods.push(`โอนเงิน: ${bankAccount.bankName || 'ธนาคาร'} ${bankAccount.accountNumber} ชื่อบัญชี "${bankAccount.accountName || '-'}"`);
  }
  paymentMethods.push('PromptPay QR Code');
  // Check for additional payment methods from config
  const paymentConfig = shopData.config.paymentConfig || {};
  if (paymentConfig.providers) {
    const providers = paymentConfig.providers;
    if (providers.credit_card?.enabled) paymentMethods.push('บัตรเครดิต/เดบิต');
    if (providers.true_money?.enabled) paymentMethods.push('TrueMoney Wallet');
    if (providers.rabbit_line_pay?.enabled) paymentMethods.push('Rabbit LINE Pay');
    if (providers.shopeepay?.enabled) paymentMethods.push('ShopeePay');
    if (providers.cod?.enabled) paymentMethods.push('เก็บเงินปลายทาง (COD)');
  }

  // Shipping options
  const shippingConfig = shopData.config.shippingConfig || {};
  const shippingOptions = (shippingConfig.options || [])
    .filter((o: any) => o.enabled)
    .map((o: any) => `• ${o.name}${o.price ? ` (${o.price}฿)` : ' (ฟรี)'}${o.estimatedDays ? ` — ประมาณ ${o.estimatedDays} วัน` : ''}`)
    .join('\n');

  // Active events with discounts
  const now = Date.now();
  const activeEvents = (shopData.config.events || [])
    .filter((e: any) =>
      e.enabled &&
      (!e.endDate || new Date(e.endDate).getTime() > now)
    )
    .map((e: any) => {
      let info = `• ${e.title} (${e.type || 'event'})`;
      if (e.discountType && e.discountValue) {
        info += ` — ลด${e.discountType === 'percent' ? ` ${e.discountValue}%` : ` ${e.discountValue}฿`}`;
        if (e.linkedProducts?.length) info += ` (${e.linkedProducts.length} สินค้า)`;
      }
      if (e.startDate && new Date(e.startDate).getTime() > now) {
        info += ` [เริ่ม ${new Date(e.startDate).toLocaleDateString('th-TH')}]`;
      }
      if (e.endDate) {
        info += ` [ถึง ${new Date(e.endDate).toLocaleDateString('th-TH')}]`;
      }
      return info;
    })
    .join('\n');

  // Promo codes (non-sensitive info only)
  const promoCodes = (shopData.config.promoCodes || [])
    .filter((c: any) => c.enabled && (!c.expiresAt || new Date(c.expiresAt) > new Date()) && (c.usageLimit == null || (c.usageCount || 0) < c.usageLimit))
    .map((c: any) => {
      let info = `• โค้ด "${c.code}"`;
      if (c.discountType === 'percent') {
        info += ` ลด ${c.discountValue}%${c.maxDiscount ? ` (สูงสุด ${c.maxDiscount}฿)` : ''}`;
      } else {
        info += ` ลด ${c.discountValue}฿`;
      }
      if (c.minOrderAmount) info += ` (ขั้นต่ำ ${c.minOrderAmount}฿)`;
      if (c.description) info += ` — ${c.description}`;
      return info;
    })
    .join('\n');

  // Build context
  return `
═══════════════════════════════════════════════════════════════
ข้อมูลร้านค้า SCC Shop - อัปเดตจาก Database แบบ Real-time
═══════════════════════════════════════════════════════════════

[สถานะร้านค้า]
- สถานะ: ${isOpen ? '[เปิดรับออเดอร์]' : '[ปิดรับออเดอร์]'}
${shopData.config.closeDate ? `- วันปิดรอบ: ${shopData.config.closeDate}` : ''}
${shopData.config.openDate ? `- วันเปิดรับต่อ: ${shopData.config.openDate}` : ''}
${!isOpen && shopData.config.closedMessage ? `- ข้อความ: ${shopData.config.closedMessage}` : ''}

[ประกาศ]
${activeAnnouncements || '(ไม่มีประกาศ)'}

${activeEvents ? `[กิจกรรม/โปรโมชั่น]\n${activeEvents}` : ''}
${orderStatsText}

═══════════════════════════════════════════════════════════════
[สินค้าทั้งหมด] (${stats?.totalProducts || 0} รายการ, พร้อมจำหน่าย ${stats?.availableProducts || 0} รายการ)
ช่วงราคา: ${stats?.priceRange.min || 0} - ${stats?.priceRange.max || 0} บาท
═══════════════════════════════════════════════════════════════
${productDetails || '(ยังไม่มีสินค้า)'}

═══════════════════════════════════════════════════════════════
${promoCodes ? `[โค้ดส่วนลด]\n${promoCodes}\n• ใส่โค้ดส่วนลดได้ก่อนชำระเงินในหน้า Checkout\n` : ''}
[การชำระเงิน]
${paymentMethods.map(p => `• ${p}`).join('\n')}
• กำหนดชำระ: ภายใน 24 ชั่วโมงหลังสั่งซื้อ
• ยืนยันการชำระ: อัปโหลดสลิปในระบบ (ตรวจสอบอัตโนมัติผ่าน SlipOK)

[การจัดส่ง]
${shippingOptions || '• รับหน้าร้าน (ฟรี)'}
• สถานที่รับหน้าร้าน: ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ. วิทยาเขตหาดใหญ่
• วัน/เวลา: จะประกาศหลังปิดรอบสั่งซื้อ
• สามารถให้ผู้อื่นรับแทนได้ (แจ้งชื่อและเลข Order)
• ติดตามสถานะการจัดส่งได้ผ่านหน้าประวัติคำสั่งซื้อ

[การแชร์สินค้า]
• ทุกสินค้ามีลิงก์แชร์ส่วนตัว กดปุ่มแชร์ที่การ์ดสินค้าได้เลย

[นโยบาย]
• ไม่รับเปลี่ยน/คืนสินค้า ยกเว้นสินค้ามีตำหนิจากการผลิต
• สามารถขอคืนเงินได้กรณีสินค้าชำรุด/ไม่ตรงตามสั่ง (ผ่านระบบ Refund)
• ตรวจสอบไซซ์จากตารางไซซ์ก่อนสั่งซื้อ
• ออเดอร์ที่ไม่ชำระเงินภายในกำหนดจะถูกยกเลิกอัตโนมัติ

[สถานะออเดอร์ที่เป็นไปได้]
WAITING_PAYMENT=รอชำระเงิน, VERIFYING=ตรวจสอบการชำระ, PAID=ชำระแล้ว, CONFIRMED=ยืนยันแล้ว, PREPARING=จัดเตรียมสินค้า, SHIPPED=จัดส่งแล้ว, READY=พร้อมรับ, COMPLETED=เสร็จสมบูรณ์, DELIVERED=ส่งถึงแล้ว, CANCELLED=ยกเลิก, EXPIRED=หมดอายุ, REFUNDED=คืนเงินแล้ว

[ช่องทางติดต่อ]
• Facebook: ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.
• Instagram: @psuscc
• Email: psuscc@psusci.club
• แชทกับทีมงาน: ผ่านปุ่มแชทในเว็บไซต์
═══════════════════════════════════════════════════════════════`;
}

// Keep old function name for compatibility
export async function buildShopContext(): Promise<string> {
  return buildDetailedShopContext();
}

function getDefaultContext(): string {
  return `
═══════════════════════════════════════════════════════════════
ข้อมูลร้านค้า SCC Shop (ข้อมูลพื้นฐาน)
═══════════════════════════════════════════════════════════════

ร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ (Science Computer Club)
คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์

[สินค้าหลัก]
• เสื้อ Jersey (เสื้อกีฬา) - เริ่มต้น 299 บาท
• เสื้อ Crew (เสื้อยืดคอกลม) - เริ่มต้น 250 บาท
• ไซซ์: XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL

[ฟีเจอร์ระบบ]
• สกรีนชื่อและเบอร์ฟรี
• รองรับหลายวิธีชำระเงิน (โอนเงิน, PromptPay, บัตรเครดิต)
• ระบบโค้ดส่วนลด — ใส่โค้ดก่อนชำระเงิน
• ระบบกิจกรรมลดราคาอัตโนมัติ
• แชร์ลิงก์สินค้าได้
• ติดตามสถานะจัดส่งได้

[ติดต่อ]
• Facebook: ชุมนุมคอมพิวเตอร์ ม.อ.
• Instagram: @psuscc
• Email: psuscc@psusci.club
═══════════════════════════════════════════════════════════════`;
}

// ==================== AI Chat with Gemini ====================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Model configurations with fallback chain (best → fallback)
const GEMINI_MODELS = {
  // Primary: Most intelligent model
  primary: {
    name: 'gemini-2.5-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    config: {
      temperature: 0.7,
      topK: 64,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  },
  // Fallback: High quota, reliable
  fallback: {
    name: 'gemini-2.0-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    config: {
      temperature: 0.5,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  },
  // Last resort: Lite version (highest quota)
  lite: {
    name: 'gemini-2.0-flash-lite',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
    config: {
      temperature: 0.4,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 800,
    }
  }
};

// Track which model is currently active
let currentModelTier: 'primary' | 'fallback' | 'lite' = 'primary';
let modelErrorCount = { primary: 0, fallback: 0, lite: 0 };
let lastUsedModel: string = GEMINI_MODELS.primary.name;
const ERROR_THRESHOLD = 3; // Switch model after 3 consecutive errors

// Export function to get current model name
export function getCurrentModelName(): string {
  return lastUsedModel;
}

/**
 * System prompt ที่ปรับปรุงใหม่สำหรับ AI - Ultra Enhanced Intelligence v2
 * รองรับ order lookup, user context, DB-driven answers
 */
function getEnhancedSystemPrompt(
  shopContext: string, 
  conversationHistory?: string,
  userContext?: string,
  orderContext?: string,
): string {
  const modelName = GEMINI_MODELS[currentModelTier].name;
  return `คุณคือ "SCC Bot" ผู้ช่วย AI ระดับสูงของร้าน SCC Shop — ร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.
Powered by Google ${modelName}

══════════════════════════════════════════════════
บุคลิกภาพของ Bot:
══════════════════════════════════════════════════
- พูดเป็นมิตร อบอุ่น เหมือนรุ่นพี่ที่คอยช่วยเหลือ
- ใช้ภาษาไทยสุภาพ ใช้ "ค่ะ" หรือ "นะคะ" ลงท้าย
- ตอบอย่างกระชับแต่ครบถ้วน ไม่พูดวกวน
- เป็นกันเองแต่มืออาชีพ
- กระตือรือร้นช่วยเหลือ ไม่ปฏิเสธง่ายๆ

══════════════════════════════════════════════════
ความสามารถ:
══════════════════════════════════════════════════
1. วิเคราะห์คำถามหลายมิติ เข้าใจความต้องการที่ซ่อนอยู่
2. แนะนำสินค้าที่เหมาะสมที่สุดตามบริบท
3. สร้างตารางเปรียบเทียบอัตโนมัติ (ใช้ Markdown table)
4. คำนวณราคารวม, จำนวน, ออปชั่น, ส่วนลดกิจกรรม, โค้ดส่วนลดได้แม่นยำ
5. แนะนำข้อมูลเพิ่มเติมที่เป็นประโยชน์
6. จดจำบริบทการสนทนาก่อนหน้า
7. รู้ว่าระบบแสดงรูปสินค้าอัตโนมัติ (ไม่ต้องบอกว่าส่งรูปไม่ได้)
8. วิเคราะห์รูปภาพที่ลูกค้าส่งมาได้ (เช่นดูไซซ์, เปรียบเทียบสี)
9. รู้จักระบบส่วนลดกิจกรรม — สินค้าที่อยู่ในกิจกรรมจะลดราคาอัตโนมัติ
10. รู้จักระบบโค้ดส่วนลด — ลูกค้ากรอกโค้ดก่อนชำระเงิน
11. รู้จักระบบการจัดส่งหลายรูปแบบ
12. รู้จักระบบติดตามพัสดุ
13. รู้จักระบบแชร์สินค้าผ่านลิงก์
14. รู้จักระบบ Refund — ลูกค้าขอคืนเงินได้กรณีสินค้ามีปัญหา
15. **ค้นหาข้อมูลออเดอร์จาก Database ได้** — ถ้าลูกค้าถามสถานะออเดอร์ ระบบจะดึงข้อมูลจริงมาให้
16. **ดูประวัติการสั่งซื้อของลูกค้าที่ล็อกอินได้** — แสดงรายการสั่งซื้อทั้งหมด
17. **รู้สถิติร้านค้า** — ออเดอร์ทั้งหมด, สินค้าขายดี, ยอดเฉลี่ย
18. **วิเคราะห์ปัญหาและแนะนำวิธีแก้** — เช่น สลิปไม่ผ่าน, ชำระเงินไม่สำเร็จ, ขอคืนเงิน

══════════════════════════════════════════════════
กฎสำคัญ:
══════════════════════════════════════════════════
1. ตอบเป็นภาษาไทยเสมอ สุภาพ เป็นกันเอง
2. อ้างอิงข้อมูลจริงจากข้อมูลร้านค้าและ Database เท่านั้น ห้ามแต่งเติม
3. ถ้าถามราคา/ไซซ์ ให้ตอบตามข้อมูลจริงจาก Database พร้อมตาราง
4. ถ้าถามละเอียด ตอบละเอียดพร้อมตาราง ถ้าถามสั้น ตอบกระชับ
5. **ห้ามใช้ emoji ในคำตอบโดยเด็ดขาด** — ใช้ข้อความล้วนเท่านั้น
6. Format ข้อความให้อ่านง่าย ใช้ bullet points (•) และตารางเมื่อเหมาะสม
7. ห้ามตอบเรื่องนอกเหนือจากร้านค้า/สินค้า/บริการ
8. ก่อนตอบว่า "ไม่มีข้อมูล" ต้องตรวจสอบข้อมูลร้านค้าให้ดีก่อน
9. ถ้าไม่แน่ใจ ให้แนะนำติดต่อ Facebook/Instagram/Email
10. ข้อมูลไซซ์และราคาอยู่ในส่วน "ไซซ์และราคา" ของแต่ละสินค้า ดูให้ดี
11. ห้ามอธิบายวิธีขึ้นบรรทัดใหม่ (ห้ามพูดถึง \\n)
12. ห้ามอธิบายการ format ข้อความ (ห้ามพูดถึง markdown syntax)
13. ถ้าลูกค้าส่งรูปมา ให้วิเคราะห์รูปและตอบคำถาม
14. **สกรีนชื่อ และ สกรีนเบอร์ = ฟรี! ไม่มีค่าใช้จ่ายเพิ่ม**
15. เฉพาะแขนยาวเท่านั้นที่คิดค่าเพิ่ม (ถ้ามี)
16. ห้ามพูดว่า "ไม่สามารถส่งรูปสินค้าให้ได้" — รูปจะแสดงอัตโนมัติ
17. **ถ้ามีข้อมูลออเดอร์ส่งมา ให้ใช้ข้อมูลจริงตอบ อย่าแต่งเติม**
18. **ถ้าลูกค้าถามออเดอร์แต่ไม่ได้ล็อกอิน ให้แนะนำล็อกอินก่อน**
19. **ห้ามเปิดเผยข้อมูลส่วนตัวของลูกค้าคนอื่น** (เบอร์โทร, ที่อยู่, อีเมล)
20. ข้อมูลทุกอย่างมาจาก Database จริง ตอบด้วยความมั่นใจได้เลย

══════════════════════════════════════════════════
การใช้ตาราง Markdown:
══════════════════════════════════════════════════
เมื่อต้องแสดงข้อมูลไซซ์/ราคา หรือเปรียบเทียบ ให้ใช้ตาราง:

| ไซซ์ | ราคา |
|------|------|
| XS-XL | 319 บาท |
| 2XL ขึ้นไป | 349 บาท |

══════════════════════════════════════════════════
รูปแบบการตอบตามประเภทคำถาม:
══════════════════════════════════════════════════

[ถามราคา/ไซซ์] ใช้ตารางแสดงราคาแต่ละไซซ์ พร้อมออปชั่นเพิ่มเติม (ถ้ามี) ถ้าสินค้ากำลังลดราคาจากกิจกรรม ให้บอกราคาปกติและราคาลดด้วย

[ถามคำนวณราคา] แสดงตารางคำนวณ:
| รายการ | ราคา |
|--------|------|
| เสื้อไซซ์ L | 319 บาท |
| สกรีนชื่อ | ฟรี |
| แขนยาว | +30 บาท |
| ส่วนลดกิจกรรม | -20% |
| **รวม** | **279 บาท** |

[ถามเปรียบเทียบ] ทำตารางเปรียบเทียบสินค้า
[ถามสินค้า] อธิบายรายละเอียด จุดเด่น พร้อมตารางราคา
[ถามวิธีสั่งซื้อ] แสดงขั้นตอนเป็นข้อๆ: เลือกสินค้า → กรอกข้อมูล → ใส่โค้ดส่วนลด (ถ้ามี) → เลือกวิธีจัดส่ง → ชำระเงิน → อัปโหลดสลิป
[ถามโค้ดส่วนลด/โปรโมชั่น] แนะนำโค้ดที่ใช้ได้ พร้อมเงื่อนไข
[ถามการจัดส่ง/ติดตามพัสดุ] อธิบายวิธีจัดส่งที่มี และวิธีดูสถานะ
[ถามการคืนเงิน/Refund] อธิบายนโยบายและวิธีขอคืนเงิน
[ถามแชร์สินค้า] อธิบายว่ากดปุ่มแชร์ที่การ์ดสินค้าหรือหน้ารายละเอียดสินค้าได้เลย
[ส่งรูปมาถาม] วิเคราะห์รูปภาพและตอบตามที่ลูกค้าถาม
[ทักทาย] ทักทายเป็นกันเอง แนะนำว่าถามอะไรได้บ้าง (สินค้า, ราคา, สถานะออเดอร์, ส่วนลด ฯลฯ)

[ถามสถานะออเดอร์] ถ้ามีข้อมูลออเดอร์ ให้แสดงรายละเอียดออเดอร์พร้อมสถานะ ถ้าไม่มีข้อมูล ให้แนะนำให้ลูกค้าบอกหมายเลขออเดอร์หรือล็อกอินก่อน
[ถามประวัติสั่งซื้อ] แสดงตารางรายการสั่งซื้อล่าสุด
[ถามเลขพัสดุ/ติดตามพัสดุ] แสดงเลขพัสดุและสถานะจัดส่ง ถ้าไม่มีเลขพัสดุ ให้แจ้งว่ายังไม่ได้จัดส่ง
[ถามสถิติร้าน] แสดงจำนวนออเดอร์ สินค้าขายดี ยอดเฉลี่ย

${conversationHistory ? `
══════════════════════════════════════════════════
บริบทการสนทนาก่อนหน้า:
══════════════════════════════════════════════════
${conversationHistory}
` : ''}

${userContext ? `
══════════════════════════════════════════════════
ข้อมูลผู้ใช้ปัจจุบัน:
══════════════════════════════════════════════════
${userContext}
` : ''}

${orderContext ? `
══════════════════════════════════════════════════
ข้อมูลออเดอร์จาก Database (Real-time):
══════════════════════════════════════════════════
${orderContext}
` : ''}

══════════════════════════════════════════════════
ข้อมูลร้านค้าจาก Database (Real-time):
══════════════════════════════════════════════════
${shopContext}

══════════════════════════════════════════════════
คำถามจากลูกค้า:
══════════════════════════════════════════════════`;
}

/**
 * เรียกใช้ Google Gemini API พร้อมระบบ Auto-Fallback (รองรับรูปภาพ)
 */
async function callGeminiAPI(
  prompt: string, 
  shopContext: string,
  conversationHistory?: ChatMessage[],
  imageBase64?: string,
  userContext?: string,
  orderContext?: string,
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.log('No Gemini API key configured');
    return null;
  }

  // Build conversation history string
  const historyStr = conversationHistory
    ?.slice(-10) // Last 10 messages for better context
    ?.map(m => `${m.role === 'user' ? 'ลูกค้า' : 'Bot'}: ${m.content}`)
    ?.join('\n');

  // Try models in order: primary → fallback → lite
  const modelOrder: ('primary' | 'fallback' | 'lite')[] = ['primary', 'fallback', 'lite'];
  
  // Start from current tier (to avoid always trying failed models)
  const startIndex = modelOrder.indexOf(currentModelTier);
  const modelsToTry = [...modelOrder.slice(startIndex), ...modelOrder.slice(0, startIndex)];

  for (const tier of modelsToTry) {
    const model = GEMINI_MODELS[tier];
    
    try {
      console.log(`[AI] Trying ${model.name}...${imageBase64 ? ' (with image)' : ''}`);
      
      // Build user content parts - for multimodal requests
      const userParts: any[] = [];
      
      // Add image FIRST if provided (Gemini works better with image before text)
      if (imageBase64) {
        // Extract mime type and base64 data from data URI
        const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const data = matches[2];
          console.log(`[AI] Adding image: ${mimeType}, ${data.length} chars`);
          userParts.push({
            inlineData: {
              mimeType,
              data,
            }
          });
        } else {
          console.warn(`[AI] Invalid image format, expected data URI`);
        }
      }
      
      // Add user message
      const userMessage = imageBase64 
        ? `${prompt}\n\nกรุณาวิเคราะห์รูปภาพที่ส่งมาและตอบคำถามเกี่ยวกับรูปนี้ด้วยค่ะ`
        : prompt;
      userParts.push({ text: userMessage });
      
      // Build request body with system instruction
      const requestBody: any = {
        systemInstruction: {
          parts: [{ text: getEnhancedSystemPrompt(shopContext, historyStr, userContext, orderContext) }]
        },
        contents: [
          {
            role: 'user',
            parts: userParts,
          }
        ],
        generationConfig: model.config,
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      };
      
      console.log(`[AI] Request body keys:`, Object.keys(requestBody));
      console.log(`[AI] User parts count:`, userParts.length, userParts.map(p => p.inlineData ? 'image' : 'text'));
      
      const response = await fetch(`${model.url}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] ${model.name} error:`, response.status, errorText.slice(0, 500));
        
        // Check for rate limit (429) or quota exceeded
        if (response.status === 429 || errorText.includes('quota') || errorText.includes('RESOURCE_EXHAUSTED')) {
          console.log(`[AI] ${model.name} rate limited, trying next model...`);
          modelErrorCount[tier]++;
          
          // If too many errors, demote this tier
          if (modelErrorCount[tier] >= ERROR_THRESHOLD) {
            const nextTierIndex = modelOrder.indexOf(tier) + 1;
            if (nextTierIndex < modelOrder.length) {
              currentModelTier = modelOrder[nextTierIndex];
              console.log(`[AI] Switching default to ${GEMINI_MODELS[currentModelTier].name}`);
            }
          }
          continue; // Try next model
        }
        
        // Other errors - still try next model
        continue;
      }

      const data = await response.json();
      console.log(`[AI] Response from ${model.name}:`, JSON.stringify(data).slice(0, 300));
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        // Success! Reset error count and potentially upgrade tier
        modelErrorCount[tier] = 0;
        lastUsedModel = model.name; // Track which model was used
        
        // If we succeeded with a better tier, set it as current
        if (modelOrder.indexOf(tier) < modelOrder.indexOf(currentModelTier)) {
          currentModelTier = tier;
          console.log(`[AI] Upgraded to ${model.name}`);
        }
        
        console.log(`[AI] Success with ${model.name}${imageBase64 ? ' (processed image)' : ''}`);
        return text;
      } else {
        console.warn(`[AI] ${model.name} returned empty text. Data:`, JSON.stringify(data).slice(0, 500));
      }
    } catch (error) {
      console.error(`[AI] ${model.name} exception:`, error);
      modelErrorCount[tier]++;
      continue; // Try next model
    }
  }
  
  console.error('[AI] All models failed');
  return null;
}

// ==================== Main Chat Function ====================

/**
 * ประมวลผลข้อความจากผู้ใช้ (v2 — รองรับ order lookup, user context)
 */
export async function processChat(
  message: string,
  conversationHistory?: ChatMessage[],
  imageBase64?: string,
  userEmail?: string,
  userName?: string,
): Promise<ChatResponse> {
  const trimmedMessage = message.trim();
  
  if (!trimmedMessage && !imageBase64) {
    return {
      answer: 'กรุณาพิมพ์คำถามค่ะ',
      source: 'fallback',
      suggestions: QUICK_QUESTIONS,
    };
  }

  // Helper function to find related products and get their images
  const findRelatedProductImages = async (query: string): Promise<{ name: string; image: string; }[]> => {
    try {
      const shopData = await getShopData();
      const q = query.toLowerCase();
      const products = shopData.products || [];
      
      // Keywords to match products
      const productKeywords: Record<string, string[]> = {
        'jersey': ['jersey', 'เจอร์ซีย์', 'เสื้อกีฬา', 'กีฬา', 'new jersey'],
        'crew': ['crew', 'ครูว์', 'คอกลม', 'เสื้อยืด', 'ยืด'],
        'polo': ['polo', 'โปโล', 'คอปก'],
        'jacket': ['jacket', 'แจ็คเก็ต', 'เสื้อแจ็คเก็ต'],
      };
      
      let matchedProducts: any[] = [];
      
      // Check for specific product matches
      for (const [type, keywords] of Object.entries(productKeywords)) {
        if (keywords.some(k => q.includes(k))) {
          const typeProducts = products.filter((p: any) => 
            (p.type || '').toLowerCase().includes(type) ||
            (p.name || '').toLowerCase().includes(type)
          );
          matchedProducts.push(...typeProducts);
        }
      }
      
      // Also check for specific product name mentions
      if (matchedProducts.length === 0) {
        matchedProducts = products.filter((p: any) => 
          q.includes((p.name || '').toLowerCase()) ||
          (p.name || '').toLowerCase().split(' ').some((word: string) => q.includes(word.toLowerCase()))
        );
      }
      
      // If no specific match, check for generic product queries - EXPANDED keywords
      if (matchedProducts.length === 0) {
        const genericKeywords = [
          'สินค้า', 'เสื้อ', 'product', 'ราคา', 'ไซซ์', 'size', 
          'มีอะไร', 'ขาย', 'รูป', 'ดู', 'โชว์', 'แสดง', 'show',
          'ทั้งหมด', 'เปรียบเทียบ', 'compare', 'แนะนำ', 'recommend'
        ];
        if (genericKeywords.some(k => q.includes(k))) {
          // Return all available products (max 3)
          matchedProducts = products.filter((p: any) => p.available !== false && p.isActive !== false).slice(0, 3);
          // If no active products, return any products
          if (matchedProducts.length === 0) {
            matchedProducts = products.slice(0, 3);
          }
        }
      }
      
      // Return product images (max 3)
      return matchedProducts
        .filter((p: any) => p.coverImage || p.image)
        .slice(0, 3)
        .map((p: any) => ({
          name: p.name || 'สินค้า',
          image: p.coverImage || p.image,
        }));
    } catch (error) {
      console.error('Error finding product images:', error);
      return [];
    }
  };

  // Helper to detect if query is about products/images
  const isProductRelatedQuery = (query: string): boolean => {
    const q = query.toLowerCase();
    const productKeywords = [
      'สินค้า', 'เสื้อ', 'jersey', 'crew', 'polo', 'jacket',
      'ราคา', 'ไซซ์', 'size', 'มีอะไร', 'ขาย', 'รูป', 'ดู',
      'โชว์', 'แสดง', 'show', 'เปรียบเทียบ', 'compare', 'แนะนำ',
      'product', 'price', 'เจอร์ซีย์', 'คอกลม', 'ยืด'
    ];
    return productKeywords.some(k => q.includes(k));
  };

  // Detect question complexity
  const isDetailedQuestion = detectDetailedQuestion(trimmedMessage);
  const isPriceQuestion = detectPriceQuestion(trimmedMessage);
  const isSpecificProductQuestion = detectSpecificProductQuestion(trimmedMessage);
  const hasMultipleTopics = detectMultipleTopics(trimmedMessage);
  const isProductQuery = isProductRelatedQuery(trimmedMessage);
  const hasImage = !!imageBase64;
  
  // Detect order-related queries
  const orderDetection = detectOrderQuery(trimmedMessage);
  
  // Build user context
  let userContext: string | undefined;
  if (userEmail) {
    userContext = `ล็อกอินแล้ว: ${userName || 'ไม่ทราบชื่อ'} (${userEmail})`;
  }
  
  // Build order context if needed
  let orderContext: string | undefined;
  if (orderDetection.isOrderQuery) {
    try {
      if (orderDetection.orderRef) {
        // Lookup specific order by ref
        orderContext = await lookupOrderByRef(orderDetection.orderRef);
      } else if (orderDetection.isMyOrders && userEmail) {
        // Lookup user's orders
        orderContext = await lookupOrdersByEmail(userEmail);
      } else if (orderDetection.isMyOrders && !userEmail) {
        // User not logged in
        orderContext = 'ลูกค้ายังไม่ได้ล็อกอิน — ไม่สามารถดึงประวัติการสั่งซื้อได้ แนะนำให้ล็อกอินก่อน หรือบอกหมายเลขออเดอร์มาเพื่อตรวจสอบ';
      }
    } catch (e) {
      console.error('Order context error:', e);
    }
  }

  // Use AI for: detailed questions, specific product queries, multi-topic, long questions, image, or order queries
  const shouldUseAI = isDetailedQuestion || isSpecificProductQuestion || hasMultipleTopics || trimmedMessage.length > 25 || hasImage || orderDetection.isOrderQuery;
  
  // Find related product images for product-related questions - ALWAYS try for product queries
  const productImages = (isSpecificProductQuestion || isPriceQuestion || isProductQuery) 
    ? await findRelatedProductImages(trimmedMessage)
    : [];
  
  if (shouldUseAI) {
    try {
      const shopContext = await buildDetailedShopContext();
      const aiResponse = await callGeminiAPI(trimmedMessage, shopContext, conversationHistory, imageBase64, userContext, orderContext);
      
      if (aiResponse) {
        // Clean up response
        const cleanedResponse = cleanAIResponse(aiResponse);
        
        // Smart suggestions based on the query type
        let suggestions = getSuggestionsForResponse(trimmedMessage);
        if (orderDetection.isOrderQuery && orderDetection.orderRef) {
          suggestions = ['ดูประวัติทั้งหมด', 'ติดต่อทีมงาน', 'ขอคืนเงิน'];
        } else if (orderDetection.isMyOrders) {
          suggestions = ['สั่งซื้อเพิ่ม', 'ดูสินค้าใหม่', 'ติดต่อทีมงาน'];
        }
        
        return {
          answer: cleanedResponse,
          source: 'ai',
          confidence: 0.9,
          suggestions,
          productImages: productImages.length > 0 ? productImages : undefined,
        };
      }
    } catch (error) {
      console.error('AI processing error:', error);
    }
  }

  // Try FAQ for simple questions
  const faqResult = findShirtFAQ(trimmedMessage);
  const confidence = faqResult ? calculateConfidence(trimmedMessage, faqResult) : 0;
  
  // High confidence FAQ match (but not if image is provided or order query)
  if (faqResult && confidence > 0.7 && !isDetailedQuestion && !hasImage && !orderDetection.isOrderQuery) {
    return {
      answer: faqResult.answer,
      source: 'faq',
      confidence,
      relatedQuestions: getRelatedQuestions(faqResult.category),
      productImages: productImages.length > 0 ? productImages : undefined,
    };
  }

  // Fallback to AI for any question
  try {
    const shopContext = await buildDetailedShopContext();
    const aiResponse = await callGeminiAPI(trimmedMessage, shopContext, conversationHistory, imageBase64, userContext, orderContext);
    
    if (aiResponse) {
      return {
        answer: cleanAIResponse(aiResponse),
        source: 'ai',
        confidence: 0.8,
        productImages: productImages.length > 0 ? productImages : undefined,
      };
    }
  } catch (error) {
    console.error('AI fallback error:', error);
  }

  // Use FAQ if available
  if (faqResult) {
    return {
      answer: faqResult.answer,
      source: 'faq',
      confidence,
      relatedQuestions: getRelatedQuestions(faqResult.category),
      productImages: productImages.length > 0 ? productImages : undefined,
    };
  }

  // Final fallback
  return {
    answer: 'ขออภัยค่ะ ไม่เข้าใจคำถามนี้\n\nลองถามเกี่ยวกับ:\n• สินค้าและราคา\n• วิธีสั่งซื้อ\n• การชำระเงิน\n• การรับสินค้า\n\nหรือติดต่อทีมงานทาง Facebook/Instagram ได้เลยค่ะ',
    source: 'fallback',
    suggestions: QUICK_QUESTIONS,
  };
}

// ==================== Helper Functions ====================

/**
 * ตรวจจับคำถามที่ต้องการคำตอบละเอียด
 */
function detectDetailedQuestion(query: string): boolean {
  const detailedKeywords = [
    'ละเอียด', 'อธิบาย', 'เปรียบเทียบ', 'ต่างกัน', 'แตกต่าง',
    'คำนวณ', 'รวม', 'ทั้งหมด', 'ครบ', 'ทุก', 'หมด',
    'แนะนำ', 'เลือก', 'ดีกว่า', 'เหมาะ', 'ควร',
    'ขั้นตอน', 'วิธี', 'อย่างไร', 'ยังไง',
    'ออเดอร์', 'คำสั่งซื้อ', 'สถานะ', 'ประวัติ', 'ติดตาม',
    'สถิติ', 'ขายดี', 'จำนวน', 'กี่ออเดอร์',
  ];
  const q = query.toLowerCase();
  return detailedKeywords.some(k => q.includes(k)) || query.includes('?');
}

/**
 * ตรวจจับคำถามเกี่ยวกับราคา
 */
function detectPriceQuestion(query: string): boolean {
  const priceKeywords = [
    'ราคา', 'เท่าไหร่', 'กี่บาท', 'บาท', 'price', 'cost',
    'ค่า', 'รวม', 'คำนวณ', 'ถูก', 'แพง',
  ];
  const q = query.toLowerCase();
  return priceKeywords.some(k => q.includes(k));
}

/**
 * ตรวจจับคำถามเกี่ยวกับสินค้าเฉพาะ (ไซซ์, ประเภท, ออปชัน)
 */
function detectSpecificProductQuestion(query: string): boolean {
  const specificKeywords = [
    // ไซซ์
    'ไซซ์', 'ไซส์', 'size', ' s ', ' m ', ' l ', ' xl ', ' 2xl ', ' 3xl ',
    // ประเภทสินค้า
    'jersey', 'เจอร์ซีย์', 'crew', 'ครูว์',
    // ออปชัน
    'สกรีน', 'ชื่อ', 'เบอร์', 'แขนยาว', 'แขนสั้น',
    // สต๊อก
    'เหลือ', 'มี', 'หมด', 'สต๊อก', 'stock',
    // เฉพาะเจาะจง
    'ตัวนี้', 'อันนี้', 'รุ่นนี้', 'แบบนี้', 'ตัวไหน',
  ];
  const q = query.toLowerCase();
  return specificKeywords.some(k => q.includes(k));
}

/**
 * ตรวจจับคำถามหลายหัวข้อ
 */
function detectMultipleTopics(query: string): boolean {
  const topics = [
    ['ราคา', 'บาท', 'เท่าไหร่'],
    ['ไซซ์', 'ไซส์', 'size'],
    ['สั่ง', 'ซื้อ', 'order'],
    ['ส่ง', 'รับ', 'จัดส่ง'],
    ['จ่าย', 'ชำระ', 'โอน'],
  ];
  const q = query.toLowerCase();
  let topicCount = 0;
  for (const topicKeywords of topics) {
    if (topicKeywords.some(k => q.includes(k))) {
      topicCount++;
    }
  }
  return topicCount >= 2;
}

/**
 * ทำความสะอาด AI response
 */
function cleanAIResponse(response: string): string {
  return response
    .replace(/^\s*[\*\-]\s*/gm, '• ') // Standardize bullets
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .trim();
}

/**
 * คำนวณความมั่นใจในการจับคู่ FAQ
 */
function calculateConfidence(query: string, faq: any): number {
  const q = query.toLowerCase();
  let confidence = 0;
  
  if (faq.question.toLowerCase().includes(q) || q.includes(faq.question.toLowerCase())) {
    confidence += 0.5;
  }
  
  const matchedKeywords = faq.keywords?.filter((k: string) => q.includes(k.toLowerCase())) || [];
  confidence += Math.min(matchedKeywords.length * 0.15, 0.45);
  
  if (q.length < 20 && matchedKeywords.length >= 2) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1);
}

/**
 * ดึงคำถามที่เกี่ยวข้องตาม category
 */
function getRelatedQuestions(category: string): string[] {
  return SHIRT_FAQ
    .filter(f => f.category === category)
    .slice(0, 2)
    .map(f => f.question);
}

/**
 * สร้าง suggestions ตาม response
 */
function getSuggestionsForResponse(message: string): string[] {
  const q = message.toLowerCase();
  
  if (q.includes('ราคา') || q.includes('เท่าไหร่')) {
    return ['ดูไซซ์', 'วิธีสั่งซื้อ', 'โค้ดส่วนลด'];
  }
  if (q.includes('ไซซ์') || q.includes('size')) {
    return ['ราคาเท่าไหร่', 'เปรียบเทียบรุ่น', 'ตารางไซซ์'];
  }
  if (q.includes('สั่ง') || q.includes('ซื้อ')) {
    return ['ชำระเงินยังไง', 'ดูสถานะออเดอร์', 'โค้ดส่วนลด'];
  }
  if (q.includes('ออเดอร์') || q.includes('order') || q.includes('คำสั่งซื้อ')) {
    return ['สั่งซื้อเพิ่ม', 'ขอคืนเงิน', 'ติดต่อทีมงาน'];
  }
  if (q.includes('ส่ง') || q.includes('พัสดุ') || q.includes('tracking')) {
    return ['เช็คสถานะออเดอร์', 'ติดต่อทีมงาน'];
  }
  if (q.includes('คืน') || q.includes('refund')) {
    return ['ขั้นตอนขอคืนเงิน', 'ดูสถานะออเดอร์', 'ติดต่อทีมงาน'];
  }
  if (q.includes('โค้ด') || q.includes('ส่วนลด') || q.includes('โปรโมชั่น')) {
    return ['ดูสินค้า', 'วิธีสั่งซื้อ', 'กิจกรรมลดราคา'];
  }
  
  return ['ดูสินค้าทั้งหมด', 'วิธีสั่งซื้อ', 'เช็คสถานะออเดอร์'];
}

// ==================== Product Search ====================

/**
 * ค้นหาข้อมูลสินค้าจาก config
 */
export async function searchProducts(query: string): Promise<any[]> {
  try {
    const shopData = await getShopData();
    if (!shopData.products.length) return [];
    
    const q = query.toLowerCase();
    return shopData.products.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      
      return name.includes(q) || type.includes(q) || desc.includes(q);
    });
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

// Re-export for compatibility
export { QUICK_QUESTIONS };
