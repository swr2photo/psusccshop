/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  HelpCircle,
  MessageCircle,
  Mail,
  MapPin,
  Clock,
  ChevronDown,
  FileText,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useTranslation } from '@/hooks/useTranslation';

const FAQS = [
  {
    q: 'ชำระเงินแล้วระบบอัปเดตสถานะทันทีหรือไม่?',
    a: 'สำหรับการชำระเงินผ่าน Stripe PromptPay ระบบจะตรวจสอบและอัปเดตสถานะเป็น "ชำระเงินแล้ว" โดยอัตโนมัติภายในไม่กี่วินาที กรณีโอนเงินด้วยตนเองและแนบสลิป ทีมงานจะตรวจสอบและยืนยันยอดภายใน 1-2 ชั่วโมง',
  },
  {
    q: 'จะได้รับใบเสร็จรับเงิน (E-Receipt) ได้อย่างไร?',
    a: 'เมื่อชำระเงินสำเร็จ ระบบจะจัดส่ง E-Receipt ไปยังอีเมลของท่านโดยอัตโนมัติ และท่านสามารถกดปุ่ม "ดูใบเสร็จ E-Receipt" จากหน้าประวัติคำสั่งซื้อได้ตลอดเวลา',
  },
  {
    q: 'รับสินค้าได้ที่ไหน และเมื่อใด?',
    a: 'สามารถรับสินค้าได้ที่ ห้องชุมนุมคอมพิวเตอร์ (SCC Computer Club) ชั้น 2 อาคารศูนย์คอมพิวเตอร์ คณะวิทยาศาสตร์ ม.สงขลานครินทร์ ตามวันและเวลาที่กำหนดในแจ้งเตือน',
  },
  {
    q: 'หากต้องการแก้ไขไซส์เสื้อ หรือข้อมูลคำสั่งซื้อทำอย่างไร?',
    a: 'ท่านสามารถติดต่อแอดมินผ่านแชทช่วยเหลือ หรืออีเมล psuscc@psuscc.club โดยแจ้งหมายเลขคำสั่งซื้อที่ต้องการแก้ไข ก่อนที่สินค้าจะถูกจัดเตรียม',
  },
];

export default function StandaloneSupportPage() {
  const { lang } = useTranslation();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 600, mx: 'auto' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 1, fontSize: { xs: '1.5rem', md: '2.2rem' } }}>
            {lang === 'en' ? 'Customer Support & Help Center' : 'ศูนย์ช่วยเหลือและติดต่อทีมงาน'}
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-muted, #64748b)' }}>
            มีข้อสงสัยเกี่ยวกับสินค้า คำสั่งซื้อ หรือการรับสินค้า? ทีมงาน PSU SCC พร้อมช่วยเหลือท่านตลอดเวลา
          </Typography>
        </Box>

        {/* Contact Cards Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, mb: 6 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(30,58,95,0.06)', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                <MessageCircle size={28} color="#1e3a5f" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>แชทช่วยเหลือสด</Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                สนทนากับแอดมินโดยตรงเพื่อสอบถามหรือแจ้งปัญหาเกี่ยวกับคำสั่งซื้อ
              </Typography>
            </Box>
            <Button component={Link} href="/messages" variant="contained" sx={{ bgcolor: '#1e3a5f', borderRadius: 2.5, textTransform: 'none', px: 3 }}>
              เริ่มแชทกับแอดมิน
            </Button>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(22,163,74,0.06)', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                <Mail size={28} color="#16a34a" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>ส่งอีเมลสอบถาม</Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                psuscc@psuscc.club (ตอบกลับภายใน 24 ชม.)
              </Typography>
            </Box>
            <Button component="a" href="mailto:psuscc@psuscc.club" variant="outlined" sx={{ borderColor: '#16a34a', color: '#16a34a', borderRadius: 2.5, textTransform: 'none', px: 3 }}>
              ส่งอีเมลหาทีมงาน
            </Button>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(3,105,161,0.06)', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                <MapPin size={28} color="#0369a1" />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>สถานที่ทำการ</Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                ห้องชุมนุมคอมพิวเตอร์ ชั้น 2 อาคารศูนย์คอมพิวเตอร์ คณะวิทยาศาสตร์ มอ.
              </Typography>
            </Box>
            <Button component={Link} href="/events" variant="outlined" sx={{ borderRadius: 2.5, textTransform: 'none', px: 3 }}>
              ดูปฏิทินและแผนที่
            </Button>
          </Paper>
        </Box>

        {/* FAQ Accordions */}
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', mb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 3 }}>
            คำถามที่พบบ่อย (FAQ)
          </Typography>

          {FAQS.map((faq, idx) => (
            <Accordion key={idx} elevation={0} sx={{ borderBottom: '1px solid #e2e8f0', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                <Typography sx={{ fontWeight: 700, color: '#1f2937' }}>{faq.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography sx={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>{faq.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>

        {/* Quick Links */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Button component={Link} href="/terms" startIcon={<FileText size={16} />} sx={{ color: '#64748b', textTransform: 'none' }}>
            ข้อตกลงและเงื่อนไข (Terms)
          </Button>
          <Button component={Link} href="/privacy" startIcon={<ShieldCheck size={16} />} sx={{ color: '#64748b', textTransform: 'none' }}>
            นโยบายความเป็นส่วนตัว (Privacy)
          </Button>
        </Box>
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
