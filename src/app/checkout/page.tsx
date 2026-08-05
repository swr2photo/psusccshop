/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  CreditCard,
  QrCode,
  FileText,
  User,
  Tag,
  Truck,
} from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import TurnstileWidget from '@/components/TurnstileWidget';
import { useCartStore } from '@/store/cartStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api-client';

export default function StandaloneCheckoutPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const { data: session } = useSession();
  const cart = useCartStore((s) => s.cart);
  const clearCart = useCartStore((s) => s.clearCart);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [studentId, setStudentId] = useState('');
  const [pickupLocation, setPickupLocation] = useState<'SCC_CLUB' | 'DELIVERY'>('SCC_CLUB');
  const [paymentGateway, setPaymentGateway] = useState<'promptpay' | 'manual'>('promptpay');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [wantReceipt, setWantReceipt] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [receiptAddress, setReceiptAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (session?.user) {
      if (session.user.name && !customerName) setCustomerName(session.user.name);
      if (session.user.email && !customerEmail) setCustomerEmail(session.user.email);
    }
  }, [session]);

  const totalAmount = cart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalItems = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoMsg(null);
    try {
      const res = await apiFetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), amount: totalAmount }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoDiscount(data.discount || 0);
        setPromoMsg({ type: 'success', text: `ใช้ส่วนลดสำเร็จ! ลด ฿${data.discount}` });
      } else {
        setPromoDiscount(0);
        setPromoMsg({ type: 'error', text: data.error || 'โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ' });
      }
    } catch {
      setPromoMsg({ type: 'error', text: 'ไม่สามารถตรวจสอบโค้ดส่วนลดได้' });
    } finally {
      setPromoLoading(false);
    }
  };

  const finalTotal = Math.max(0, totalAmount - promoDiscount);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg('ไม่มีสินค้าในตะกร้า');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุล และอีเมลให้ครบถ้วน');
      return;
    }
    if (pickupLocation === 'DELIVERY' && !address.trim()) {
      setErrorMsg('กรุณากรอกที่อยู่สำหรับจัดส่งพัสดุ');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        phone: phone.trim(),
        customerAddress: pickupLocation === 'DELIVERY' ? address.trim() : 'รับที่ห้องชุมนุม SCC',
        studentId: studentId.trim(),
        pickupLocation,
        shippingOptionId: pickupLocation === 'DELIVERY' ? 'delivery' : 'pickup',
        paymentMethod: paymentGateway,
        turnstileToken: turnstileToken || 'dev-bypass',
        cart,
        promoCode: promoDiscount > 0 ? promoCode.trim() : undefined,
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        receiptRequest: wantReceipt
          ? {
              wanted: true,
              taxOrStudentId: taxId.trim(),
              orgName: orgName.trim(),
              address: receiptAddress.trim() || address.trim(),
            }
          : undefined,
      };

      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'สร้างคำสั่งซื้อไม่สำเร็จ');
      }

      const orderRef = data.order?.ref || data.ref;
      if (orderRef) {
        try {
          const raw = localStorage.getItem('psu_scc_orders');
          const list = raw ? JSON.parse(raw) : [];
          if (!list.includes(orderRef)) {
            list.unshift(orderRef);
            localStorage.setItem('psu_scc_orders', JSON.stringify(list));
          }
        } catch { /* ignore */ }

        clearCart();
        router.push(`/payment/${encodeURIComponent(orderRef)}`);
      } else {
        throw new Error('ไม่ได้รับรหัสคำสั่งซื้อ');
      }
    } catch (err: any) {
      console.error('[Checkout] Error:', err);
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && !loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', pb: 10 }}>
        <StorefrontNavbar cartCount={0} />
        <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {lang === 'en' ? 'Your cart is empty' : 'ไม่มีสินค้าในตะกร้า'}
          </Typography>
          <Button component={Link} href="/shop" variant="contained" sx={{ bgcolor: 'var(--navy, #1e3a5f)', borderRadius: 3 }}>
            {lang === 'en' ? 'Back to Shop' : 'กลับไปยังหน้าร้านค้า'}
          </Button>
        </Container>
        <MobileBottomNav />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar cartCount={totalItems} />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Box sx={{ mb: 4 }}>
          <Button
            component={Link}
            href="/cart"
            startIcon={<ArrowLeft size={18} />}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--navy, #1e3a5f)', mb: 1 }}
          >
            {lang === 'en' ? 'Back to Cart' : 'ย้อนกลับไปหน้าตะกร้า'}
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {lang === 'en' ? 'Checkout' : 'ยืนยันการสั่งซื้อสินค้า'}
          </Typography>
        </Box>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}

        <form onSubmit={handlePlaceOrder}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 400px' }, gap: 3, alignItems: 'start' }}>
            {/* Left Form Column */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Customer Contact Details */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <User size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                    ข้อมูลผู้สั่งซื้อ (Customer Information)
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="ชื่อ-นามสกุล (Full Name)"
                    required
                    fullWidth
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <TextField
                    label="อีเมล (Email Address)"
                    type="email"
                    required
                    fullWidth
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    helperText="ใช้รับใบเสร็จ E-Receipt และการแจ้งเตือน"
                  />
                  <TextField
                    label="เบอร์โทรศัพท์ (Phone)"
                    fullWidth
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <TextField
                    label="รหัสนักศึกษา / บุคลากร (Option)"
                    fullWidth
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </Box>
              </Paper>

              {/* Pickup & Delivery Options */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MapPin size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                    รูปแบบการรับสินค้า / จัดส่ง (Shipping & Pickup)
                  </Typography>
                </Box>

                <RadioGroup value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value as any)}>
                  <Card variant="outlined" sx={{ mb: 1.5, borderColor: pickupLocation === 'SCC_CLUB' ? '#1e3a5f' : '#e2e8f0', borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <FormControlLabel
                        value="SCC_CLUB"
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                              รับที่ห้องชุมนุมคอมพิวเตอร์ (SCC Club Pickup)
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                              ชั้น 2 อาคารศูนย์คอมพิวเตอร์ คณะวิทยาศาสตร์ ม.สงขลานครินทร์ (รับฟรีไม่มีค่าจัดส่ง)
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ borderColor: pickupLocation === 'DELIVERY' ? '#1e3a5f' : '#e2e8f0', borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <FormControlLabel
                        value="DELIVERY"
                        control={<Radio size="small" />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Truck size={18} color="#1e3a5f" />
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                จัดส่งพัสดุตามที่อยู่ (Standard Delivery)
                              </Typography>
                              <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                จัดส่งด่วนถึงบ้านผ่าน Flash Express / ไปรษณีย์ไทย
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </RadioGroup>

                {pickupLocation === 'DELIVERY' && (
                  <Box sx={{ mt: 2.5 }}>
                    <TextField
                      label="ที่อยู่สำหรับจัดส่งพัสดุ (Delivery Address)"
                      required
                      multiline
                      rows={3}
                      fullWidth
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="บ้านเลขที่, หมู่บ้าน/อาคาร, ถนน, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์"
                    />
                  </Box>
                )}
              </Paper>

              {/* Payment Method Selector */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CreditCard size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                    วิธีการชำระเงิน (Payment Method)
                  </Typography>
                </Box>

                <RadioGroup value={paymentGateway} onChange={(e) => setPaymentGateway(e.target.value as any)}>
                  <Card variant="outlined" sx={{ mb: 1.5, borderColor: paymentGateway === 'promptpay' ? '#1a237e' : '#e2e8f0', borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <FormControlLabel
                        value="promptpay"
                        control={<Radio size="small" />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <QrCode size={20} color="#1a237e" />
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a237e' }}>
                                Stripe PromptPay (สแกน QR อัตโนมัติ)
                              </Typography>
                              <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                สแกนจ่ายผ่านแอปธนาคาร ระบบยืนยันยอดทันที 24 ชม.
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ borderColor: paymentGateway === 'manual' ? '#1e3a5f' : '#e2e8f0', borderRadius: 2 }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <FormControlLabel
                        value="manual"
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                              โอนเงินผ่านบัญชีธนาคาร + แนบสลิป
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                              โอนเงินเข้าบัญชีร้านค้า และอัปโหลดสลิปเพื่อให้ทีมงานตรวจสอบ
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </RadioGroup>
              </Paper>

              {/* Full Tax Invoice / E-Receipt Options */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileText size={20} color="#1e3a5f" />
                    <Typography sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                      ต้องการใบเสร็จรับเงิน / ใบกำกับภาษีเต็มรูปแบบ
                    </Typography>
                  </Box>
                  <Switch checked={wantReceipt} onChange={(e) => setWantReceipt(e.target.checked)} />
                </Box>

                {wantReceipt && (
                  <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: '1fr', gap: 2, pt: 2, borderTop: '1px solid #f1f5f9' }}>
                    <TextField
                      label="เลขประจำตัวผู้เสียภาษี / รหัสนักศึกษา"
                      fullWidth
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                    />
                    <TextField
                      label="ชื่อบริษัท / หน่วยงาน / คณะ"
                      fullWidth
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                    <TextField
                      label="ที่อยู่สำหรับออกใบเสร็จ"
                      multiline
                      rows={2}
                      fullWidth
                      value={receiptAddress}
                      onChange={(e) => setReceiptAddress(e.target.value)}
                    />
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Right Summary Column */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', position: 'sticky', top: 90 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 2 }}>
                รายการสั่งซื้อ ({totalItems} ชิ้น)
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 260, overflowY: 'auto', pr: 0.5, mb: 2 }}>
                {cart.map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <Box sx={{ pr: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {item.size ? `ไซส์ ${item.size}` : ''} x {item.qty}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700 }}>฿{Number(item.total).toLocaleString()}</Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Promo Code Section */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e3a5f', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tag size={16} /> โค้ดส่วนลด
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="ใส่โค้ดส่วนลด..."
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                    sx={{ borderColor: '#1e3a5f', color: '#1e3a5f', fontWeight: 700, textTransform: 'none', minWidth: 80 }}
                  >
                    {promoLoading ? <CircularProgress size={16} /> : 'ใช้โค้ด'}
                  </Button>
                </Box>
                {promoMsg && (
                  <Alert severity={promoMsg.type} sx={{ mt: 1, py: 0, fontSize: '0.8rem', borderRadius: 1.5 }}>
                    {promoMsg.text}
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Price Breakdown */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.9rem', color: '#475569' }}>
                <span>ยอดรวมสินค้า</span>
                <span style={{ fontWeight: 600 }}>฿{totalAmount.toLocaleString()}</span>
              </Box>
              {promoDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.9rem', color: '#16a34a' }}>
                  <span>ส่วนลดโปรโมชั่น</span>
                  <span style={{ fontWeight: 700 }}>-฿{promoDiscount.toLocaleString()}</span>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, pt: 1, borderTop: '2px solid #e2e8f0' }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>ยอดชำระทั้งหมด</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--navy, #1e3a5f)' }}>
                  ฿{finalTotal.toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ my: 2, display: 'flex', justifyContent: 'center' }}>
                <TurnstileWidget onSuccess={setTurnstileToken} theme="light" size="normal" />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle2 size={20} />}
                sx={{
                  bgcolor: 'var(--navy, #1e3a5f)',
                  '&:hover': { bgcolor: '#162d4a' },
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                }}
              >
                {loading ? 'กำลังสร้างคำสั่งซื้อ...' : 'ยืนยันและไปหน้าชำระเงิน'}
              </Button>

              <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 1, color: '#64748b', fontSize: '0.75rem', justifyContent: 'center' }}>
                <ShieldCheck size={16} color="#16a34a" />
                <span>รับประกันความปลอดภัยและการจัดส่งโดย PSU SCC</span>
              </Box>
            </Paper>
          </Box>
        </form>
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
