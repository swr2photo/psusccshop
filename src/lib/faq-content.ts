// Public FAQ for /faq — curated from shop policies & shirt-faq (accurate copy only).
import type { Language } from '@/store/languageStore';

export type FaqCategoryId =
  | 'order'
  | 'payment'
  | 'shipping'
  | 'product'
  | 'policy'
  | 'contact';

export type FaqItem = {
  id: string;
  category: FaqCategoryId;
  question: { th: string; en: string };
  answer: { th: string; en: string };
};

export const FAQ_CATEGORIES: Array<{
  id: FaqCategoryId;
  label: { th: string; en: string };
}> = [
  { id: 'order', label: { th: 'การสั่งซื้อ', en: 'Orders' } },
  { id: 'payment', label: { th: 'การชำระเงิน', en: 'Payment' } },
  { id: 'shipping', label: { th: 'จัดส่ง / รับสินค้า', en: 'Shipping / Pickup' } },
  { id: 'product', label: { th: 'สินค้า & ไซซ์', en: 'Products & Sizing' } },
  { id: 'policy', label: { th: 'นโยบาย', en: 'Policies' } },
  { id: 'contact', label: { th: 'ติดต่อ', en: 'Contact' } },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'how-to-order',
    category: 'order',
    question: {
      th: 'สั่งซื้ออย่างไร?',
      en: 'How do I place an order?',
    },
    answer: {
      th: '1. เลือกสินค้าที่ต้องการ\n2. เลือกไซซ์และออปชั่นต่างๆ\n3. กด "เพิ่มลงตะกร้า"\n4. เปิดตะกร้าด้านบนขวา\n5. ตรวจสอบรายการแล้วกดสั่งซื้อ\n6. กรอกข้อมูลและชำระเงินภายในกำหนด',
      en: '1. Choose a product\n2. Select size and options\n3. Tap “Add to cart”\n4. Open the cart (top right)\n5. Review items and checkout\n6. Enter your details and pay within the deadline',
    },
  },
  {
    id: 'order-status',
    category: 'order',
    question: {
      th: 'เช็คสถานะออเดอร์ได้ยังไง?',
      en: 'How can I check my order status?',
    },
    answer: {
      th: 'เข้าสู่ระบบ แล้วเปิด “ออเดอร์ของฉัน” จากเมนูบัญชี หรือใช้ลิงก์ตรวจสอบสถานะในส่วนท้ายเว็บ สถานะจะอัปเดตเมื่อมีการเปลี่ยนแปลง',
      en: 'Sign in and open “My Orders” from the account menu, or use Order Status in the footer. Status updates automatically when something changes.',
    },
  },
  {
    id: 'cancel-order',
    category: 'order',
    question: {
      th: 'ยกเลิกหรือแก้ไขออเดอร์ได้ไหม?',
      en: 'Can I cancel or edit an order?',
    },
    answer: {
      th: '• ก่อนชำระเงิน — ยกเลิกได้ หรือรอให้หมดอายุอัตโนมัติ (24 ชม.) หรือยกเลิกแล้วสั่งใหม่\n• หลังชำระเงินแล้ว — โดยปกติไม่สามารถยกเลิกหรือแก้ไขได้\nหากมีปัญหา ติดต่อทีมงานพร้อมเลขออเดอร์',
      en: '• Before payment — you can cancel, wait for auto-expiry (24 hours), or cancel and reorder\n• After payment — cancel/edit is generally not available\nIf you need help, contact support with your order number',
    },
  },
  {
    id: 'payment-methods',
    category: 'payment',
    question: {
      th: 'ชำระเงินอย่างไร?',
      en: 'How do I pay?',
    },
    answer: {
      th: 'รองรับ PromptPay (สแกน QR) และการโอนธนาคารตามรายละเอียดในออเดอร์ หลังโอนแล้วอัปโหลดสลิปในระบบเพื่อยืนยัน โดยปกติตรวจสอบไม่เกิน 24 ชม.',
      en: 'We accept PromptPay (scan the QR) and bank transfer as shown on your order. After transferring, upload your slip in the system for verification — usually within 24 hours.',
    },
  },
  {
    id: 'upload-slip',
    category: 'payment',
    question: {
      th: 'อัปโหลดสลิปยังไง?',
      en: 'How do I upload a payment slip?',
    },
    answer: {
      th: 'หลังโอนเงิน กด “อัปโหลดสลิป” ที่ออเดอร์ของคุณ เลือกไฟล์รูปสลิป แล้วรอระบบตรวจสอบ เมื่อผ่าน สถานะจะเปลี่ยนเป็นชำระแล้ว',
      en: 'After transferring, tap “Upload slip” on your order, choose a clear slip image, and wait for verification. When approved, the status becomes paid.',
    },
  },
  {
    id: 'payment-deadline',
    category: 'payment',
    question: {
      th: 'ต้องชำระภายในเมื่อไหร่?',
      en: 'When is payment due?',
    },
    answer: {
      th: 'ชำระภายใน 24 ชั่วโมงหลังสั่งซื้อ หากไม่ชำระตามกำหนด ออเดอร์อาจถูกยกเลิกอัตโนมัติ',
      en: 'Pay within 24 hours of placing the order. Unpaid orders may be cancelled automatically after the deadline.',
    },
  },
  {
    id: 'delivery-time',
    category: 'shipping',
    question: {
      th: 'จะได้รับสินค้าเมื่อไหร่?',
      en: 'When will I receive my order?',
    },
    answer: {
      th: 'สินค้า Pre-order/เสื้อชุมนุมมักเริ่มผลิตหลังปิดรอบสั่งซื้อ ใช้เวลาประมาณ 2–4 สัปดาห์ และมีประกาศวันรับทางเว็บไซต์หรือโซเชียล ตัวเลือกจัดส่งถึงบ้าน (ถ้าเปิดให้บริการ) ดูรายละเอียดได้ตอนเช็คเอาต์',
      en: 'Pre-order / club apparel usually starts production after the order round closes (about 2–4 weeks). Pickup dates are announced on the site or social channels. Home delivery options (when enabled) are shown at checkout.',
    },
  },
  {
    id: 'pickup-location',
    category: 'shipping',
    question: {
      th: 'รับสินค้าที่ไหน?',
      en: 'Where do I pick up?',
    },
    answer: {
      th: 'จุดรับหลักอยู่ที่ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ. หาดใหญ่ วัน–เวลาจะประกาศหลังสินค้าพร้อม สามารถให้เพื่อนรับแทนได้โดยแจ้งชื่อและเลขออเดอร์',
      en: 'Main pickup is at the Computer Science Club, Faculty of Science, PSU Hat Yai. Dates/times are announced when ready. A friend can pick up for you with your name and order number.',
    },
  },
  {
    id: 'shipping-home',
    category: 'shipping',
    question: {
      th: 'ส่งถึงบ้านได้ไหม?',
      en: 'Do you ship to my address?',
    },
    answer: {
      th: 'สามารถเลือกจัดส่งทางไปรษณีย์ได้หากร้านเปิดตัวเลือกนั้น ค่าจัดส่งขึ้นอยู่กับวิธีที่เลือกตอนสั่งซื้อ ดูรายละเอียดในหน้าเช็คเอาต์',
      en: 'Courier shipping is available when that option is enabled for the shop. Fees depend on the method you choose at checkout.',
    },
  },
  {
    id: 'tracking',
    category: 'shipping',
    question: {
      th: 'ติดตามพัสดุยังไง?',
      en: 'How do I track a shipment?',
    },
    answer: {
      th: 'ไปที่ประวัติคำสั่งซื้อ เลือกออเดอร์ แล้วดูสถานะจัดส่งและเลขพัสดุ (เมื่อมี) ระบบจะอัปเดตตามข้อมูลจากขนส่ง',
      en: 'Open order history, select the order, and view shipping status and tracking number (when available). Updates follow the carrier’s data.',
    },
  },
  {
    id: 'sizes',
    category: 'product',
    question: {
      th: 'มีไซซ์อะไรบ้าง?',
      en: 'What sizes are available?',
    },
    answer: {
      th: 'โดยทั่วไปมี XS–L ในราคาปกติ และ XL ขึ้นไปอาจปรับราคาตามสินค้า แนะนำดูตารางไซซ์ในหน้าสินค้าก่อนสั่ง',
      en: 'Most items offer XS–L at the standard price; XL and above may have a size surcharge depending on the product. Check the size chart on the product page before ordering.',
    },
  },
  {
    id: 'custom-name',
    category: 'product',
    question: {
      th: 'สกรีนชื่อหรือเบอร์ได้ไหม?',
      en: 'Can I add a name or number print?',
    },
    answer: {
      th: 'ขึ้นกับสินค้า บางรุ่นมีออปชั่นสกรีนชื่อ/เบอร์ (และตัวเลือกอื่น เช่น แขนยาว) ในหน้าสั่งซื้อ — ดูรายละเอียดและค่าใช้จ่ายของแต่ละรุ่น',
      en: 'It depends on the product. Some items offer name/number print (and other options like long sleeves) on the product page — check each product’s options and any fees.',
    },
  },
  {
    id: 'return-policy',
    category: 'policy',
    question: {
      th: 'เปลี่ยนหรือคืนสินค้าได้ไหม?',
      en: 'Can I exchange or return items?',
    },
    answer: {
      th: 'โดยปกติไม่รับเปลี่ยนหรือคืน ข้อยกเว้นคือสินค้ามีตำหนิจากการผลิต กรุณาตรวจสอบไซซ์จากตารางไซซ์ก่อนสั่งซื้อ',
      en: 'Exchanges/returns are generally not accepted, except for manufacturing defects. Please use the size chart before ordering.',
    },
  },
  {
    id: 'refund',
    category: 'policy',
    question: {
      th: 'ขอคืนเงินได้ไหม?',
      en: 'Can I get a refund?',
    },
    answer: {
      th: 'กรณีสินค้าชำรุดหรือผิดจากที่สั่ง สามารถขอคืนเงินผ่านระบบในประวัติคำสั่งซื้อ (พร้อมหลักฐานรูป) ทีมงานจะตรวจสอบและดำเนินการ รายละเอียดเพิ่มเติมดูได้ในข้อกำหนดการใช้งาน',
      en: 'For defective items or wrong items, you can request a refund from order history (with photos). The team will review and process. See Terms of Service for full details.',
    },
  },
  {
    id: 'promo-code',
    category: 'policy',
    question: {
      th: 'มีโค้ดส่วนลดไหม?',
      en: 'Do you offer promo codes?',
    },
    answer: {
      th: 'ทีมงานประกาศโค้ดผ่าน Facebook, Instagram และประกาศในเว็บ ใส่โค้ดได้ที่หน้า Checkout ก่อนชำระเงิน',
      en: 'Codes are announced on Facebook, Instagram, and site announcements. Enter them at checkout before payment.',
    },
  },
  {
    id: 'contact-info',
    category: 'contact',
    question: {
      th: 'ติดต่อทีมงานได้ที่ไหน?',
      en: 'How can I contact the team?',
    },
    answer: {
      th: '• Email: psuscc@psuscc.club\n• Facebook / Instagram: @psuscc\n• แชทในเว็บ: ปุ่มแชทด้านล่างขวา หรือ “แชทกับทีมงาน” ในส่วนท้ายเว็บ',
      en: '• Email: psuscc@psuscc.club\n• Facebook / Instagram: @psuscc\n• On-site chat: the chat button (bottom right) or “Chat with Support” in the footer',
    },
  },
  {
    id: 'shop-open',
    category: 'contact',
    question: {
      th: 'ร้านเปิดรับออเดอร์ไหม?',
      en: 'Is the shop accepting orders?',
    },
    answer: {
      th: 'ดูสถานะเปิด/ปิดรับออเดอร์ได้ที่หน้าแรก หากปิดอยู่ ติดตามรอบใหม่ทาง Facebook หรือ Instagram ของชุมนุม',
      en: 'Check the open/closed status on the home page. If closed, follow the club on Facebook or Instagram for the next round.',
    },
  },
];

export function getFaqItemsForLang(lang: Language) {
  return FAQ_ITEMS.map((item) => ({
    id: item.id,
    category: item.category,
    question: item.question[lang],
    answer: item.answer[lang],
  }));
}

export function getFaqCategoriesForLang(lang: Language) {
  return FAQ_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label[lang],
  }));
}
