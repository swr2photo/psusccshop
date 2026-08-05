/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  QrCode,
  FileText,
  MessageCircle,
  HelpCircle,
  Truck,
  Building,
} from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useTranslation } from '@/hooks/useTranslation';
import { apiFetch } from '@/lib/api-client';

const STATUS_STEPS = ['PENDING', 'PAID', 'READY', 'COMPLETED'];

export default function StandaloneOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { lang } = useTranslation();
  const ref = String(params?.ref || '');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) return;
    let active = true;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        let found: any = null;
        // 1. Try GET /api/orders?ref=...
        try {
          const res = await apiFetch(`/api/orders?ref=${encodeURIComponent(ref)}`);
          if (res.ok) {
            const data = await res.json();
            found = data.order || data.data?.order || (data.orders && data.orders[0]);
          }
        } catch { /* fallback below */ }

        // 2. Fallback to GET /api/payment-info?ref=...
        if (!found) {
          const resPay = await apiFetch(`/api/payment-info?ref=${encodeURIComponent(ref)}`);
          if (resPay.ok) {
            const dataPay = await resPay.json();
            found = dataPay.order || dataPay.data?.order;
          }
        }

        if (!found) throw new Error('ไม่พบข้อมูลคำสั่งซื้อหมายเลขอ้างอิงนี้');
        if (active) setOrder(found);
      } catch (err: any) {
        if (active) setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetail();
    return () => { active = false; };
  }, [ref]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', pb: 10 }}>
        <StorefrontNavbar />
        <Container maxWidth="md" sx={{ pt: 10, textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ color: '#1e3a5f' }} />
          <Typography sx={{ mt: 2, color: '#64748b' }}>กำลังโหลดข้อมูลคำสั่งซื้อ #{ref}...</Typography>
        </Container>
        <MobileBottomNav />
      </Box>
    );
  }

  if (errorMsg || !order) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', pb: 10 }}>
        <StorefrontNavbar />
        <Container maxWidth="md" sx={{ pt: 8 }}>
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMsg || 'ไม่พบข้อมูลคำสั่งซื้อนี้'}
          </Alert>
          <Button component={Link} href="/orders" startIcon={<ArrowLeft size={18} />} variant="contained" sx={{ bgcolor: '#1e3a5f', borderRadius: 2.5 }}>
            กลับไปยังประวัติคำสั่งซื้อ
          </Button>
        </Container>
        <MobileBottomNav />
      </Box>
    );
  }

  const currentStatus = order.status?.toUpperCase() || 'PENDING';
  const isPaid = currentStatus === 'PAID' || currentStatus === 'READY' || currentStatus === 'COMPLETED' || order.paymentVerified;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Button
          component={Link}
          href="/orders"
          startIcon={<ArrowLeft size={18} />}
          sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--navy, #1e3a5f)', mb: 2 }}
        >
          {lang === 'en' ? 'Back to Orders' : 'ย้อนกลับไปยังคำสั่งซื้อทั้งหมด'}
        </Button>

        {/* Order Header Card */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)' }}>
                คำสั่งซื้อ #{order.ref}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                วันที่สั่งซื้อ: {new Date(order.createdAt || order.created_at || Date.now()).toLocaleString('th-TH')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {!isPaid && (
                <Button
                  component={Link}
                  href={`/payment/${encodeURIComponent(order.ref)}`}
                  variant="contained"
                  startIcon={<QrCode size={18} />}
                  sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, borderRadius: 2.5, px: 3, fontWeight: 700 }}
                >
                  ชำระเงินทันที
                </Button>
              )}
              {isPaid && (
                <Button
                  component={Link}
                  href={`/receipt/${encodeURIComponent(order.ref)}`}
                  variant="contained"
                  startIcon={<FileText size={18} />}
                  sx={{ bgcolor: '#1e3a5f', '&:hover': { bgcolor: '#162d4a' }, borderRadius: 2.5, px: 3, fontWeight: 700 }}
                >
                  ใบเสร็จ E-Receipt
                </Button>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Status Timeline Card */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)', mb: 3 }}>
            สถานะการดำเนินการ (Order Tracking)
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: currentStatus === 'PENDING' ? '#fef3c7' : '#f8fafc', border: '1px solid #cbd5e1' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: currentStatus === 'PENDING' ? '#92400e' : '#64748b' }}>
                1. สร้างคำสั่งซื้อ
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>รอการชำระเงิน</Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: isPaid ? '#dcfce7' : '#f8fafc', border: '1px solid #cbd5e1' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: isPaid ? '#166534' : '#64748b' }}>
                2. ยืนยันการชำระเงิน
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>ได้รับยอดแล้ว</Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: currentStatus === 'READY' || currentStatus === 'COMPLETED' ? '#e0f2fe' : '#f8fafc', border: '1px solid #cbd5e1' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: currentStatus === 'READY' || currentStatus === 'COMPLETED' ? '#0369a1' : '#64748b' }}>
                3. พร้อมรับสินค้า
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>รับ ณ ห้องชุมนุม</Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: currentStatus === 'COMPLETED' ? '#f0fdf4' : '#f8fafc', border: '1px solid #cbd5e1' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: currentStatus === 'COMPLETED' ? '#15803d' : '#64748b' }}>
                4. สำเร็จเรียบร้อย
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>รับสินค้าแล้ว</Typography>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 3 }}>
          {/* Items Breakdown */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)', mb: 2 }}>
              รายการสินค้าที่สั่งซื้อ
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(order.cart || order.items || []).map((item: any, i: number) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.name || item.productName}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {item.size ? `ไซส์ ${item.size} | ` : ''} จำนวน: {item.qty || item.quantity || 1}
                      {item.sleeve ? ` | แขน${item.sleeve === 'LONG' ? 'ยาว' : 'สั้น'}` : ''}
                    </Typography>
                    {(item.customName || item.customNumber) && (
                      <Typography sx={{ fontSize: '0.75rem', color: '#1e3a5f' }}>
                        สกรีน: {item.customName ? `ชื่อ ${item.customName}` : ''} {item.customNumber ? `เบอร์ ${item.customNumber}` : ''}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: '#1e3a5f' }}>
                    ฿{(Number(item.total) || (Number(item.price) * Number(item.qty || 1))).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 3, mt: 2, borderTop: '2px solid #e2e8f0' }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>ราคารวมทั้งหมด</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a5f' }}>
                ฿{Number(order.totalAmount || order.amount || 0).toLocaleString()}
              </Typography>
            </Box>
          </Paper>

          {/* Customer & Location Sidebar */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)', mb: 2 }}>
                ข้อมูลผู้สั่งซื้อ & สถานที่รับ
              </Typography>

              <Typography sx={{ fontSize: '0.875rem', mb: 1 }}><strong>ชื่อ:</strong> {order.customerName}</Typography>
              <Typography sx={{ fontSize: '0.875rem', mb: 1 }}><strong>อีเมล:</strong> {order.customerEmail}</Typography>
              {order.phone && <Typography sx={{ fontSize: '0.875rem', mb: 1 }}><strong>เบอร์โทร:</strong> {order.phone}</Typography>}
              {order.studentId && <Typography sx={{ fontSize: '0.875rem', mb: 1 }}><strong>รหัสนักศึกษา:</strong> {order.studentId}</Typography>}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', gap: 1, color: '#1e3a5f' }}>
                <MapPin size={18} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  รับ ณ ห้องชุมนุมคอมพิวเตอร์ (SCC Computer Club) ชั้น 2 อาคารศูนย์คอมพิวเตอร์
                </Typography>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', textAlign: 'center' }}>
              <HelpCircle size={32} color="#1e3a5f" style={{ marginBottom: 8 }} />
              <Typography sx={{ fontWeight: 700, mb: 1 }}>ต้องการความช่วยเหลือ?</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 2 }}>
                สามารถสอบถามเกี่ยวกับคำสั่งซื้อ หรือติดต่อทีมงานได้ตลอดเวลา
              </Typography>
              <Button component={Link} href="/support" variant="outlined" fullWidth sx={{ borderRadius: 2, textTransform: 'none' }}>
                ติดต่อศูนย์ช่วยเหลือ
              </Button>
            </Paper>
          </Box>
        </Box>
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
