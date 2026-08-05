/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Card,
  Chip,
  Button,
} from '@mui/material';
import { Megaphone, Bell, Calendar, ChevronRight, ShieldCheck, Tag } from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useTranslation } from '@/hooks/useTranslation';

const ANNOUNCEMENTS = [
  {
    id: 'notice-stripe-promptpay',
    title: 'ประกาศ: อัปเกรดระบบชำระเงิน Stripe PromptPay อัตโนมัติ 24 ชม.',
    date: '2026-08-05',
    category: 'ระบบชำระเงิน',
    summary: 'ร้านค้าเปิดใช้งานการชำระเงินผ่าน Stripe PromptPay QR Code อัตโนมัติ สามารถสแกนจ่ายผ่านแอปธนาคารใดก็ได้ สลิปและสถานะชำระเงินจะถูกยืนยันทันทีพร้อมออก E-Receipt',
    urgent: true,
  },
  {
    id: 'notice-ereceipt',
    title: 'แจ้งการออกใบเสร็จรับเงินอิเล็กทรอนิกส์ (E-Receipt)',
    date: '2026-08-01',
    category: 'ใบเสร็จรับเงิน',
    summary: 'ลูกค้าสามารถดาวน์โหลดและพิมพ์ใบเสร็จรับเงินอิเล็กทรอนิกส์ (E-Receipt) ฉบับเต็มได้โดยตรงผ่านอีเมลที่แจ้งไว้ หรือกดจากหน้าประวัติคำสั่งซื้อ',
    urgent: false,
  },
  {
    id: 'notice-camp-shirts',
    title: 'เปิดรับพรีออเดอร์ เสื้อชุมนุมคอมพิวเตอร์ PSU SCC รุ่นใหม่ประจำปี',
    date: '2026-07-20',
    category: 'สินค้าใหม่',
    summary: 'เปิดให้สั่งซื้อเสื้อชุมนุมคอมพิวเตอร์และเสื้อค่าย สามารถเลือกสกรีนชื่อและเบอร์หลังเสื้อตามต้องการได้ผ่านหน้าร้านค้าออนไลน์',
    urgent: false,
  },
];

export default function StandaloneAnnouncementsPage() {
  const { lang } = useTranslation();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 1, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {lang === 'en' ? 'Announcements & News' : 'ประกาศและข่าวสารจากทางร้าน'}
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-muted, #64748b)' }}>
            ติดตามข่าวสาร ประกาศสำคัญ โปรโมชัน และการอัปเดตระบบของชุมนุมคอมพิวเตอร์
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {ANNOUNCEMENTS.map((item) => (
            <Card key={item.id} variant="outlined" sx={{ borderRadius: 3, borderColor: item.urgent ? '#3b82f6' : '#e2e8f0', p: { xs: 2.5, md: 3.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={item.category} size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
                  {item.urgent && (
                    <Chip label="สำคัญ" size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 700 }} />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Calendar size={14} /> {item.date}
                </Typography>
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 1.5, fontSize: { xs: '1.2rem', md: '1.35rem' } }}>
                {item.title}
              </Typography>

              <Typography sx={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6, mb: 2 }}>
                {item.summary}
              </Typography>

              <Button component={Link} href="/shop" endIcon={<ChevronRight size={16} />} sx={{ color: '#1e3a5f', fontWeight: 700, textTransform: 'none', p: 0 }}>
                ไปยังหน้าร้านค้า
              </Button>
            </Card>
          ))}
        </Box>
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
