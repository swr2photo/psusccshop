'use client';

import { Box, Container, Typography, Paper, Divider, List, ListItem, ListItemIcon, ListItemText, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { 
  Shield, 
  Database, 
  Lock, 
  Eye, 
  Trash2, 
  Download, 
  Mail, 
  Clock, 
  Users, 
  Globe, 
  ChevronDown,
  ArrowLeft,
  Cookie,
  FileText,
  AlertCircle,
  CheckCircle,
  Settings,
  Bot,
  MessageCircle,
  Truck,
  CreditCard,
  KeyRound,
  Fingerprint,
  ShieldCheck,
  Scan,
  Activity,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

// Theme colors
const THEME = {
  bg: 'var(--background)',
  bgCard: 'var(--glass-strong)',
  glass: 'var(--glass-bg)',
  text: 'var(--foreground)',
  textSecondary: 'var(--text-muted)',
  muted: 'var(--text-muted)',
  border: 'var(--glass-border)',
  primary: '#2563eb',
  success: '#10b981',
};

// ==================== BILINGUAL CONTENT ====================
const CONTENT = {
  th: {
    lastUpdated: '7 กุมภาพันธ์ 2569',
    version: '3.0',
    backHome: 'กลับหน้าหลัก',
    title: 'นโยบายความเป็นส่วนตัว',
    subtitle: 'Privacy Policy — PDPA Compliance',
    updatedLabel: 'อัปเดตล่าสุด',
    versionLabel: 'เวอร์ชัน',
    intro: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ ("SCC Shop", "เรา", "ของเรา") ให้ความสำคัญกับความเป็นส่วนตัวของข้อมูลของท่าน นโยบายความเป็นส่วนตัวฉบับนี้อธิบายวิธีการที่เราเก็บรวบรวม ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคลของท่าน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)',
    promise: {
      title: 'คำมั่นสัญญาของเรา:',
      text: 'เราจะไม่ขายหรือเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลภายนอก เว้นแต่จะได้รับความยินยอมจากท่านหรือตามที่กฎหมายกำหนด ข้อมูลทั้งหมดถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย',
    },
    s1: {
      title: '1. ข้อมูลที่เราเก็บรวบรวม',
      desc: 'เราเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเฉพาะเท่าที่จำเป็นสำหรับการให้บริการ:',
      directTitle: 'ข้อมูลที่ท่านให้โดยตรง:',
      direct: [
        { primary: 'ชื่อ-นามสกุล', secondary: 'สำหรับการจัดส่งสินค้า สกรีนบนสินค้า และการติดต่อ' },
        { primary: 'อีเมล', secondary: 'สำหรับการยืนยันตัวตน (OAuth) และการแจ้งสถานะคำสั่งซื้อ' },
        { primary: 'หมายเลขโทรศัพท์', secondary: 'สำหรับการติดต่อกรณีมีปัญหาการจัดส่ง' },
        { primary: 'ที่อยู่จัดส่ง', secondary: 'สำหรับการจัดส่งสินค้า (รองรับบันทึกหลายที่อยู่)' },
        { primary: 'Instagram', secondary: 'สำหรับการติดต่อทางช่องทางเสริม' },
        { primary: 'หลักฐานการชำระเงิน (สลิป)', secondary: 'สำหรับการยืนยันการชำระเงินผ่านระบบ SlipOK' },
        { primary: 'ข้อมูลบัญชีธนาคาร (กรณีขอคืนเงิน)', secondary: 'สำหรับดำเนินการคืนเงิน เก็บเฉพาะกรณีท่านขอ Refund' },
        { primary: 'ข้อความในแชทสนับสนุน', secondary: 'สำหรับการให้บริการช่วยเหลือจากทีมงาน' },
        { primary: 'ข้อความที่ส่งถึง AI Chatbot', secondary: 'สำหรับการตอบคำถามอัตโนมัติ ส่งไปประมวลผลที่ Google Gemini' },
      ],
      autoTitle: 'ข้อมูลที่เก็บรวบรวมโดยอัตโนมัติ:',
      auto: [
        { primary: 'ข้อมูลการเข้าสู่ระบบ (OAuth 2.0)', secondary: 'ผ่าน Google, Microsoft, Facebook, Apple หรือ LINE Account' },
        { primary: 'IP Address', secondary: 'สำหรับการรักษาความปลอดภัย (เก็บแบบเข้ารหัส/ปกปิดบางส่วน)' },
        { primary: 'User Agent', secondary: 'สำหรับการตรวจจับภัยคุกคามและอุปกรณ์ผิดปกติ' },
        { primary: 'คุกกี้', secondary: 'สำหรับการจดจำ Session, ตะกร้าสินค้า และการตั้งค่า' },
        { primary: 'บันทึกกิจกรรม (Activity Logs)', secondary: 'เข้าสู่ระบบ, ออกจากระบบ, สั่งซื้อ — สำหรับการตรวจสอบความปลอดภัย' },
        { primary: 'บันทึกความปลอดภัย (Security Audit Logs)', secondary: 'ประเภทเหตุการณ์, ระดับความรุนแรง, คะแนนภัยคุกคาม' },
      ],
      orderTitle: 'ข้อมูลคำสั่งซื้อ:',
      order: [
        { primary: 'รายการสินค้าในตะกร้า', secondary: 'ชื่อสินค้า, ไซซ์, จำนวน, ออปชั่นสกรีนชื่อ/เบอร์, แขนสั้น/ยาว' },
        { primary: 'ข้อมูลการชำระเงิน', secondary: 'ยอดรวม, วิธีชำระ, สถานะการยืนยัน, รหัสอ้างอิงธุรกรรม' },
        { primary: 'ข้อมูลการจัดส่ง', secondary: 'วิธีจัดส่ง, ค่าจัดส่ง, เลขพัสดุ, สถานะการจัดส่ง' },
        { primary: 'ข้อมูลการคืนเงิน (ถ้ามี)', secondary: 'เหตุผล, จำนวนเงิน, สถานะ, ข้อมูลบัญชีคืนเงิน' },
      ],
    },
    s2: {
      title: '2. วัตถุประสงค์ในการใช้ข้อมูล',
      items: [
        'ดำเนินการตามคำสั่งซื้อ จัดเตรียม และจัดส่งสินค้า',
        'ยืนยันการชำระเงินและตรวจสอบสลิปอัตโนมัติ (ผ่าน SlipOK)',
        'แจ้งสถานะคำสั่งซื้อ สถานะการจัดส่ง และเลขพัสดุทางอีเมล',
        'ติดต่อกรณีมีปัญหาเกี่ยวกับคำสั่งซื้อหรือการจัดส่ง',
        'ให้บริการ AI Chatbot ตอบคำถามและช่วยค้นหาข้อมูลสินค้า/ออเดอร์',
        'ให้บริการแชทสนับสนุนจากทีมงาน (Support Chat)',
        'ดำเนินการคืนเงินเมื่อท่านร้องขอ (Refund System)',
        'ติดตามสถานะพัสดุแบบ Real-time (ผ่าน Track123)',
        'บันทึกข้อมูลคำสั่งซื้อลง Google Sheets สำหรับการจัดการภายใน',
        'ป้องกันการทุจริต ตรวจจับภัยคุกคาม และรักษาความปลอดภัยของระบบ',
        'ปฏิบัติตามกฎหมายที่เกี่ยวข้อง รวมถึง PDPA',
      ],
    },
    s3: {
      title: '3. การยืนยันตัวตน (Authentication)',
      desc: 'เราใช้ระบบ OAuth 2.0 ผ่าน NextAuth.js สำหรับการยืนยันตัวตน โดยรองรับผู้ให้บริการดังนี้:',
      providers: [
        { provider: 'Google', data: 'ชื่อ, อีเมล, รูปโปรไฟล์', note: 'ผู้ให้บริการหลัก' },
        { provider: 'Microsoft (Azure AD)', data: 'ชื่อ, อีเมลองค์กร, รูปโปรไฟล์', note: 'สำหรับบัญชี Microsoft/Outlook' },
        { provider: 'Facebook', data: 'ชื่อ, อีเมล, รูปโปรไฟล์', note: 'เปิดใช้งานตามเงื่อนไข' },
        { provider: 'Apple', data: 'ชื่อ, อีเมล (หรือ Private Relay Email)', note: 'รองรับ Hide My Email' },
        { provider: 'LINE', data: 'ชื่อ, อีเมล (ถ้ามี), รูปโปรไฟล์', note: 'สำหรับผู้ใช้ LINE' },
      ],
      note: 'เราใช้ JWT (JSON Web Token) สำหรับการจัดการ Session โดยมีอายุสูงสุด 30 วัน ข้อมูลอีเมลจะถูกแปลงเป็นรหัส SHA-256 เพื่อใช้เป็นคีย์ในการจัดเก็บข้อมูล เพิ่มความปลอดภัยในการอ้างอิง',
    },
    s4: {
      title: '4. AI Chatbot และ Support Chat',
      aiTitle: 'AI Chatbot (SCC Bot)',
      aiItems: [
        'ใช้ Google Gemini AI สำหรับการประมวลผลคำถาม',
        'ข้อความที่ท่านส่งจะถูกส่งไปยัง Google Gemini API เพื่อสร้างคำตอบ',
        'หากท่านล็อกอินแล้ว ระบบอาจค้นหาข้อมูลออเดอร์ของท่านเพื่อตอบคำถามเกี่ยวกับสถานะสั่งซื้อ',
        'ประวัติการสนทนาเก็บไว้ในเบราว์เซอร์ของท่านเท่านั้น (Session-based) ไม่ได้เก็บในเซิร์ฟเวอร์',
        'ระบบจะไม่เปิดเผยข้อมูลส่วนตัวของลูกค้าคนอื่นผ่าน AI Chatbot',
      ],
      supportTitle: 'Support Chat (แชทกับทีมงาน)',
      supportItems: [
        'ข้อความแชทถูกเก็บในฐานข้อมูลเพื่อให้ทีมงานตอบกลับได้',
        'ข้อมูลที่เก็บ: ข้อความ, ชื่อ, อีเมล, วันเวลา, การอ่านข้อความ',
        'รองรับการอัปโหลดรูปภาพประกอบการสนทนา',
        'ท่านสามารถให้คะแนนความพึงพอใจหลังจบการสนทนาได้',
        'ข้อมูลแชทจะถูกเก็บรักษาตามระยะเวลาที่กำหนดในหมวดการเก็บรักษาข้อมูล',
      ],
    },
    s5: {
      title: '5. ระยะเวลาในการเก็บรักษาข้อมูล',
      items: [
        { type: 'ข้อมูลคำสั่งซื้อ', duration: '2 ปี นับจากวันที่สั่งซื้อ', note: 'ตามข้อกำหนดทางบัญชี' },
        { type: 'หลักฐานการชำระเงิน', duration: '2 ปี นับจากวันที่ชำระเงิน', note: 'เพื่อการตรวจสอบ' },
        { type: 'ข้อมูลโปรไฟล์ผู้ใช้', duration: 'จนกว่าจะขอลบ', note: 'สามารถขอลบได้ทุกเมื่อ' },
        { type: 'ข้อความ Support Chat', duration: '1 ปี', note: 'หลังจากปิดการสนทนา' },
        { type: 'ข้อความ AI Chatbot', duration: 'ไม่เก็บในเซิร์ฟเวอร์', note: 'เก็บในเบราว์เซอร์เท่านั้น' },
        { type: 'ข้อมูลการคืนเงิน', duration: '2 ปี นับจากวันดำเนินการ', note: 'ตามข้อกำหนดทางบัญชี' },
        { type: 'บันทึกกิจกรรมผู้ใช้', duration: '90 วัน', note: 'สำหรับการตรวจสอบ' },
        { type: 'บันทึกความปลอดภัย', duration: '90 วัน', note: 'สำหรับการตรวจจับภัยคุกคาม' },
        { type: 'คุกกี้', duration: '1 ปี', note: 'หรือจนกว่าจะลบออก' },
        { type: 'บันทึกอีเมลที่ส่ง', duration: '1 ปี', note: 'เพื่อการตรวจสอบ' },
      ],
      autoClean: {
        title: 'ระบบทำความสะอาดอัตโนมัติ:',
        text: 'เรามีระบบ Cron Job ที่ทำงานเป็นระยะ เพื่อลบข้อมูลที่หมดอายุตาม PDPA, ยกเลิกออเดอร์ที่ไม่ชำระเงินภายในกำหนด และอัปเดตสถานะพัสดุอัตโนมัติ',
      },
    },
    s6: {
      title: '6. สิทธิ์ของเจ้าของข้อมูล (PDPA Rights)',
      desc: 'ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ท่านมีสิทธิ์ดังต่อไปนี้:',
      rights: [
        { title: 'สิทธิ์ในการเข้าถึง', desc: 'ท่านสามารถขอดูข้อมูลส่วนบุคคลที่เราเก็บรักษาไว้เกี่ยวกับท่าน ผ่านระบบ Data Request ในเว็บไซต์ หรือส่งอีเมลมาที่ทีมงาน', color: '#2563eb' },
        { title: 'สิทธิ์ในการขอรับข้อมูล (Data Portability)', desc: 'ท่านสามารถขอรับสำเนาข้อมูลส่วนบุคคลของท่านในรูปแบบ JSON ที่อ่านได้ ผ่านระบบ Data Export', color: '#0ea5e9' },
        { title: 'สิทธิ์ในการแก้ไขข้อมูล', desc: 'ท่านสามารถแก้ไขข้อมูลโปรไฟล์ (ชื่อ, เบอร์โทร, ที่อยู่, Instagram) ได้ด้วยตนเองผ่านหน้าโปรไฟล์', color: '#f59e0b' },
        { title: 'สิทธิ์ในการลบข้อมูล', desc: 'ท่านสามารถขอให้ลบข้อมูลส่วนบุคคลของท่านได้ ยกเว้นข้อมูลคำสั่งซื้อที่ต้องเก็บตามข้อกำหนดทางบัญชี', color: '#ef4444' },
        { title: 'สิทธิ์ในการระงับการใช้', desc: 'ท่านสามารถขอให้ระงับการใช้ข้อมูลส่วนบุคคลของท่านชั่วคราวได้', color: '#1e40af' },
        { title: 'สิทธิ์ในการคัดค้าน', desc: 'ท่านสามารถคัดค้านการประมวลผลข้อมูลส่วนบุคคลของท่าน เช่น การส่งอีเมลประชาสัมพันธ์', color: '#ec4899' },
      ],
      howToTitle: 'วิธีการใช้สิทธิ์:',
      howTo: '1. ผ่านระบบ Data Request ในเว็บไซต์ (เมนู Privacy > Data Request)\n2. ส่งคำขอมาที่อีเมล',
      howToSuffix: 'พร้อมระบุชื่อ-อีเมลที่ใช้สั่งซื้อ และสิทธิ์ที่ต้องการใช้',
      howToDeadline: 'เราจะดำเนินการภายใน 30 วัน นับจากวันที่ได้รับคำขอ',
    },
    s7: {
      title: '7. มาตรการรักษาความปลอดภัย',
      desc: 'เราใช้มาตรการรักษาความปลอดภัยหลายระดับตามมาตรฐานสากล:',
      items: [
        'การเข้ารหัส HTTPS/TLS', 'Content Security Policy (CSP)', 'เข้ารหัสข้อมูล AES-256-GCM',
        'แฮชอีเมลด้วย SHA-256', 'OAuth 2.0 + JWT Session', 'HMAC-SHA256 Request Signing',
        'Rate Limiting หลายระดับ', 'ป้องกัน SQL/XSS Injection', 'Cloudflare Turnstile (CAPTCHA)',
        'Threat Detection อัตโนมัติ', 'API Key Rotation อัตโนมัติ', 'Security Audit Logging',
        'Brute Force Protection', 'Role-Based Access (14 Permissions)', 'Encrypted Image Proxy URLs', 'Sensitive Field Stripping',
      ],
    },
    s8: {
      title: '8. นโยบายคุกกี้',
      desc: 'เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งานของท่าน โดยแบ่งออกเป็น 4 ประเภท:',
      types: [
        { type: 'คุกกี้ที่จำเป็น (Essential)', required: true, desc: 'สำหรับการทำงานพื้นฐาน เช่น NextAuth Session, CSRF Protection, Cloudflare Turnstile' },
        { type: 'คุกกี้ฟังก์ชัน (Functional)', required: false, desc: 'สำหรับจดจำตะกร้าสินค้า (Zustand), ข้อมูลโปรไฟล์, ธีมสว่าง/มืด, Cookie Consent' },
        { type: 'คุกกี้วิเคราะห์ (Analytics)', required: false, desc: 'สำหรับเข้าใจพฤติกรรมการใช้งานเพื่อปรับปรุงบริการ' },
        { type: 'คุกกี้การตลาด (Marketing)', required: false, desc: 'สำหรับแสดงโฆษณาที่ตรงกับความสนใจของท่าน (ปัจจุบันไม่ได้ใช้)' },
      ],
      required: 'จำเป็น',
      manage: 'ท่านสามารถจัดการการตั้งค่าคุกกี้ได้ผ่าน Cookie Banner ที่ด้านล่างของหน้าเว็บ หรือลบคุกกี้ทั้งหมดผ่านการตั้งค่าเบราว์เซอร์',
    },
    s9: {
      title: '9. การเปิดเผยข้อมูลต่อบุคคลภายนอก',
      desc: 'เราอาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลภายนอกในกรณีต่อไปนี้เท่านั้น:',
      dataSent: 'ข้อมูลที่ส่ง',
      parties: [
        { party: 'Google (OAuth + Gemini AI)', purpose: 'ยืนยันตัวตน, ประมวลผลคำถาม AI Chatbot', data: 'อีเมล, ชื่อ, ข้อความ Chatbot' },
        { party: 'Microsoft Azure AD', purpose: 'ยืนยันตัวตนด้วยบัญชี Microsoft', data: 'อีเมล, ชื่อ' },
        { party: 'Facebook', purpose: 'ยืนยันตัวตนด้วยบัญชี Facebook', data: 'อีเมล, ชื่อ' },
        { party: 'Apple', purpose: 'ยืนยันตัวตนด้วยบัญชี Apple (รองรับ Hide My Email)', data: 'อีเมล, ชื่อ' },
        { party: 'LINE', purpose: 'ยืนยันตัวตนด้วยบัญชี LINE', data: 'อีเมล (ถ้ามี), ชื่อ' },
        { party: 'Supabase', purpose: 'ฐานข้อมูลหลัก, จัดเก็บรูปภาพ, Real-time Updates', data: 'ข้อมูลคำสั่งซื้อ, โปรไฟล์, แชท' },
        { party: 'Cloudflare (Turnstile)', purpose: 'ป้องกัน Bot, CDN, ความปลอดภัย', data: 'IP Address, Turnstile Token' },
        { party: 'Resend', purpose: 'ส่งอีเมลแจ้งเตือนสถานะคำสั่งซื้อ', data: 'อีเมลผู้รับ, เนื้อหาอีเมล' },
        { party: 'SlipOK', purpose: 'ตรวจสอบสลิปการชำระเงินอัตโนมัติ', data: 'รูปสลิป, รหัสอ้างอิงธุรกรรม' },
        { party: 'Google Sheets', purpose: 'Sync ข้อมูลคำสั่งซื้อสำหรับทีมงาน', data: 'ข้อมูลคำสั่งซื้อ (ชื่อ, รายการ, ยอด)' },
        { party: 'Track123', purpose: 'ติดตามสถานะพัสดุแบบ Real-time', data: 'เลขพัสดุ, รหัสขนส่ง' },
        { party: 'Filebase (IPFS/S3)', purpose: 'จัดเก็บรูปภาพสินค้าและไฟล์', data: 'รูปภาพ, ไฟล์ config' },
      ],
      noteTitle: 'หมายเหตุ:',
      noteText: 'เราจะไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอกเด็ดขาด บริการภายนอกทั้งหมดถูกใช้เพื่อการให้บริการที่จำเป็นเท่านั้น',
    },
    s10: {
      title: '10. การชำระเงินและการจัดส่ง',
      paymentTitle: 'การชำระเงิน',
      paymentItems: [
        'รองรับ PromptPay QR Code — สร้าง QR Code ภายในเว็บไซต์ ไม่ผ่านบริการภายนอก',
        'รองรับโอนเงินผ่านธนาคาร',
        'สลิปการโอนเงินจะถูกอัปโหลดและตรวจสอบอัตโนมัติผ่าน SlipOK',
        'ข้อมูลสลิปเข้าถึงได้เฉพาะผู้ดูแลระบบเท่านั้น',
        'ระบบ Refund — ท่านสามารถขอคืนเงินกรณีสินค้ามีปัญหา พร้อมระบุบัญชีรับเงินคืน',
      ],
      shippingTitle: 'การจัดส่ง',
      shippingItems: [
        'รองรับหลายรูปแบบจัดส่ง (รับหน้าร้าน, ส่งไปรษณีย์ ฯลฯ)',
        'ที่อยู่จัดส่งเก็บเข้ารหัสอย่างปลอดภัย เข้าถึงได้เฉพาะทีมจัดส่ง',
        'เลขพัสดุติดตามผ่าน Track123 — ส่งเฉพาะเลขพัสดุและรหัสขนส่ง',
        'รองรับบันทึกที่อยู่จัดส่งหลายแห่ง (Address Book)',
        'การรับหน้าร้านใช้ QR Code ยืนยันตัวตน',
      ],
    },
    s11: {
      title: '11. ช่องทางติดต่อ (Data Protection Officer)',
      desc: 'หากท่านมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว หรือต้องการใช้สิทธิ์ของเจ้าของข้อมูล สามารถติดต่อเราได้ที่:',
      orgName: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์',
      orgAddr: 'มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่',
      email: 'อีเมล',
      website: 'เว็บไซต์',
      facebook: 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.',
      chatLabel: 'ผ่านปุ่มแชทในเว็บไซต์',
    },
    s12: {
      title: '12. การเปลี่ยนแปลงนโยบาย',
      desc: 'เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว หากมีการเปลี่ยนแปลงที่สำคัญ เราจะแจ้งให้ท่านทราบผ่านทางอีเมลหรือประกาศบนเว็บไซต์ การใช้งานเว็บไซต์ต่อหลังจากมีการเปลี่ยนแปลงนโยบาย ถือว่าท่านยอมรับนโยบายฉบับใหม่',
      v3: { date: '7 กุมภาพันธ์ 2569', desc: 'เพิ่มข้อมูล AI Chatbot, Support Chat, Refund System, 5 OAuth Providers, มาตรการความปลอดภัยเพิ่มเติม' },
      v2: { date: '20 มกราคม 2569', desc: 'ปรับปรุงนโยบายให้สอดคล้องกับ PDPA, เพิ่มสิทธิ์เจ้าของข้อมูล' },
      v1: { date: 'เปิดตัวครั้งแรก', desc: 'นโยบายความเป็นส่วนตัวฉบับแรก' },
    },
    copyright: '© 2569 ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ สงวนลิขสิทธิ์',
  },
  en: {
    lastUpdated: 'February 7, 2026',
    version: '3.0',
    backHome: 'Back to Home',
    title: 'Privacy Policy',
    subtitle: 'Privacy Policy — PDPA Compliance',
    updatedLabel: 'Last Updated',
    versionLabel: 'Version',
    intro: 'The Science Computer Club, Faculty of Science, Prince of Songkla University ("SCC Shop", "we", "our") values the privacy of your personal data. This Privacy Policy explains how we collect, use, disclose, and protect your personal data in accordance with the Personal Data Protection Act B.E. 2562 (PDPA).',
    promise: {
      title: 'Our Commitment:',
      text: 'We will not sell or disclose your personal data to third parties without your consent or as required by law. All data is encrypted and stored securely.',
    },
    s1: {
      title: '1. Data We Collect',
      desc: 'We collect your personal data only as necessary to provide our services:',
      directTitle: 'Data you provide directly:',
      direct: [
        { primary: 'Full Name', secondary: 'For shipping, product printing, and communication' },
        { primary: 'Email', secondary: 'For identity verification (OAuth) and order status notifications' },
        { primary: 'Phone Number', secondary: 'For contacting you in case of shipping issues' },
        { primary: 'Shipping Address', secondary: 'For product delivery (supports saving multiple addresses)' },
        { primary: 'Instagram', secondary: 'For alternative contact channel' },
        { primary: 'Payment Proof (Slip)', secondary: 'For payment verification via SlipOK system' },
        { primary: 'Bank Account Info (for refunds)', secondary: 'For processing refunds, stored only when you request a refund' },
        { primary: 'Support Chat Messages', secondary: 'For customer support services from our team' },
        { primary: 'AI Chatbot Messages', secondary: 'For automated Q&A, processed by Google Gemini' },
      ],
      autoTitle: 'Data collected automatically:',
      auto: [
        { primary: 'Login Data (OAuth 2.0)', secondary: 'Via Google, Microsoft, Facebook, Apple, or LINE Account' },
        { primary: 'IP Address', secondary: 'For security purposes (stored encrypted/partially masked)' },
        { primary: 'User Agent', secondary: 'For threat detection and abnormal device monitoring' },
        { primary: 'Cookies', secondary: 'For session management, shopping cart, and preferences' },
        { primary: 'Activity Logs', secondary: 'Login, logout, orders — for security auditing' },
        { primary: 'Security Audit Logs', secondary: 'Event type, severity level, threat score' },
      ],
      orderTitle: 'Order Data:',
      order: [
        { primary: 'Cart Items', secondary: 'Product name, size, quantity, custom name/number options, sleeve type' },
        { primary: 'Payment Data', secondary: 'Total amount, payment method, verification status, transaction reference' },
        { primary: 'Shipping Data', secondary: 'Shipping method, shipping fee, tracking number, delivery status' },
        { primary: 'Refund Data (if applicable)', secondary: 'Reason, amount, status, refund account info' },
      ],
    },
    s2: {
      title: '2. Purpose of Data Usage',
      items: [
        'Process orders, prepare, and ship products',
        'Verify payments and automatically check transfer slips (via SlipOK)',
        'Notify order status, shipping status, and tracking numbers via email',
        'Contact you regarding order or shipping issues',
        'Provide AI Chatbot for Q&A and product/order search',
        'Provide team support chat (Support Chat)',
        'Process refunds upon your request (Refund System)',
        'Track parcels in real-time (via Track123)',
        'Sync order data to Google Sheets for internal management',
        'Prevent fraud, detect threats, and maintain system security',
        'Comply with applicable laws, including PDPA',
      ],
    },
    s3: {
      title: '3. Authentication',
      desc: 'We use OAuth 2.0 via NextAuth.js for identity verification, supporting the following providers:',
      providers: [
        { provider: 'Google', data: 'Name, Email, Profile Picture', note: 'Primary Provider' },
        { provider: 'Microsoft (Azure AD)', data: 'Name, Organizational Email, Profile Picture', note: 'For Microsoft/Outlook accounts' },
        { provider: 'Facebook', data: 'Name, Email, Profile Picture', note: 'Conditionally enabled' },
        { provider: 'Apple', data: 'Name, Email (or Private Relay Email)', note: 'Supports Hide My Email' },
        { provider: 'LINE', data: 'Name, Email (if available), Profile Picture', note: 'For LINE users' },
      ],
      note: 'We use JWT (JSON Web Token) for session management with a maximum lifetime of 30 days. Email addresses are hashed using SHA-256 to serve as storage keys, enhancing security in data referencing.',
    },
    s4: {
      title: '4. AI Chatbot & Support Chat',
      aiTitle: 'AI Chatbot (SCC Bot)',
      aiItems: [
        'Uses Google Gemini AI for processing questions',
        'Messages you send are forwarded to Google Gemini API to generate responses',
        'If you are logged in, the system may search your order data to answer order status questions',
        'Conversation history is stored in your browser only (session-based), not on servers',
        'The system will not disclose other customers\' personal data through the AI Chatbot',
      ],
      supportTitle: 'Support Chat (Chat with Team)',
      supportItems: [
        'Chat messages are stored in the database so the team can respond',
        'Data stored: messages, name, email, timestamps, read status',
        'Supports image uploads for conversation context',
        'You can rate your satisfaction after a conversation ends',
        'Chat data is retained according to the Data Retention section',
      ],
    },
    s5: {
      title: '5. Data Retention Period',
      items: [
        { type: 'Order Data', duration: '2 years from order date', note: 'Per accounting requirements' },
        { type: 'Payment Proof', duration: '2 years from payment date', note: 'For auditing' },
        { type: 'User Profile Data', duration: 'Until deletion request', note: 'Can request deletion anytime' },
        { type: 'Support Chat Messages', duration: '1 year', note: 'After conversation closes' },
        { type: 'AI Chatbot Messages', duration: 'Not stored on server', note: 'Browser-only storage' },
        { type: 'Refund Data', duration: '2 years from processing', note: 'Per accounting requirements' },
        { type: 'User Activity Logs', duration: '90 days', note: 'For auditing' },
        { type: 'Security Logs', duration: '90 days', note: 'For threat detection' },
        { type: 'Cookies', duration: '1 year', note: 'Or until deleted' },
        { type: 'Email Send Logs', duration: '1 year', note: 'For auditing' },
      ],
      autoClean: {
        title: 'Automatic Cleanup System:',
        text: 'We have a Cron Job system that runs periodically to delete expired data per PDPA, cancel unpaid orders past the deadline, and automatically update parcel statuses.',
      },
    },
    s6: {
      title: '6. Data Subject Rights (PDPA Rights)',
      desc: 'Under the Personal Data Protection Act B.E. 2562, you have the following rights:',
      rights: [
        { title: 'Right of Access', desc: 'You can request to view your personal data that we maintain through the Data Request system on our website or by emailing our team.', color: '#2563eb' },
        { title: 'Right to Data Portability', desc: 'You can request a copy of your personal data in a readable JSON format through the Data Export system.', color: '#0ea5e9' },
        { title: 'Right to Rectification', desc: 'You can edit your profile data (name, phone, address, Instagram) yourself through the profile page.', color: '#f59e0b' },
        { title: 'Right to Erasure', desc: 'You can request deletion of your personal data, except order data that must be retained per accounting requirements.', color: '#ef4444' },
        { title: 'Right to Restrict Processing', desc: 'You can request temporary suspension of your personal data processing.', color: '#1e40af' },
        { title: 'Right to Object', desc: 'You can object to the processing of your personal data, such as promotional emails.', color: '#ec4899' },
      ],
      howToTitle: 'How to Exercise Your Rights:',
      howTo: '1. Through the Data Request system on the website (Menu: Privacy > Data Request)\n2. Send a request to email',
      howToSuffix: 'with your name, email used for orders, and the right you wish to exercise',
      howToDeadline: 'We will process your request within 30 days of receipt.',
    },
    s7: {
      title: '7. Security Measures',
      desc: 'We implement multi-layered security measures following international standards:',
      items: [
        'HTTPS/TLS Encryption', 'Content Security Policy (CSP)', 'AES-256-GCM Data Encryption',
        'SHA-256 Email Hashing', 'OAuth 2.0 + JWT Session', 'HMAC-SHA256 Request Signing',
        'Multi-level Rate Limiting', 'SQL/XSS Injection Prevention', 'Cloudflare Turnstile (CAPTCHA)',
        'Automatic Threat Detection', 'Automatic API Key Rotation', 'Security Audit Logging',
        'Brute Force Protection', 'Role-Based Access (14 Permissions)', 'Encrypted Image Proxy URLs', 'Sensitive Field Stripping',
      ],
    },
    s8: {
      title: '8. Cookie Policy',
      desc: 'We use cookies to improve your experience, categorized into 4 types:',
      types: [
        { type: 'Essential Cookies', required: true, desc: 'For basic functionality such as NextAuth Session, CSRF Protection, Cloudflare Turnstile' },
        { type: 'Functional Cookies', required: false, desc: 'For remembering cart (Zustand), profile data, light/dark theme, Cookie Consent' },
        { type: 'Analytics Cookies', required: false, desc: 'For understanding usage behavior to improve services' },
        { type: 'Marketing Cookies', required: false, desc: 'For displaying relevant advertisements (currently not used)' },
      ],
      required: 'Required',
      manage: 'You can manage cookie settings through the Cookie Banner at the bottom of the page or delete all cookies through your browser settings.',
    },
    s9: {
      title: '9. Third-Party Data Disclosure',
      desc: 'We may disclose your personal data to third parties only in the following cases:',
      dataSent: 'Data Sent',
      parties: [
        { party: 'Google (OAuth + Gemini AI)', purpose: 'Authentication, AI Chatbot processing', data: 'Email, Name, Chatbot messages' },
        { party: 'Microsoft Azure AD', purpose: 'Authentication with Microsoft account', data: 'Email, Name' },
        { party: 'Facebook', purpose: 'Authentication with Facebook account', data: 'Email, Name' },
        { party: 'Apple', purpose: 'Authentication with Apple account (Hide My Email supported)', data: 'Email, Name' },
        { party: 'LINE', purpose: 'Authentication with LINE account', data: 'Email (if available), Name' },
        { party: 'Supabase', purpose: 'Main database, Image storage, Real-time Updates', data: 'Order data, Profile, Chat' },
        { party: 'Cloudflare (Turnstile)', purpose: 'Bot prevention, CDN, Security', data: 'IP Address, Turnstile Token' },
        { party: 'Resend', purpose: 'Send order status notification emails', data: 'Recipient email, Email content' },
        { party: 'SlipOK', purpose: 'Automatic payment slip verification', data: 'Slip image, Transaction reference' },
        { party: 'Google Sheets', purpose: 'Sync order data for team management', data: 'Order data (name, items, total)' },
        { party: 'Track123', purpose: 'Real-time parcel tracking', data: 'Tracking number, Courier code' },
        { party: 'Filebase (IPFS/S3)', purpose: 'Product image and file storage', data: 'Images, Config files' },
      ],
      noteTitle: 'Note:',
      noteText: 'We will never sell or rent your personal data to third parties. All external services are used only to provide necessary services.',
    },
    s10: {
      title: '10. Payment & Shipping',
      paymentTitle: 'Payment',
      paymentItems: [
        'Supports PromptPay QR Code — QR generated within the website, no external service',
        'Supports bank transfer',
        'Transfer slips are uploaded and automatically verified via SlipOK',
        'Slip data is accessible only to administrators',
        'Refund System — You can request a refund for defective products with your refund account details',
      ],
      shippingTitle: 'Shipping',
      shippingItems: [
        'Supports multiple shipping methods (pickup, postal service, etc.)',
        'Shipping addresses are securely encrypted, accessible only to the shipping team',
        'Parcel tracking via Track123 — only tracking number and courier code are sent',
        'Supports saving multiple shipping addresses (Address Book)',
        'Pickup uses QR Code for identity verification',
      ],
    },
    s11: {
      title: '11. Contact (Data Protection Officer)',
      desc: 'If you have questions about our Privacy Policy or wish to exercise your data subject rights, please contact us:',
      orgName: 'Science Computer Club, Faculty of Science',
      orgAddr: 'Prince of Songkla University, Hat Yai Campus',
      email: 'Email',
      website: 'Website',
      facebook: 'Science Computer Club, Faculty of Science, PSU',
      chatLabel: 'Via chat button on the website',
    },
    s12: {
      title: '12. Policy Changes',
      desc: 'We may update this Privacy Policy from time to time. If there are significant changes, we will notify you via email or announcement on the website. Continued use of the website after policy changes constitutes acceptance of the new policy.',
      v3: { date: 'February 7, 2026', desc: 'Added AI Chatbot, Support Chat, Refund System, 5 OAuth Providers, additional security measures' },
      v2: { date: 'January 20, 2026', desc: 'Updated policy for PDPA compliance, added data subject rights' },
      v1: { date: 'Initial Launch', desc: 'First version of the Privacy Policy' },
    },
    copyright: '© 2026 Science Computer Club, Faculty of Science, Prince of Songkla University. All rights reserved.',
  },
};

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const c = CONTENT[lang];
  const rightIcons = [
    <Eye key="eye" size={20} />, <Download key="dl" size={20} />, <Settings key="set" size={20} />,
    <Trash2 key="trash" size={20} />, <Lock key="lock" size={20} />, <AlertCircle key="alert" size={20} />,
  ];
  const securityIcons = [
    <Lock key="0" size={18} />, <Shield key="1" size={18} />, <Fingerprint key="2" size={18} />,
    <Database key="3" size={18} />, <Users key="4" size={18} />, <ShieldCheck key="5" size={18} />,
    <Eye key="6" size={18} />, <AlertCircle key="7" size={18} />, <Scan key="8" size={18} />,
    <Shield key="9" size={18} />, <KeyRound key="10" size={18} />, <Settings key="11" size={18} />,
    <Activity key="12" size={18} />, <CheckCircle key="13" size={18} />, <Lock key="14" size={18} />, <Shield key="15" size={18} />,
  ];

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: THEME.bg,
      py: { xs: 4, md: 8 },
      px: { xs: 2, sm: 3 }
    }}>
      <Container maxWidth="md">
        {/* Back Button */}
        <Button
          startIcon={<ArrowLeft size={18} />}
          onClick={() => router.push('/')}
          sx={{
            mb: 4,
            color: THEME.textSecondary,
            '&:hover': { color: THEME.text }
          }}
        >
          {c.backHome}
        </Button>

        {/* Header */}
        <Paper sx={{
          p: { xs: 3, md: 5 },
          borderRadius: '24px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
          mb: 4,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 24px rgba(37,99,235,0.3)',
            }}>
              <Shield size={28} color="white" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: THEME.text, mb: 0.5 }}>
                {c.title}
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: THEME.textSecondary }}>
                {c.subtitle}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 2, 
            p: 2, 
            borderRadius: '12px', 
            bgcolor: 'rgba(37,99,235,0.1)',
            border: '1px solid rgba(37,99,235,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                {c.updatedLabel}: {c.lastUpdated}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                {c.versionLabel} {c.version}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Introduction */}
        <Paper sx={{
          p: { xs: 3, md: 4 },
          borderRadius: '20px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
          mb: 3,
        }}>
          <Typography sx={{ fontSize: '1rem', color: THEME.text, lineHeight: 1.8, mb: 3 }}>
            {c.intro}
          </Typography>

          <Box sx={{ 
            p: 2.5, 
            borderRadius: '14px', 
            bgcolor: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <CheckCircle size={20} color="#10b981" />
              <Typography sx={{ fontSize: '0.9rem', color: '#6ee7b7', lineHeight: 1.7 }}>
                <strong>{c.promise.title}</strong> {c.promise.text}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Section 1: Data Collection */}
        <Accordion 
          defaultExpanded
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
            '&.Mui-expanded': { margin: '0 0 24px 0' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Database size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s1.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {c.s1.desc}
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3 }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                {c.s1.directTitle}
              </Typography>
              <List dense>
                {c.s1.direct.map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircle size={16} color="#10b981" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.primary}
                      secondary={item.secondary}
                      primaryTypographyProps={{ sx: { color: THEME.text, fontWeight: 500 } }}
                      secondaryTypographyProps={{ sx: { color: THEME.muted, fontSize: '0.85rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3, mt: 3 }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                {c.s1.autoTitle}
              </Typography>
              <List dense>
                {c.s1.auto.map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Settings size={16} color="#2563eb" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.primary}
                      secondary={item.secondary}
                      primaryTypographyProps={{ sx: { color: THEME.text, fontWeight: 500 } }}
                      secondaryTypographyProps={{ sx: { color: THEME.muted, fontSize: '0.85rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3, mt: 3 }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                {c.s1.orderTitle}
              </Typography>
              <List dense>
                {c.s1.order.map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CreditCard size={16} color="#f59e0b" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.primary}
                      secondary={item.secondary}
                      primaryTypographyProps={{ sx: { color: THEME.text, fontWeight: 500 } }}
                      secondaryTypographyProps={{ sx: { color: THEME.muted, fontSize: '0.85rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 2: Purpose of Use */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Eye size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s2.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <List>
              {c.s2.items.map((text, idx) => (
                <ListItem key={idx} sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <CheckCircle size={18} color="#10b981" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={text}
                    primaryTypographyProps={{ sx: { color: THEME.text, lineHeight: 1.6 } }}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Section 3: Authentication */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <KeyRound size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s3.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {c.s3.desc}
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {c.s3.providers.map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 4 ? `1px solid ${THEME.border}` : 'none',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 0.5, sm: 2 },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: THEME.text }}>{item.provider}</Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: THEME.muted }}>{item.data}</Typography>
                  </Box>
                  <Box sx={{
                    px: 1.5,
                    py: 0.3,
                    borderRadius: '8px',
                    bgcolor: 'rgba(37,99,235,0.1)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    flexShrink: 0,
                  }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#93c5fd' }}>
                      {item.note}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Typography sx={{ color: THEME.textSecondary, mt: 3, lineHeight: 1.7, fontSize: '0.9rem' }}>
              {c.s3.note}
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* Section 4: AI Chatbot & Support Chat */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Bot size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s4.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            {/* AI Chatbot */}
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Bot size={20} color="#a78bfa" />
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>
                  {c.s4.aiTitle}
                </Typography>
              </Box>
              <List dense>
                {c.s4.aiItems.map((text, idx) => (
                  <ListItem key={idx} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <CheckCircle size={14} color="#10b981" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={text}
                      primaryTypographyProps={{ sx: { color: THEME.textSecondary, fontSize: '0.9rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Support Chat */}
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <MessageCircle size={20} color="#0ea5e9" />
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>
                  {c.s4.supportTitle}
                </Typography>
              </Box>
              <List dense>
                {c.s4.supportItems.map((text, idx) => (
                  <ListItem key={idx} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <CheckCircle size={14} color="#10b981" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={text}
                      primaryTypographyProps={{ sx: { color: THEME.textSecondary, fontSize: '0.9rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 5: Data Retention */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s5.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {c.s5.items.map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 9 ? `1px solid ${THEME.border}` : 'none',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 2 },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography sx={{ fontWeight: 600, color: THEME.text, minWidth: 200 }}>{item.type}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ color: '#6ee7b7', fontWeight: 500 }}>{item.duration}</Typography>
                    <Typography sx={{ color: THEME.muted, fontSize: '0.85rem' }}>({item.note})</Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ 
              mt: 3, 
              p: 2.5, 
              borderRadius: '14px', 
              bgcolor: 'rgba(37,99,235,0.1)',
              border: '1px solid rgba(37,99,235,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Activity size={20} color="#93c5fd" />
                <Typography sx={{ fontSize: '0.9rem', color: '#93c5fd', lineHeight: 1.7 }}>
                  <strong>{c.s5.autoClean.title}</strong> {c.s5.autoClean.text}
                </Typography>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 6: Your Rights */}
        <Accordion 
          defaultExpanded
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Users size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s6.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {c.s6.desc}
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 2 }}>
              {c.s6.rights.map((item, idx) => (
                <Box 
                  key={idx}
                  sx={{
                    p: 2.5,
                    borderRadius: '14px',
                    bgcolor: 'var(--glass-bg)',
                    border: `1px solid ${THEME.border}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: `${item.color}20`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: item.color,
                  }}>
                    {rightIcons[idx]}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: THEME.textSecondary, lineHeight: 1.6 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ 
              mt: 4, 
              p: 3, 
              borderRadius: '14px', 
              bgcolor: 'rgba(37,99,235,0.1)',
              border: '1px solid rgba(37,99,235,0.2)',
            }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                {c.s6.howToTitle}
              </Typography>
              <Typography sx={{ color: THEME.textSecondary, lineHeight: 1.8 }}>
                {c.s6.howTo.split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br/>}</span>
                ))}
                {' '}<Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>psuscc@psusci.club</Box>
                {' '}{c.s6.howToSuffix}<br/>
                {c.s6.howToDeadline}
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 7: Security Measures */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Lock size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s7.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {c.s7.desc}
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {c.s7.items.map((text, idx) => (
                <Box 
                  key={idx}
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    color: '#6ee7b7',
                  }}
                >
                  {securityIcons[idx]}
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 500 }}>{text}</Typography>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 8: Cookies */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Cookie size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s8.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {c.s8.desc}
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {c.s8.types.map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 3 ? `1px solid ${THEME.border}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Typography sx={{ fontWeight: 600, color: THEME.text }}>{item.type}</Typography>
                    {item.required && (
                      <Box sx={{
                        px: 1.5,
                        py: 0.3,
                        borderRadius: '8px',
                        bgcolor: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6ee7b7' }}>
                          {c.s8.required}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.9rem' }}>{item.desc}</Typography>
                </Box>
              ))}
            </Box>

            <Typography sx={{ color: THEME.textSecondary, mt: 3, lineHeight: 1.7 }}>
              {c.s8.manage}
            </Typography>
          </AccordionDetails>
        </Accordion>

        {/* Section 9: Third Parties */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Globe size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s9.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              {c.s9.desc}
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {c.s9.parties.map((item, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    p: 2.5, 
                    borderBottom: idx < 11 ? `1px solid ${THEME.border}` : 'none',
                  }}
                >
                  <Box sx={{ 
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1,
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    mb: 0.5,
                  }}>
                    <Typography sx={{ fontWeight: 600, color: THEME.text }}>{item.party}</Typography>
                    <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem', fontWeight: 500 }}>{item.purpose}</Typography>
                  </Box>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.8rem' }}>
                    {c.s9.dataSent}: {item.data}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ 
              mt: 3, 
              p: 2.5, 
              borderRadius: '14px', 
              bgcolor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <AlertCircle size={20} color="#f87171" />
                <Typography sx={{ fontSize: '0.9rem', color: '#fca5a5', lineHeight: 1.7 }}>
                  <strong>{c.s9.noteTitle}</strong> {c.s9.noteText}
                </Typography>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 10: Payment & Shipping */}
        <Accordion 
          sx={{
            borderRadius: '20px !important',
            bgcolor: THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${THEME.border}`,
            mb: 3,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary 
            expandIcon={<ChevronDown color="#94a3b8" />}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Truck size={24} color="#2563eb" />
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
                {c.s10.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CreditCard size={20} color="#f59e0b" />
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>{c.s10.paymentTitle}</Typography>
              </Box>
              <List dense>
                {c.s10.paymentItems.map((text, idx) => (
                  <ListItem key={idx} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <CheckCircle size={14} color="#10b981" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={text}
                      primaryTypographyProps={{ sx: { color: THEME.textSecondary, fontSize: '0.9rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Truck size={20} color="#0ea5e9" />
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>{c.s10.shippingTitle}</Typography>
              </Box>
              <List dense>
                {c.s10.shippingItems.map((text, idx) => (
                  <ListItem key={idx} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <CheckCircle size={14} color="#10b981" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={text}
                      primaryTypographyProps={{ sx: { color: THEME.textSecondary, fontSize: '0.9rem' } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Section 11: Contact */}
        <Paper sx={{
          p: { xs: 3, md: 4 },
          borderRadius: '20px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
          mb: 3,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Mail size={24} color="#2563eb" />
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
              {c.s11.title}
            </Typography>
          </Box>

          <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
            {c.s11.desc}
          </Typography>

          <Box sx={{ 
            p: 3, 
            borderRadius: '14px', 
            bgcolor: 'rgba(37,99,235,0.1)',
            border: '1px solid rgba(37,99,235,0.2)',
          }}>
            <Typography sx={{ fontWeight: 700, color: THEME.text, mb: 2, fontSize: '1.1rem' }}>
              {c.s11.orgName}
            </Typography>
            <Typography sx={{ color: THEME.textSecondary, mb: 2, fontSize: '0.9rem' }}>
              {c.s11.orgAddr}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Mail size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  {c.s11.email}: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>psuscc@psusci.club</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Globe size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  {c.s11.website}: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>sccshop.psusci.club</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Users size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  Facebook: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>{c.s11.facebook}</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <MessageCircle size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  Instagram: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>@psuscc</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Bot size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  AI Chatbot / Support Chat: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>{c.s11.chatLabel}</Box>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Section 12: Policy Updates */}
        <Paper sx={{
          p: { xs: 3, md: 4 },
          borderRadius: '20px',
          bgcolor: THEME.bgCard,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${THEME.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <FileText size={24} color="#2563eb" />
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: THEME.text }}>
              {c.s12.title}
            </Typography>
          </Box>

          <Typography sx={{ color: THEME.textSecondary, lineHeight: 1.8, mb: 3 }}>
            {c.s12.desc}
          </Typography>

          <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden', mb: 3 }}>
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${THEME.border}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>{lang === 'th' ? 'เวอร์ชัน' : 'Version'} 3.0</Typography>
                <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem' }}>{c.s12.v3.date}</Typography>
              </Box>
              <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', mt: 0.5 }}>
                {c.s12.v3.desc}
              </Typography>
            </Box>
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${THEME.border}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>{lang === 'th' ? 'เวอร์ชัน' : 'Version'} 2.0</Typography>
                <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem' }}>{c.s12.v2.date}</Typography>
              </Box>
              <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', mt: 0.5 }}>
                {c.s12.v2.desc}
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>{lang === 'th' ? 'เวอร์ชัน' : 'Version'} 1.0</Typography>
                <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem' }}>{c.s12.v1.date}</Typography>
              </Box>
              <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', mt: 0.5 }}>
                {c.s12.v1.desc}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: THEME.border }} />

          <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', textAlign: 'center' }}>
            {c.copyright}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
