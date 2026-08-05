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
import { MapPin, Calendar, Clock, CheckCircle2, Navigation, AlertCircle } from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useTranslation } from '@/hooks/useTranslation';

const EVENTS = [
  {
    id: 'scc-pickup-main',
    title: 'สถานที่รับสินค้าหลัก: ห้องชุมนุมคอมพิวเตอร์ (SCC Club)',
    date: 'เปิดบริการ จันทร์ - ศุกร์ (10:00 - 18:00 น.)',
    location: 'ชั้น 2 อาคารศูนย์คอมพิวเตอร์ คณะวิทยาศาสตร์ ม.สงขลานครินทร์ (วิทยาเขตหาดใหญ่)',
    status: 'ACTIVE',
    details: 'สำหรับนักศึกษาและบุคลากร สามารถนำหมายเลขอ้างอิงคำสั่งซื้อ (Order Ref) หรือ QR Code ในใบเสร็จมาแสดงเพื่อรับสินค้าได้ทันที',
    mapUrl: 'https://maps.google.com/?q=Faculty+of+Science+Prince+of+Songkla+University',
  },
  {
    id: 'scc-preorder-batch1',
    title: 'กำหนดการรับเสื้อค่าย & เสื้อชุมนุมประจำปี',
    date: 'ตามประกาศในใบเสร็จรับเงิน หรืออีเมลแจ้งเตือน',
    location: 'ห้องชุมนุมคอมพิวเตอร์ หรือซุ้มกิจกรรมคณะวิทยาศาสตร์',
    status: 'UPCOMING',
    details: 'สินค้า Pre-order จะทยอยผลิตและเปิดให้รับตามรอบคำสั่งซื้อ เมื่อสินค้าพร้อมรับ ระบบจะส่งอีเมลและข้อความแจ้งเตือนทันที',
  },
];

export default function StandaloneEventsPage() {
  const { lang } = useTranslation();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 1, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {lang === 'en' ? 'Pickup Events & Schedule' : 'กำหนดการและสถานที่รับสินค้า'}
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-muted, #64748b)' }}>
            ตรวจสอบสถานที่รับเสื้อ ของที่ระลึก และกำหนดการเปิดรับสินค้าของชุมนุมคอมพิวเตอร์
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {EVENTS.map((evt) => (
            <Card key={evt.id} variant="outlined" sx={{ borderRadius: 3, borderColor: '#e2e8f0', p: { xs: 2.5, md: 3.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', fontSize: { xs: '1.2rem', md: '1.4rem' } }}>
                  {evt.title}
                </Typography>
                <Chip
                  label={evt.status === 'ACTIVE' ? 'เปิดบริการปกติ' : 'เร็วๆ นี้'}
                  sx={{
                    bgcolor: evt.status === 'ACTIVE' ? '#dcfce7' : '#fef3c7',
                    color: evt.status === 'ACTIVE' ? '#166534' : '#92400e',
                    fontWeight: 700,
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#475569' }}>
                  <Calendar size={18} color="#1e3a5f" />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{evt.date}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: '#475569' }}>
                  <MapPin size={18} color="#1e3a5f" style={{ marginTop: 2, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.95rem' }}>{evt.location}</Typography>
                </Box>
              </Box>

              <Typography sx={{ color: '#64748b', fontSize: '0.9rem', mb: 3, lineHeight: 1.6 }}>
                {evt.details}
              </Typography>

              {evt.mapUrl && (
                <Button
                  component="a"
                  href={evt.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  startIcon={<Navigation size={16} />}
                  sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 600, color: '#1e3a5f', borderColor: '#1e3a5f' }}
                >
                  นำทางไปสถานที่รับสินค้า (Google Maps)
                </Button>
              )}
            </Card>
          ))}
        </Box>
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
