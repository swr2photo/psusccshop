// src/lib/ai-chatbot.ts
// AI-powered chatbot using Google Gemini with real-time shop database context

import { getShopConfig, getAllOrders } from './supabase';
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

// ==================== Database Functions ====================

/**
 * ดึงข้อมูลร้านค้าแบบละเอียดจาก database
 */
export async function getShopData(): Promise<ShopData> {
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

    return {
      config,
      products,
      announcements: config.announcements || [],
      bankAccount: config.bankAccount || {},
      isOpen: config.isOpen !== false,
      stats: {
        totalProducts: products.length,
        availableProducts: availableProducts.length,
        priceRange: { 
          min: minPrice === Infinity ? 0 : minPrice, 
          max: maxPrice 
        },
      },
    };
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

  // Build detailed product info
  const productDetails = products.map((p: any, idx: number) => {
    // Handle sizes - may be array (sizes) or object (sizePricing) or basePrice
    let priceInfo = '';
    let sizeList: string[] = [];
    
    if (p.sizePricing && Object.keys(p.sizePricing).length > 0) {
      // New format: sizePricing object { "S": 319, "M": 319, "XL": 349 }
      const pricing = p.sizePricing as Record<string, number>;
      
      // Group sizes by price for cleaner display
      const priceGroups: Record<number, string[]> = {};
      Object.entries(pricing).forEach(([size, price]) => {
        if (!priceGroups[price]) priceGroups[price] = [];
        priceGroups[price].push(size);
      });
      
      // Sort sizes properly
      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
      const sortSizes = (sizes: string[]) => 
        sizes.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
      
      // Format price info by groups
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
      // Old format: sizes array [{ size: "S", price: 319 }]
      priceInfo = (p.sizes || []).map((s: any) => `${s.size}=${s.price}฿`).join(', ');
      sizeList = p.sizes.map((s: any) => s.size);
      
    } else if (p.basePrice) {
      // Fallback: just basePrice
      priceInfo = `ราคาเริ่มต้น ${p.basePrice}฿`;
      sizeList = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']; // Default sizes
    }
    
    // Format size list for display
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
    const sortedSizes = sizeList.sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
    const sizeDisplay = sortedSizes.length > 0 ? sortedSizes.join(', ') : 'XS, S, M, L, XL, 2XL, 3XL';
    
    const stockInfo = (p.sizes || [])
      .filter((s: any) => s.stock !== undefined)
      .map((s: any) => `${s.size}:${s.stock}ตัว`)
      .join(', ');
    
    // Handle options - read from product.options
    const options = [];
    const opts = p.options || {};
    
    // สกรีนชื่อและเบอร์ ฟรี! (ไม่มี customNamePrice/customNumberPrice ในระบบ)
    // มีเฉพาะ longSleevePrice เท่านั้นที่คิดค่าเพิ่ม
    if (opts.hasCustomName) {
      options.push(`สกรีนชื่อ (ฟรี)`);
    }
    if (opts.hasCustomNumber) {
      options.push(`สกรีนเบอร์ (ฟรี)`);
    }
    if (opts.hasLongSleeve) {
      const price = opts.longSleevePrice || 50;
      options.push(`แขนยาว +${price}฿`);
    }
    
    // If no options enabled, note it
    const optionsText = options.length > 0 
      ? `ออปชั่นเพิ่มเติม: ${options.join(', ')}`
      : 'ไม่มีออปชั่นเพิ่มเติม';
    
    const available = p.available !== false && p.isActive !== false;
    
    // Extract dates if available
    const dateInfo = p.endDate ? `หมดเขตสั่ง: ${new Date(p.endDate).toLocaleDateString('th-TH')}` : '';
    
    return `
[สินค้า ${idx + 1}] ${p.name}
- ประเภท: ${p.type || 'เสื้อ'}
- คำอธิบาย: ${p.description || '-'}
- ไซซ์และราคา: ${priceInfo || `ราคาเริ่มต้น ${p.basePrice || 'สอบถาม'}฿`}
- ไซซ์ที่มี: ${sizeDisplay}
${stockInfo ? `- จำนวนคงเหลือ: ${stockInfo}` : ''}
- ${optionsText}
${dateInfo ? `- ${dateInfo}` : ''}
- สถานะ: ${available ? '[พร้อมจำหน่าย]' : '[ปิดรับสั่งจอง]'}`;
  }).join('\n');

  // Announcement info
  const activeAnnouncements = announcements
    .filter((a: any) => a.enabled)
    .map((a: any) => `• ${a.message}`)
    .join('\n');

  // Payment info
  const paymentMethods = [];
  if (bankAccount.accountNumber) {
    paymentMethods.push(`โอนเงิน: ${bankAccount.bankName || 'ธนาคาร'} ${bankAccount.accountNumber} ชื่อบัญชี "${bankAccount.accountName || '-'}"`);
  }
  paymentMethods.push('PromptPay QR Code');

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

═══════════════════════════════════════════════════════════════
[สินค้าทั้งหมด] (${stats?.totalProducts || 0} รายการ, พร้อมจำหน่าย ${stats?.availableProducts || 0} รายการ)
ช่วงราคา: ${stats?.priceRange.min || 0} - ${stats?.priceRange.max || 0} บาท
═══════════════════════════════════════════════════════════════
${productDetails || '(ยังไม่มีสินค้า)'}

═══════════════════════════════════════════════════════════════
[การชำระเงิน]
${paymentMethods.map(p => `• ${p}`).join('\n')}
• กำหนดชำระ: ภายใน 24 ชั่วโมงหลังสั่งซื้อ
• ยืนยันการชำระ: อัปโหลดสลิปในระบบ (ตรวจสอบอัตโนมัติ)

[การรับสินค้า]
• สถานที่: ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ. วิทยาเขตหาดใหญ่
• วัน/เวลา: จะประกาศหลังปิดรอบสั่งซื้อ
• สามารถให้ผู้อื่นรับแทนได้ (แจ้งชื่อและเลข Order)

[นโยบาย]
• ไม่รับเปลี่ยน/คืนสินค้า ยกเว้นสินค้ามีตำหนิจากการผลิต
• ตรวจสอบไซซ์จากตารางไซซ์ก่อนสั่งซื้อ
• ออเดอร์ที่ไม่ชำระเงินภายในกำหนดจะถูกยกเลิกอัตโนมัติ

[ช่องทางติดต่อ]
• Facebook: ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.
• Instagram: @psuscc
• Email: psuscc@psusci.club
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

[ติดต่อ]
• Facebook: ชุมนุมคอมพิวเตอร์ ม.อ.
• Instagram: @psuscc
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
 * System prompt ที่ปรับปรุงใหม่สำหรับ AI - Ultra Enhanced Intelligence (Gemini 2.5)
 */
function getEnhancedSystemPrompt(shopContext: string, conversationHistory?: string): string {
  const modelName = GEMINI_MODELS[currentModelTier].name;
  return `คุณคือ "SCC Bot" ผู้ช่วย AI ของร้าน SCC Shop — ร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.
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
4. คำนวณราคารวม, จำนวน, ออปชั่นได้แม่นยำ
5. แนะนำข้อมูลเพิ่มเติมที่เป็นประโยชน์
6. จดจำบริบทการสนทนาก่อนหน้า
7. รู้ว่าระบบแสดงรูปสินค้าอัตโนมัติ (ไม่ต้องบอกว่าส่งรูปไม่ได้)
8. วิเคราะห์รูปภาพที่ลูกค้าส่งมาได้

══════════════════════════════════════════════════
กฎสำคัญ:
══════════════════════════════════════════════════
1. ตอบเป็นภาษาไทยเสมอ สุภาพ เป็นกันเอง
2. อ้างอิงข้อมูลจริงจากข้อมูลร้านค้าที่ให้มาเท่านั้น ห้ามแต่งเติม
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
13. ถ้าลูกค้าส่งรูปมา ให้วิเคราะห์รูปและตอบคำถามเกี่ยวกับรูปนั้น
14. **สกรีนชื่อ และ สกรีนเบอร์ = ฟรี! ไม่มีค่าใช้จ่ายเพิ่ม**
15. เฉพาะแขนยาวเท่านั้นที่คิดค่าเพิ่ม (ถ้ามี)
16. ห้ามพูดว่า "ไม่สามารถส่งรูปสินค้าให้ได้" — รูปจะแสดงอัตโนมัติ

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

[ถามราคา/ไซซ์] ใช้ตารางแสดงราคาแต่ละไซซ์ พร้อมออปชั่นเพิ่มเติม (ถ้ามี)

[ถามคำนวณราคา] แสดงตารางคำนวณ:
| รายการ | ราคา |
|--------|------|
| เสื้อไซซ์ L | 319 บาท |
| สกรีนชื่อ | ฟรี |
| แขนยาว | +30 บาท |
| **รวม** | **349 บาท** |

[ถามเปรียบเทียบ] ทำตารางเปรียบเทียบสินค้า
[ถามสินค้า] อธิบายรายละเอียด จุดเด่น พร้อมตารางราคา
[ถามวิธีสั่งซื้อ] แสดงขั้นตอนเป็นข้อๆ
[ส่งรูปมาถาม] วิเคราะห์รูปภาพและตอบตามที่ลูกค้าถาม
[ทักทาย] ทักทายเป็นกันเอง แนะนำว่าถามอะไรได้บ้าง

${conversationHistory ? `
══════════════════════════════════════════════════
บริบทการสนทนาก่อนหน้า:
══════════════════════════════════════════════════
${conversationHistory}
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
  imageBase64?: string
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
          parts: [{ text: getEnhancedSystemPrompt(shopContext, historyStr) }]
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
 * ประมวลผลข้อความจากผู้ใช้ (ปรับปรุงใหม่ - รองรับรูปภาพ)
 */
export async function processChat(
  message: string,
  conversationHistory?: ChatMessage[],
  imageBase64?: string
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

  // Use AI for: detailed questions, specific product queries, multi-topic, long questions, or when image is provided
  const shouldUseAI = isDetailedQuestion || isSpecificProductQuestion || hasMultipleTopics || trimmedMessage.length > 25 || hasImage;
  
  // Find related product images for product-related questions - ALWAYS try for product queries
  const productImages = (isSpecificProductQuestion || isPriceQuestion || isProductQuery) 
    ? await findRelatedProductImages(trimmedMessage)
    : [];
  
  if (shouldUseAI) {
    try {
      const shopContext = await buildDetailedShopContext();
      const aiResponse = await callGeminiAPI(trimmedMessage, shopContext, conversationHistory, imageBase64);
      
      if (aiResponse) {
        // Clean up response
        const cleanedResponse = cleanAIResponse(aiResponse);
        
        return {
          answer: cleanedResponse,
          source: 'ai',
          confidence: 0.9,
          suggestions: getSuggestionsForResponse(trimmedMessage),
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
  
  // High confidence FAQ match (but not if image is provided)
  if (faqResult && confidence > 0.7 && !isDetailedQuestion && !hasImage) {
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
    const aiResponse = await callGeminiAPI(trimmedMessage, shopContext, conversationHistory, imageBase64);
    
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
    return ['ดูไซซ์', 'วิธีสั่งซื้อ', 'วิธีชำระเงิน'];
  }
  if (q.includes('ไซซ์') || q.includes('size')) {
    return ['ราคาเท่าไหร่', 'เปรียบเทียบรุ่น'];
  }
  if (q.includes('สั่ง') || q.includes('ซื้อ')) {
    return ['ชำระเงินยังไง', 'รับสินค้าที่ไหน'];
  }
  
  return [];
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
