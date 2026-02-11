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

const LAST_UPDATED = '7 กุมภาพันธ์ 2569';
const VERSION = '3.0';

export default function PrivacyPolicyPage() {
  const router = useRouter();

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
          กลับหน้าหลัก
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
                นโยบายความเป็นส่วนตัว
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: THEME.textSecondary }}>
                Privacy Policy &mdash; PDPA Compliance
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
                อัปเดตล่าสุด: {LAST_UPDATED}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={16} color="#94a3b8" />
              <Typography sx={{ fontSize: '0.85rem', color: THEME.textSecondary }}>
                เวอร์ชัน {VERSION}
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
            ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ (&quot;SCC Shop&quot;, &quot;เรา&quot;, &quot;ของเรา&quot;) 
            ให้ความสำคัญกับความเป็นส่วนตัวของข้อมูลของท่าน นโยบายความเป็นส่วนตัวฉบับนี้อธิบายวิธีการที่เราเก็บรวบรวม 
            ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคลของท่าน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
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
                <strong>คำมั่นสัญญาของเรา:</strong> เราจะไม่ขายหรือเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลภายนอก 
                เว้นแต่จะได้รับความยินยอมจากท่านหรือตามที่กฎหมายกำหนด ข้อมูลทั้งหมดถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย
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
                1. ข้อมูลที่เราเก็บรวบรวม
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเฉพาะเท่าที่จำเป็นสำหรับการให้บริการ:
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3 }}>
              <Typography sx={{ fontWeight: 600, color: THEME.text, mb: 2 }}>
                ข้อมูลที่ท่านให้โดยตรง:
              </Typography>
              <List dense>
                {[
                  { primary: 'ชื่อ-นามสกุล', secondary: 'สำหรับการจัดส่งสินค้า สกรีนบนสินค้า และการติดต่อ' },
                  { primary: 'อีเมล', secondary: 'สำหรับการยืนยันตัวตน (OAuth) และการแจ้งสถานะคำสั่งซื้อ' },
                  { primary: 'หมายเลขโทรศัพท์', secondary: 'สำหรับการติดต่อกรณีมีปัญหาการจัดส่ง' },
                  { primary: 'ที่อยู่จัดส่ง', secondary: 'สำหรับการจัดส่งสินค้า (รองรับบันทึกหลายที่อยู่)' },
                  { primary: 'Instagram', secondary: 'สำหรับการติดต่อทางช่องทางเสริม' },
                  { primary: 'หลักฐานการชำระเงิน (สลิป)', secondary: 'สำหรับการยืนยันการชำระเงินผ่านระบบ SlipOK' },
                  { primary: 'ข้อมูลบัญชีธนาคาร (กรณีขอคืนเงิน)', secondary: 'สำหรับดำเนินการคืนเงิน เก็บเฉพาะกรณีท่านขอ Refund' },
                  { primary: 'ข้อความในแชทสนับสนุน', secondary: 'สำหรับการให้บริการช่วยเหลือจากทีมงาน' },
                  { primary: 'ข้อความที่ส่งถึง AI Chatbot', secondary: 'สำหรับการตอบคำถามอัตโนมัติ ส่งไปประมวลผลที่ Google Gemini' },
                ].map((item, idx) => (
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
                ข้อมูลที่เก็บรวบรวมโดยอัตโนมัติ:
              </Typography>
              <List dense>
                {[
                  { primary: 'ข้อมูลการเข้าสู่ระบบ (OAuth 2.0)', secondary: 'ผ่าน Google, Microsoft, Facebook, Apple หรือ LINE Account' },
                  { primary: 'IP Address', secondary: 'สำหรับการรักษาความปลอดภัย (เก็บแบบเข้ารหัส/ปกปิดบางส่วน)' },
                  { primary: 'User Agent', secondary: 'สำหรับการตรวจจับภัยคุกคามและอุปกรณ์ผิดปกติ' },
                  { primary: 'คุกกี้', secondary: 'สำหรับการจดจำ Session, ตะกร้าสินค้า และการตั้งค่า' },
                  { primary: 'บันทึกกิจกรรม (Activity Logs)', secondary: 'เข้าสู่ระบบ, ออกจากระบบ, สั่งซื้อ — สำหรับการตรวจสอบความปลอดภัย' },
                  { primary: 'บันทึกความปลอดภัย (Security Audit Logs)', secondary: 'ประเภทเหตุการณ์, ระดับความรุนแรง, คะแนนภัยคุกคาม' },
                ].map((item, idx) => (
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
                ข้อมูลคำสั่งซื้อ:
              </Typography>
              <List dense>
                {[
                  { primary: 'รายการสินค้าในตะกร้า', secondary: 'ชื่อสินค้า, ไซซ์, จำนวน, ออปชั่นสกรีนชื่อ/เบอร์, แขนสั้น/ยาว' },
                  { primary: 'ข้อมูลการชำระเงิน', secondary: 'ยอดรวม, วิธีชำระ, สถานะการยืนยัน, รหัสอ้างอิงธุรกรรม' },
                  { primary: 'ข้อมูลการจัดส่ง', secondary: 'วิธีจัดส่ง, ค่าจัดส่ง, เลขพัสดุ, สถานะการจัดส่ง' },
                  { primary: 'ข้อมูลการคืนเงิน (ถ้ามี)', secondary: 'เหตุผล, จำนวนเงิน, สถานะ, ข้อมูลบัญชีคืนเงิน' },
                ].map((item, idx) => (
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
                2. วัตถุประสงค์ในการใช้ข้อมูล
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <List>
              {[
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ดำเนินการตามคำสั่งซื้อ จัดเตรียม และจัดส่งสินค้า' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ยืนยันการชำระเงินและตรวจสอบสลิปอัตโนมัติ (ผ่าน SlipOK)' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'แจ้งสถานะคำสั่งซื้อ สถานะการจัดส่ง และเลขพัสดุทางอีเมล' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ติดต่อกรณีมีปัญหาเกี่ยวกับคำสั่งซื้อหรือการจัดส่ง' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ให้บริการ AI Chatbot ตอบคำถามและช่วยค้นหาข้อมูลสินค้า/ออเดอร์' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ให้บริการแชทสนับสนุนจากทีมงาน (Support Chat)' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ดำเนินการคืนเงินเมื่อท่านร้องขอ (Refund System)' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ติดตามสถานะพัสดุแบบ Real-time (ผ่าน Track123)' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'บันทึกข้อมูลคำสั่งซื้อลง Google Sheets สำหรับการจัดการภายใน' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ป้องกันการทุจริต ตรวจจับภัยคุกคาม และรักษาความปลอดภัยของระบบ' },
                { icon: <CheckCircle size={18} color="#10b981" />, text: 'ปฏิบัติตามกฎหมายที่เกี่ยวข้อง รวมถึง PDPA' },
              ].map((item, idx) => (
                <ListItem key={idx} sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText 
                    primary={item.text}
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
                3. การยืนยันตัวตน (Authentication)
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราใช้ระบบ OAuth 2.0 ผ่าน NextAuth.js สำหรับการยืนยันตัวตน โดยรองรับผู้ให้บริการดังนี้:
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { provider: 'Google', data: 'ชื่อ, อีเมล, รูปโปรไฟล์', note: 'ผู้ให้บริการหลัก' },
                { provider: 'Microsoft (Azure AD)', data: 'ชื่อ, อีเมลองค์กร, รูปโปรไฟล์', note: 'สำหรับบัญชี Microsoft/Outlook' },
                { provider: 'Facebook', data: 'ชื่อ, อีเมล, รูปโปรไฟล์', note: 'เปิดใช้งานตามเงื่อนไข' },
                { provider: 'Apple', data: 'ชื่อ, อีเมล (หรือ Private Relay Email)', note: 'รองรับ Hide My Email' },
                { provider: 'LINE', data: 'ชื่อ, อีเมล (ถ้ามี), รูปโปรไฟล์', note: 'สำหรับผู้ใช้ LINE' },
              ].map((item, idx) => (
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
              เราใช้ JWT (JSON Web Token) สำหรับการจัดการ Session โดยมีอายุสูงสุด 30 วัน 
              ข้อมูลอีเมลจะถูกแปลงเป็นรหัส SHA-256 เพื่อใช้เป็นคีย์ในการจัดเก็บข้อมูล เพิ่มความปลอดภัยในการอ้างอิง
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
                4. AI Chatbot และ Support Chat
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            {/* AI Chatbot */}
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Bot size={20} color="#a78bfa" />
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>
                  AI Chatbot (SCC Bot)
                </Typography>
              </Box>
              <List dense>
                {[
                  'ใช้ Google Gemini AI สำหรับการประมวลผลคำถาม',
                  'ข้อความที่ท่านส่งจะถูกส่งไปยัง Google Gemini API เพื่อสร้างคำตอบ',
                  'หากท่านล็อกอินแล้ว ระบบอาจค้นหาข้อมูลออเดอร์ของท่านเพื่อตอบคำถามเกี่ยวกับสถานะสั่งซื้อ',
                  'ประวัติการสนทนาเก็บไว้ในเบราว์เซอร์ของท่านเท่านั้น (Session-based) ไม่ได้เก็บในเซิร์ฟเวอร์',
                  'ระบบจะไม่เปิดเผยข้อมูลส่วนตัวของลูกค้าคนอื่นผ่าน AI Chatbot',
                ].map((text, idx) => (
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
                  Support Chat (แชทกับทีมงาน)
                </Typography>
              </Box>
              <List dense>
                {[
                  'ข้อความแชทถูกเก็บในฐานข้อมูลเพื่อให้ทีมงานตอบกลับได้',
                  'ข้อมูลที่เก็บ: ข้อความ, ชื่อ, อีเมล, วันเวลา, การอ่านข้อความ',
                  'รองรับการอัปโหลดรูปภาพประกอบการสนทนา',
                  'ท่านสามารถให้คะแนนความพึงพอใจหลังจบการสนทนาได้',
                  'ข้อมูลแชทจะถูกเก็บรักษาตามระยะเวลาที่กำหนดในหมวดการเก็บรักษาข้อมูล',
                ].map((text, idx) => (
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
                5. ระยะเวลาในการเก็บรักษาข้อมูล
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
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
              ].map((item, idx) => (
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
                  <strong>ระบบทำความสะอาดอัตโนมัติ:</strong> เรามีระบบ Cron Job ที่ทำงานเป็นระยะ 
                  เพื่อลบข้อมูลที่หมดอายุตาม PDPA, ยกเลิกออเดอร์ที่ไม่ชำระเงินภายในกำหนด 
                  และอัปเดตสถานะพัสดุอัตโนมัติ
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
                6. สิทธิ์ของเจ้าของข้อมูล (PDPA Rights)
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ท่านมีสิทธิ์ดังต่อไปนี้:
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 2 }}>
              {[
                { 
                  icon: <Eye size={20} />, 
                  title: 'สิทธิ์ในการเข้าถึง', 
                  desc: 'ท่านสามารถขอดูข้อมูลส่วนบุคคลที่เราเก็บรักษาไว้เกี่ยวกับท่าน ผ่านระบบ Data Request ในเว็บไซต์ หรือส่งอีเมลมาที่ทีมงาน',
                  color: '#2563eb'
                },
                { 
                  icon: <Download size={20} />, 
                  title: 'สิทธิ์ในการขอรับข้อมูล (Data Portability)', 
                  desc: 'ท่านสามารถขอรับสำเนาข้อมูลส่วนบุคคลของท่านในรูปแบบ JSON ที่อ่านได้ ผ่านระบบ Data Export',
                  color: '#0ea5e9'
                },
                { 
                  icon: <Settings size={20} />, 
                  title: 'สิทธิ์ในการแก้ไขข้อมูล', 
                  desc: 'ท่านสามารถแก้ไขข้อมูลโปรไฟล์ (ชื่อ, เบอร์โทร, ที่อยู่, Instagram) ได้ด้วยตนเองผ่านหน้าโปรไฟล์',
                  color: '#f59e0b'
                },
                { 
                  icon: <Trash2 size={20} />, 
                  title: 'สิทธิ์ในการลบข้อมูล', 
                  desc: 'ท่านสามารถขอให้ลบข้อมูลส่วนบุคคลของท่านได้ ยกเว้นข้อมูลคำสั่งซื้อที่ต้องเก็บตามข้อกำหนดทางบัญชี',
                  color: '#ef4444'
                },
                { 
                  icon: <Lock size={20} />, 
                  title: 'สิทธิ์ในการระงับการใช้', 
                  desc: 'ท่านสามารถขอให้ระงับการใช้ข้อมูลส่วนบุคคลของท่านชั่วคราวได้',
                  color: '#1e40af'
                },
                { 
                  icon: <AlertCircle size={20} />, 
                  title: 'สิทธิ์ในการคัดค้าน', 
                  desc: 'ท่านสามารถคัดค้านการประมวลผลข้อมูลส่วนบุคคลของท่าน เช่น การส่งอีเมลประชาสัมพันธ์',
                  color: '#ec4899'
                },
              ].map((item, idx) => (
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
                    {item.icon}
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
                วิธีการใช้สิทธิ์:
              </Typography>
              <Typography sx={{ color: THEME.textSecondary, lineHeight: 1.8 }}>
                1. ผ่านระบบ Data Request ในเว็บไซต์ (เมนู Privacy &gt; Data Request)<br/>
                2. ส่งคำขอมาที่อีเมล <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>psuscc@psusci.club</Box> 
                {' '}พร้อมระบุชื่อ-อีเมลที่ใช้สั่งซื้อ และสิทธิ์ที่ต้องการใช้<br/>
                เราจะดำเนินการภายใน <strong>30 วัน</strong> นับจากวันที่ได้รับคำขอ
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
                7. มาตรการรักษาความปลอดภัย
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราใช้มาตรการรักษาความปลอดภัยหลายระดับตามมาตรฐานสากล:
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {[
                { icon: <Lock size={18} />, text: 'การเข้ารหัส HTTPS/TLS' },
                { icon: <Shield size={18} />, text: 'Content Security Policy (CSP)' },
                { icon: <Fingerprint size={18} />, text: 'เข้ารหัสข้อมูล AES-256-GCM' },
                { icon: <Database size={18} />, text: 'แฮชอีเมลด้วย SHA-256' },
                { icon: <Users size={18} />, text: 'OAuth 2.0 + JWT Session' },
                { icon: <ShieldCheck size={18} />, text: 'HMAC-SHA256 Request Signing' },
                { icon: <Eye size={18} />, text: 'Rate Limiting หลายระดับ' },
                { icon: <AlertCircle size={18} />, text: 'ป้องกัน SQL/XSS Injection' },
                { icon: <Scan size={18} />, text: 'Cloudflare Turnstile (CAPTCHA)' },
                { icon: <Shield size={18} />, text: 'Threat Detection อัตโนมัติ' },
                { icon: <KeyRound size={18} />, text: 'API Key Rotation อัตโนมัติ' },
                { icon: <Settings size={18} />, text: 'Security Audit Logging' },
                { icon: <Activity size={18} />, text: 'Brute Force Protection' },
                { icon: <CheckCircle size={18} />, text: 'Role-Based Access (14 Permissions)' },
                { icon: <Lock size={18} />, text: 'Encrypted Image Proxy URLs' },
                { icon: <Shield size={18} />, text: 'Sensitive Field Stripping' },
              ].map((item, idx) => (
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
                  {item.icon}
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.text}</Typography>
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
                8. นโยบายคุกกี้
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งานของท่าน โดยแบ่งออกเป็น 4 ประเภท:
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { 
                  type: 'คุกกี้ที่จำเป็น (Essential)', 
                  required: true,
                  desc: 'สำหรับการทำงานพื้นฐาน เช่น NextAuth Session, CSRF Protection, Cloudflare Turnstile',
                },
                { 
                  type: 'คุกกี้ฟังก์ชัน (Functional)', 
                  required: false,
                  desc: 'สำหรับจดจำตะกร้าสินค้า (Zustand), ข้อมูลโปรไฟล์, ธีมสว่าง/มืด, Cookie Consent',
                },
                { 
                  type: 'คุกกี้วิเคราะห์ (Analytics)', 
                  required: false,
                  desc: 'สำหรับเข้าใจพฤติกรรมการใช้งานเพื่อปรับปรุงบริการ',
                },
                { 
                  type: 'คุกกี้การตลาด (Marketing)', 
                  required: false,
                  desc: 'สำหรับแสดงโฆษณาที่ตรงกับความสนใจของท่าน (ปัจจุบันไม่ได้ใช้)',
                },
              ].map((item, idx) => (
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
                          จำเป็น
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ color: THEME.muted, fontSize: '0.9rem' }}>{item.desc}</Typography>
                </Box>
              ))}
            </Box>

            <Typography sx={{ color: THEME.textSecondary, mt: 3, lineHeight: 1.7 }}>
              ท่านสามารถจัดการการตั้งค่าคุกกี้ได้ผ่าน Cookie Banner ที่ด้านล่างของหน้าเว็บ 
              หรือลบคุกกี้ทั้งหมดผ่านการตั้งค่าเบราว์เซอร์
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
                9. การเปิดเผยข้อมูลต่อบุคคลภายนอก
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
              เราอาจเปิดเผยข้อมูลส่วนบุคคลของท่านให้กับบุคคลภายนอกในกรณีต่อไปนี้เท่านั้น:
            </Typography>
            
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden' }}>
              {[
                { 
                  party: 'Google (OAuth + Gemini AI)', 
                  purpose: 'ยืนยันตัวตน, ประมวลผลคำถาม AI Chatbot',
                  data: 'อีเมล, ชื่อ, ข้อความ Chatbot',
                },
                { 
                  party: 'Microsoft Azure AD', 
                  purpose: 'ยืนยันตัวตนด้วยบัญชี Microsoft',
                  data: 'อีเมล, ชื่อ',
                },
                { 
                  party: 'Facebook', 
                  purpose: 'ยืนยันตัวตนด้วยบัญชี Facebook',
                  data: 'อีเมล, ชื่อ',
                },
                { 
                  party: 'Apple', 
                  purpose: 'ยืนยันตัวตนด้วยบัญชี Apple (รองรับ Hide My Email)',
                  data: 'อีเมล, ชื่อ',
                },
                { 
                  party: 'LINE', 
                  purpose: 'ยืนยันตัวตนด้วยบัญชี LINE',
                  data: 'อีเมล (ถ้ามี), ชื่อ',
                },
                { 
                  party: 'Supabase', 
                  purpose: 'ฐานข้อมูลหลัก, จัดเก็บรูปภาพ, Real-time Updates',
                  data: 'ข้อมูลคำสั่งซื้อ, โปรไฟล์, แชท',
                },
                { 
                  party: 'Cloudflare (Turnstile)', 
                  purpose: 'ป้องกัน Bot, CDN, ความปลอดภัย',
                  data: 'IP Address, Turnstile Token',
                },
                { 
                  party: 'Resend', 
                  purpose: 'ส่งอีเมลแจ้งเตือนสถานะคำสั่งซื้อ',
                  data: 'อีเมลผู้รับ, เนื้อหาอีเมล',
                },
                { 
                  party: 'SlipOK', 
                  purpose: 'ตรวจสอบสลิปการชำระเงินอัตโนมัติ',
                  data: 'รูปสลิป, รหัสอ้างอิงธุรกรรม',
                },
                { 
                  party: 'Google Sheets', 
                  purpose: 'Sync ข้อมูลคำสั่งซื้อสำหรับทีมงาน',
                  data: 'ข้อมูลคำสั่งซื้อ (ชื่อ, รายการ, ยอด)',
                },
                { 
                  party: 'Track123', 
                  purpose: 'ติดตามสถานะพัสดุแบบ Real-time',
                  data: 'เลขพัสดุ, รหัสขนส่ง',
                },
                { 
                  party: 'Filebase (IPFS/S3)', 
                  purpose: 'จัดเก็บรูปภาพสินค้าและไฟล์',
                  data: 'รูปภาพ, ไฟล์ config',
                },
              ].map((item, idx) => (
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
                    ข้อมูลที่ส่ง: {item.data}
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
                  <strong>หมายเหตุ:</strong> เราจะไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอกเด็ดขาด 
                  บริการภายนอกทั้งหมดถูกใช้เพื่อการให้บริการที่จำเป็นเท่านั้น
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
                10. การชำระเงินและการจัดส่ง
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2, md: 4 }, pb: 4 }}>
            <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CreditCard size={20} color="#f59e0b" />
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>การชำระเงิน</Typography>
              </Box>
              <List dense>
                {[
                  'รองรับ PromptPay QR Code — สร้าง QR Code ภายในเว็บไซต์ ไม่ผ่านบริการภายนอก',
                  'รองรับโอนเงินผ่านธนาคาร',
                  'สลิปการโอนเงินจะถูกอัปโหลดและตรวจสอบอัตโนมัติผ่าน SlipOK',
                  'ข้อมูลสลิปเข้าถึงได้เฉพาะผู้ดูแลระบบเท่านั้น',
                  'ระบบ Refund — ท่านสามารถขอคืนเงินกรณีสินค้ามีปัญหา พร้อมระบุบัญชีรับเงินคืน',
                ].map((text, idx) => (
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
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>การจัดส่ง</Typography>
              </Box>
              <List dense>
                {[
                  'รองรับหลายรูปแบบจัดส่ง (รับหน้าร้าน, ส่งไปรษณีย์ ฯลฯ)',
                  'ที่อยู่จัดส่งเก็บเข้ารหัสอย่างปลอดภัย เข้าถึงได้เฉพาะทีมจัดส่ง',
                  'เลขพัสดุติดตามผ่าน Track123 — ส่งเฉพาะเลขพัสดุและรหัสขนส่ง',
                  'รองรับบันทึกที่อยู่จัดส่งหลายแห่ง (Address Book)',
                  'การรับหน้าร้านใช้ QR Code ยืนยันตัวตน',
                ].map((text, idx) => (
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
              11. ช่องทางติดต่อ (Data Protection Officer)
            </Typography>
          </Box>

          <Typography sx={{ color: THEME.textSecondary, mb: 3, lineHeight: 1.7 }}>
            หากท่านมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว หรือต้องการใช้สิทธิ์ของเจ้าของข้อมูล สามารถติดต่อเราได้ที่:
          </Typography>

          <Box sx={{ 
            p: 3, 
            borderRadius: '14px', 
            bgcolor: 'rgba(37,99,235,0.1)',
            border: '1px solid rgba(37,99,235,0.2)',
          }}>
            <Typography sx={{ fontWeight: 700, color: THEME.text, mb: 2, fontSize: '1.1rem' }}>
              ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์
            </Typography>
            <Typography sx={{ color: THEME.textSecondary, mb: 2, fontSize: '0.9rem' }}>
              มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Mail size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  อีเมล: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>psuscc@psusci.club</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Globe size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  เว็บไซต์: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>sccshop.psusci.club</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Users size={18} color="#a78bfa" />
                <Typography sx={{ color: THEME.text }}>
                  Facebook: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.</Box>
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
                  AI Chatbot / Support Chat: <Box component="span" sx={{ color: '#a78bfa', fontWeight: 600 }}>ผ่านปุ่มแชทในเว็บไซต์</Box>
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
              12. การเปลี่ยนแปลงนโยบาย
            </Typography>
          </Box>

          <Typography sx={{ color: THEME.textSecondary, lineHeight: 1.8, mb: 3 }}>
            เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว หากมีการเปลี่ยนแปลงที่สำคัญ 
            เราจะแจ้งให้ท่านทราบผ่านทางอีเมลหรือประกาศบนเว็บไซต์ 
            การใช้งานเว็บไซต์ต่อหลังจากมีการเปลี่ยนแปลงนโยบาย ถือว่าท่านยอมรับนโยบายฉบับใหม่
          </Typography>

          <Box sx={{ bgcolor: 'var(--glass-bg)', borderRadius: '14px', overflow: 'hidden', mb: 3 }}>
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${THEME.border}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>เวอร์ชัน 3.0</Typography>
                <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem' }}>7 กุมภาพันธ์ 2569</Typography>
              </Box>
              <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', mt: 0.5 }}>
                เพิ่มข้อมูล AI Chatbot, Support Chat, Refund System, 5 OAuth Providers, มาตรการความปลอดภัยเพิ่มเติม
              </Typography>
            </Box>
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${THEME.border}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>เวอร์ชัน 2.0</Typography>
                <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem' }}>20 มกราคม 2569</Typography>
              </Box>
              <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', mt: 0.5 }}>
                ปรับปรุงนโยบายให้สอดคล้องกับ PDPA, เพิ่มสิทธิ์เจ้าของข้อมูล
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600, color: THEME.text }}>เวอร์ชัน 1.0</Typography>
                <Typography sx={{ color: '#6ee7b7', fontSize: '0.85rem' }}>เปิดตัวครั้งแรก</Typography>
              </Box>
              <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', mt: 0.5 }}>
                นโยบายความเป็นส่วนตัวฉบับแรก
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: THEME.border }} />

          <Typography sx={{ color: THEME.muted, fontSize: '0.85rem', textAlign: 'center' }}>
            &copy; 2569 ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ สงวนลิขสิทธิ์
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
