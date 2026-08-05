/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Divider,
  Paper,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useCartStore } from '@/store/cartStore';
import { useTranslation } from '@/hooks/useTranslation';

export default function StandaloneCartPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const cart = useCartStore((s) => s.cart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const updateItem = useCartStore((s) => s.updateItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const totalAmount = cart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalItems = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);

  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const item = cart[index];
    const unitPrice = item.price || (item.total / (item.qty || 1));
    const updated = {
      ...item,
      qty: newQty,
      total: unitPrice * newQty,
    };
    updateItem(index, updated);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar cartCount={totalItems} />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        {/* Breadcrumb & Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', fontSize: { xs: '1.5rem', md: '2rem' } }}>
              {lang === 'en' ? 'Shopping Cart' : 'ตะกร้าสินค้า'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted, #64748b)', mt: 0.5 }}>
              {lang === 'en' ? `You have ${totalItems} item(s) in your cart` : `มีสินค้าทั้งหมด ${totalItems} รายการในตะกร้า`}
            </Typography>
          </Box>
          <Button
            component={Link}
            href="/shop"
            startIcon={<ArrowLeft size={18} />}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--navy, #1e3a5f)' }}
          >
            {lang === 'en' ? 'Continue Shopping' : 'เลือกซื้อสินค้าเพิ่ม'}
          </Button>
        </Box>

        {cart.length === 0 ? (
          /* Empty Cart State */
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 8 },
              textAlign: 'center',
              borderRadius: 4,
              border: '1px solid var(--border-color, #e2e8f0)',
              bgcolor: 'var(--surface, #ffffff)',
            }}
          >
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(30,58,95,0.06)', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
              <ShoppingCart size={40} color="#1e3a5f" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              {lang === 'en' ? 'Your cart is empty' : 'ยังไม่มีสินค้าในตะกร้า'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted, #64748b)', mb: 3, maxWidth: 400, mx: 'auto' }}>
              {lang === 'en'
                ? 'Explore our merchandise and official PSU SCC products to get started.'
                : 'เลือกชมสินค้า เสื้อค่าย และของที่ระลึกเป็นทางการของชุมนุมคอมพิวเตอร์'}
            </Typography>
            <Button
              component={Link}
              href="/shop"
              variant="contained"
              size="large"
              startIcon={<ShoppingBag size={20} />}
              sx={{
                bgcolor: 'var(--navy, #1e3a5f)',
                '&:hover': { bgcolor: '#162d4a' },
                borderRadius: 3,
                px: 4, py: 1.2,
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              {lang === 'en' ? 'Browse Shop' : 'ไปยังหน้าร้านค้า'}
            </Button>
          </Paper>
        ) : (
          /* Cart Content & Summary Layout */
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 3, alignItems: 'start' }}>
            {/* Cart Item List */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                border: '1px solid var(--border-color, #e2e8f0)',
                bgcolor: 'var(--surface, #ffffff)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, mb: 2, borderBottom: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                  {lang === 'en' ? 'Cart Items' : 'รายการสินค้า'}
                </Typography>
                <Button
                  size="small"
                  onClick={clearCart}
                  startIcon={<Trash2 size={14} />}
                  sx={{ color: '#ef4444', textTransform: 'none', fontSize: '0.8rem' }}
                >
                  {lang === 'en' ? 'Clear All' : 'ล้างตะกร้า'}
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {cart.map((item, index) => (
                  <Card
                    key={`${item.id}-${index}`}
                    variant="outlined"
                    sx={{
                      borderRadius: 2.5,
                      borderColor: '#e2e8f0',
                      p: 2,
                      display: 'grid',
                      gridTemplateColumns: { xs: '80px 1fr', sm: '100px 1fr auto' },
                      gap: 2,
                      alignItems: 'center',
                    }}
                  >
                    {/* Item Image */}
                    <Box sx={{ width: { xs: 80, sm: 100 }, height: { xs: 80, sm: 100 }, borderRadius: 2, overflow: 'hidden', bgcolor: '#f1f5f9', position: 'relative' }}>
                      <Image
                        src={(item as any).image || '/icon.png'}
                        alt={item.name}
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    </Box>

                    {/* Item Info */}
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground, #0f172a)', mb: 0.5 }}>
                        {item.name}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {item.size && (
                          <Chip label={`ไซส์ ${item.size}`} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: '#e2e8f0' }} />
                        )}
                        {item.sleeve && (
                          <Chip label={item.sleeve === 'LONG' ? 'แขนยาว' : 'แขนสั้น'} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: '#fef3c7', color: '#92400e' }} />
                        )}
                        {item.selectedVariant && (
                          <Chip label={item.selectedVariant.name} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: '#e0f2fe', color: '#0369a1' }} />
                        )}
                      </Box>
                      {(item.customName || item.customNumber) && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>
                          สกรีน: {item.customName ? `ชื่อ ${item.customName}` : ''} {item.customNumber ? `เบอร์ ${item.customNumber}` : ''}
                        </Typography>
                      )}
                      <Typography sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)', mt: 0.5 }}>
                        ฿{Number(item.price || (item.total / (item.qty || 1))).toLocaleString()}
                      </Typography>
                    </Box>

                    {/* Controls & Total */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, alignItems: { xs: 'center', sm: 'flex-end' }, justifyContent: 'space-between', gridColumn: { xs: '1 / -1', sm: 'auto' }, gap: 1.5, pt: { xs: 1, sm: 0 }, borderTop: { xs: '1px solid #f1f5f9', sm: 'none' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 2, px: 0.5 }}>
                        <IconButton size="small" onClick={() => handleQtyChange(index, (item.qty || 1) - 1)}>
                          <Minus size={14} />
                        </IconButton>
                        <Typography sx={{ px: 1.5, fontWeight: 700, fontSize: '0.875rem' }}>
                          {item.qty || 1}
                        </Typography>
                        <IconButton size="small" onClick={() => handleQtyChange(index, (item.qty || 1) + 1)}>
                          <Plus size={14} />
                        </IconButton>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy, #1e3a5f)' }}>
                          ฿{Number(item.total).toLocaleString()}
                        </Typography>
                        <IconButton size="small" onClick={() => removeFromCart(index)} sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            </Paper>

            {/* Order Summary Sidebar */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: '1px solid var(--border-color, #e2e8f0)',
                bgcolor: 'var(--surface, #ffffff)',
                position: 'sticky',
                top: 90,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 2 }}>
                {lang === 'en' ? 'Order Summary' : 'สรุปยอดคำสั่งซื้อ'}
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, fontSize: '0.9rem', color: '#475569' }}>
                <span>{lang === 'en' ? 'Subtotal' : 'ยอดรวมสินค้า'}</span>
                <span style={{ fontWeight: 600 }}>฿{totalAmount.toLocaleString()}</span>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, fontSize: '0.9rem', color: '#475569' }}>
                <span>{lang === 'en' ? 'Shipping / Pickup' : 'ค่าจัดส่ง / รับด้วยตนเอง'}</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{lang === 'en' ? 'Calculated at checkout' : 'คำนวณในขั้นตอนถัดไป'}</span>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {lang === 'en' ? 'Total' : 'ยอดสุทธิ'}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--navy, #1e3a5f)' }}>
                  ฿{totalAmount.toLocaleString()}
                </Typography>
              </Box>

              <Button
                component={Link}
                href="/checkout"
                variant="contained"
                fullWidth
                size="large"
                endIcon={<ArrowRight size={20} />}
                sx={{
                  bgcolor: 'var(--navy, #1e3a5f)',
                  '&:hover': { bgcolor: '#162d4a' },
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(30,58,95,0.25)',
                }}
              >
                {lang === 'en' ? 'Proceed to Checkout' : 'ดำเนินการสั่งซื้อ'}
              </Button>

              <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, color: '#64748b', fontSize: '0.75rem', justifyContent: 'center' }}>
                <ShieldCheck size={16} color="#16a34a" />
                <span>ชำระเงินปลอดภัยผ่าน Stripe PromptPay & ธนาคารไทย</span>
              </Box>
            </Paper>
          </Box>
        )}
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
