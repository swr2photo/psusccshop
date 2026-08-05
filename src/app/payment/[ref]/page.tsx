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
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  TextField,
  Divider,
} from '@mui/material';
import { ArrowLeft, QrCode, CreditCard, CheckCircle2, ShieldCheck, Upload, Building2, Copy, Printer, XCircle, AlertTriangle } from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import StripePromptPay from '@/components/StripePromptPay';
import { useTranslation } from '@/hooks/useTranslation';
import { apiFetch } from '@/lib/api-client';

export default function StandalonePaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { lang } = useTranslation();
  const ref = String(params?.ref || '');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'promptpay' | 'manual'>('promptpay');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [bankInfo, setBankInfo] = useState<{ bankName?: string; accountNumber?: string; accountName?: string }>({});

  useEffect(() => {
    if (!ref) return;
    let active = true;
    const fetchOrder = async () => {
      setLoading(true);
      try {
        let found: any = null;
        // 1. Fetch order details from /api/orders
        try {
          const res = await apiFetch(`/api/orders?ref=${encodeURIComponent(ref)}`);
          if (res.ok) {
            const data = await res.json();
            found = data.order || data.data?.order || (data.orders && data.orders[0]);
          }
        } catch { /* fallback below */ }

        // 2. Fetch payment info from /api/payment-info
        try {
          const resPay = await apiFetch(`/api/payment-info?ref=${encodeURIComponent(ref)}`);
          if (resPay.ok) {
            const dataPay = await resPay.json();
            const payOrder = dataPay.order || dataPay.data?.order;
            if (!found) found = payOrder;
            const payData = dataPay.data || dataPay.info || dataPay;
            if (active && payData && (payData.bankName || payData.accountNumber)) {
              setBankInfo({
                bankName: payData.bankName,
                accountNumber: payData.accountNumber,
                accountName: payData.accountName,
              });
            }
          }
        } catch { /* ignore */ }

        if (!found) throw new Error('ไม่พบข้อมูลคำสั่งซื้อหมายเลขอ้างอิงนี้');
        if (active) setOrder(found);
      } catch (err: any) {
        if (active) setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลคำสั่งซื้อ');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOrder();
    return () => { active = false; };
  }, [ref]);

  const handleSlipUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slipFile) {
      setErrorMsg('กรุณาเลือกไฟล์สลิปการโอนเงิน');
      return;
    }
    setUploading(true);
    setErrorMsg(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(slipFile);
      reader.onload = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        const res = await apiFetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref,
            base64,
            mime: slipFile.type,
            name: slipFile.name,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.status === 'error') {
          throw new Error(json.message || 'ตรวจสอบสลิปไม่สำเร็จ');
        }
        setUploadSuccess(true);
        setTimeout(() => {
          router.push(`/orders/${encodeURIComponent(ref)}`);
        }, 1500);
      };
    } catch (err: any) {
      console.error('[PaymentPage] Slip upload failed:', err);
      setErrorMsg(err?.message || 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', pb: 10 }}>
        <StorefrontNavbar />
        <Container maxWidth="md" sx={{ pt: 10, textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ color: '#1e3a5f' }} />
          <Typography sx={{ mt: 2, color: '#64748b' }}>กำลังโหลดหน้าชำระเงิน #{ref}...</Typography>
        </Container>
        <MobileBottomNav />
      </Box>
    );
  }

  const currentStatus = (order?.status || 'PENDING').toUpperCase();
  const isAlreadyPaid = currentStatus === 'PAID' || currentStatus === 'READY' || currentStatus === 'SHIPPED' || currentStatus === 'COMPLETED' || order?.paymentVerified;
  const isCancelled = currentStatus === 'CANCELLED';
  const isExpired = currentStatus === 'EXPIRED';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />

      <Container maxWidth="md" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Button
          component={Link}
          href={`/orders/${encodeURIComponent(ref)}`}
          startIcon={<ArrowLeft size={18} />}
          sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--navy, #1e3a5f)', mb: 2 }}
        >
          {lang === 'en' ? 'Back to Order Details' : 'ย้อนกลับไปหน้ารายละเอียดคำสั่งซื้อ'}
        </Button>

        {/* Payment Summary Header */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)' }}>
                ชำระเงินคำสั่งซื้อ #{ref}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                ลูกค้า: {order?.customerName} ({order?.customerEmail})
              </Typography>
            </Box>

            <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>ยอดชำระทั้งหมด</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: isCancelled ? '#dc2626' : isExpired ? '#d97706' : '#166534' }}>
                  ฿{Number(order?.totalAmount || order?.amount || 0).toLocaleString()}
                </Typography>
              </Box>
              <Button
                component={Link}
                href={`/api/payment-notice?ref=${encodeURIComponent(ref)}&lang=${lang}`}
                target="_blank"
                size="small"
                startIcon={<Printer size={16} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: '#1e3a5f',
                  border: '1px solid rgba(30,58,95,0.28)',
                  bgcolor: '#f1f5f9',
                  borderRadius: '8px',
                  px: 1.25,
                  py: 0.5,
                  '&:hover': { bgcolor: '#e2e8f0' },
                }}
              >
                {lang === 'en' ? 'Payment Notice (PDF)' : 'หนังสือแจ้งชำระเงินอิเล็กทรอนิกส์ (PDF)'}
              </Button>
            </Box>
          </Box>
        </Paper>

        {isCancelled ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px solid #fca5a5', bgcolor: '#fef2f2' }}>
            <XCircle size={56} color="#dc2626" style={{ marginBottom: 12 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#991b1b', mb: 1 }}>
              คำสั่งซื้อนี้ถูกยกเลิกแล้ว
            </Typography>
            <Typography variant="body2" sx={{ color: '#7f1d1d', mb: 3 }}>
              คำสั่งซื้อได้รับการยกเลิกแล้ว ไม่สามารถทำรายการชำระเงินเพิ่มเติมได้
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button component={Link} href={`/orders/${encodeURIComponent(ref)}`} variant="contained" sx={{ bgcolor: '#1e3a5f', borderRadius: 2.5, px: 3 }}>
                ดูรายละเอียดคำสั่งซื้อ
              </Button>
              <Button component={Link} href="/" variant="outlined" sx={{ borderRadius: 2.5, px: 3 }}>
                กลับสู่หน้าหลัก
              </Button>
            </Box>
          </Paper>
        ) : isExpired ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px solid #fcd34d', bgcolor: '#fffbeb' }}>
            <AlertTriangle size={56} color="#d97706" style={{ marginBottom: 12 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#92400e', mb: 1 }}>
              หมดเวลาชำระเงินสำหรับคำสั่งซื้อนี้
            </Typography>
            <Typography variant="body2" sx={{ color: '#78350f', mb: 3 }}>
              ระยะเวลาในการสั่งซื้อหรือการชำระเงินสิ้นสุดลงแล้ว ไม่สามารถทำรายการชำระเงินได้
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button component={Link} href={`/orders/${encodeURIComponent(ref)}`} variant="contained" sx={{ bgcolor: '#1e3a5f', borderRadius: 2.5, px: 3 }}>
                ดูรายละเอียดคำสั่งซื้อ
              </Button>
              <Button component={Link} href="/" variant="outlined" sx={{ borderRadius: 2.5, px: 3 }}>
                สั่งซื้อสินค้าใหม่
              </Button>
            </Box>
          </Paper>
        ) : isAlreadyPaid ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px solid #86efac', bgcolor: '#f0fdf4' }}>
            <CheckCircle2 size={56} color="#16a34a" style={{ marginBottom: 12 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#166534', mb: 1 }}>
              คำสั่งซื้อนี้ชำระเงินเรียบร้อยแล้ว
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mb: 3 }}>
              ระบบได้บันทึกการชำระเงินแล้ว ท่านสามารถเปิดดูหรือพิมพ์ E-Receipt ได้ทันที
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button component={Link} href={`/receipt/${encodeURIComponent(ref)}`} variant="contained" sx={{ bgcolor: '#166534', borderRadius: 2.5, px: 3 }}>
                ดูใบเสร็จรับเงิน (E-Receipt)
              </Button>
              <Button component={Link} href={`/orders/${encodeURIComponent(ref)}`} variant="outlined" sx={{ borderRadius: 2.5, px: 3 }}>
                ดูรายละเอียดคำสั่งซื้อ
              </Button>
            </Box>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}

            {/* Method Tabs */}
            <Tabs
              value={payMethod}
              onChange={(_, val) => setPayMethod(val)}
              variant="fullWidth"
              sx={{ mb: 3, borderBottom: '1px solid #e2e8f0', '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}
            >
              <Tab icon={<QrCode size={18} />} iconPosition="start" label="Stripe PromptPay (AUTO)" value="promptpay" />
              <Tab icon={<CreditCard size={18} />} iconPosition="start" label="โอนเงิน + แนบสลิป" value="manual" />
            </Tabs>

            {payMethod === 'promptpay' ? (
              <Box sx={{ py: 2 }}>
                <StripePromptPay
                  orderRef={ref}
                  onSuccess={() => {
                    router.push(`/orders/${encodeURIComponent(ref)}`);
                  }}
                  onSwitchToManual={() => setPayMethod('manual')}
                />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Bank Account Info */}
                <Box sx={{ p: 3, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                  <Typography sx={{ fontWeight: 700, color: '#1e3a5f', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Building2 size={18} /> บัญชีธนาคารสำหรับโอนเงิน
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', mb: 0.5 }}>{bankInfo.bankName || 'ธนาคารไทยพาณิชย์ (SCB)'}</Typography>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a5f', letterSpacing: 1 }}>
                    {bankInfo.accountNumber || '123-4-56789-0'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
                    ชื่อบัญชี: {bankInfo.accountName || 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์'}
                  </Typography>
                </Box>

                {/* Upload Form */}
                <form onSubmit={handleSlipUpload}>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>อัปโหลดสลิปการโอนเงิน</Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<Upload size={20} />}
                    sx={{ py: 2, borderRadius: 2.5, borderStyle: 'dashed', borderWidth: 2 }}
                  >
                    {slipFile ? slipFile.name : 'เลือกไฟล์ภาพสลิป (PNG, JPG)'}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                    />
                  </Button>

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={!slipFile || uploading}
                    startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle2 size={20} />}
                    sx={{ mt: 3, py: 1.5, borderRadius: 3, bgcolor: '#1e3a5f', fontWeight: 700, textTransform: 'none' }}
                  >
                    {uploading ? 'กำลังส่งข้อมูล...' : 'ส่งสลิปเพื่อยืนยันการชำระเงิน'}
                  </Button>
                </form>
              </Box>
            )}
          </Paper>
        )}
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
