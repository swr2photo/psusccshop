// Ready-made option sets for the admin form editor ("ชุดตัวเลือกสำเร็จรูป").

export type FormPresetCategory = 'vote' | 'scale' | 'student' | 'shop';

export interface FormOptionPreset {
  id: string;
  name: string;
  category: FormPresetCategory;
  description?: string;
  options: string[];
  /** Append an "other (please specify)" option */
  withOther?: boolean;
}

export const FORM_PRESET_CATEGORIES: { id: FormPresetCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'vote', label: 'โหวต / ตัดสินใจ' },
  { id: 'scale', label: 'มาตรวัด' },
  { id: 'student', label: 'ข้อมูลนักศึกษา' },
  { id: 'shop', label: 'สินค้า / เสื้อ' },
];

export const FORM_OPTION_PRESETS: FormOptionPreset[] = [
  { id: 'should', name: 'ควร / ไม่ควร', category: 'vote', description: 'โหวตว่าควรทำหรือไม่', options: ['ควรจัดทำ', 'ไม่ควรจัดทำ'] },
  { id: 'should3', name: 'ควร / ไม่ควร / ไม่แน่ใจ', category: 'vote', options: ['ควรจัดทำ', 'ไม่ควรจัดทำ', 'ไม่แน่ใจ'] },
  { id: 'yesno', name: 'ใช่ / ไม่ใช่', category: 'vote', options: ['ใช่', 'ไม่ใช่'] },
  { id: 'agree3', name: 'เห็นด้วย / ไม่เห็นด้วย / ไม่แน่ใจ', category: 'vote', options: ['เห็นด้วย', 'ไม่เห็นด้วย', 'ไม่แน่ใจ'] },
  { id: 'join', name: 'เข้าร่วม / ไม่เข้าร่วม', category: 'vote', options: ['เข้าร่วม', 'ไม่เข้าร่วม', 'ยังไม่แน่ใจ'] },
  { id: 'buy', name: 'สนใจซื้อ', category: 'shop', description: 'วัดความต้องการก่อนสั่งผลิต', options: ['สนใจซื้อแน่นอน', 'อาจจะซื้อ', 'ไม่สนใจ'] },
  {
    id: 'agree5',
    name: 'ระดับความเห็นด้วย 5 ระดับ',
    category: 'scale',
    options: ['เห็นด้วยอย่างยิ่ง', 'เห็นด้วย', 'เฉย ๆ', 'ไม่เห็นด้วย', 'ไม่เห็นด้วยอย่างยิ่ง'],
  },
  {
    id: 'satisfy5',
    name: 'ระดับความพึงพอใจ 5 ระดับ',
    category: 'scale',
    options: ['มากที่สุด', 'มาก', 'ปานกลาง', 'น้อย', 'น้อยที่สุด'],
  },
  { id: 'freq', name: 'ความถี่', category: 'scale', options: ['ทุกวัน', 'สัปดาห์ละครั้ง', 'เดือนละครั้ง', 'นาน ๆ ครั้ง', 'ไม่เคย'] },
  {
    id: 'year',
    name: 'ชั้นปี',
    category: 'student',
    options: ['ชั้นปีที่ 1', 'ชั้นปีที่ 2', 'ชั้นปีที่ 3', 'ชั้นปีที่ 4', 'ศิษย์เก่า', 'บุคลากร / อาจารย์'],
    withOther: true,
  },
  { id: 'gender', name: 'เพศ', category: 'student', options: ['ชาย', 'หญิง', 'ไม่ระบุ'], withOther: true },
  {
    id: 'size',
    name: 'ไซซ์เสื้อ',
    category: 'shop',
    options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
  },
  {
    id: 'price',
    name: 'ช่วงราคาที่รับได้',
    category: 'shop',
    options: ['ไม่เกิน 200 บาท', '201–300 บาท', '301–400 บาท', 'มากกว่า 400 บาท'],
  },
  {
    id: 'color',
    name: 'สีเสื้อ',
    category: 'shop',
    options: ['ดำ', 'ขาว', 'กรมท่า', 'เทา'],
    withOther: true,
  },
  {
    id: 'pickup',
    name: 'วิธีรับสินค้า',
    category: 'shop',
    options: ['รับที่ชุมนุม', 'จัดส่งทางไปรษณีย์'],
  },
];
