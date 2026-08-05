/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  Button,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import { Search, Package, ExternalLink, QrCode, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useTranslation } from '@/hooks/useTranslation';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api-client';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'รอชำระเงิน', color: '#92400e', bg: '#fef3c7' },
  PAID: { label: 'ชำระเงินแล้ว', color: '#166534', bg: '#dcfce7' },
  READY: { label: 'พร้อมรับสินค้า', color: '#0369a1', bg: '#e0f2fe' },
  SHIPPED: { label: 'จัดส่งแล้ว', color: '#1d4ed8', bg: '#dbeafe' },
  COMPLETED: { label: 'สำเร็จ', color: '#15803d', bg: '#f0fdf4' },
  CANCELLED: { label: 'ยกเลิก', color: '#b91c1c', bg: '#fee2e2' },
};

export default function StandaloneOrdersPage() {
  const { lang } = useTranslation();
  const { data: session } = useSession();
  const [tabValue, setTabValue] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        let localRefs: string[] = [];
        try {
          const raw = localStorage.getItem('psu_scc_orders');
          if (raw) localRefs = JSON.parse(raw);
        } catch { /* ignore */ }

        const email = session?.user?.email;
        const fetchedList: any[] = [];
        const seenRefs = new Set<string>();

        // 1. Fetch user email orders
        if (email) {
          try {
            const res = await apiFetch(`/api/orders?email=${encodeURIComponent(email)}`);
            if (res.ok) {
              const data = await res.json();
              const history = data.data?.history || data.orders || data.history || [];
              if (Array.isArray(history)) {
                for (const o of history) {
                  if (o?.ref && !seenRefs.has(o.ref)) {
                    seenRefs.add(o.ref);
                    fetchedList.push(o);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[OrdersPage] Email fetch error:', e);
          }
        }

        // 2. Fetch local storage refs if any missing
        if (localRefs.length > 0) {
          const missingRefs = localRefs.filter((r) => !seenRefs.has(r));
          if (missingRefs.length > 0) {
            try {
              const resRefs = await apiFetch(`/api/orders?refs=${encodeURIComponent(missingRefs.join(','))}`);
              if (resRefs.ok) {
                const dataRefs = await resRefs.json();
                const historyRefs = dataRefs.data?.history || dataRefs.orders || dataRefs.history || [];
                if (Array.isArray(historyRefs)) {
                  for (const o of historyRefs) {
                    if (o?.ref && !seenRefs.has(o.ref)) {
                      seenRefs.add(o.ref);
                      fetchedList.push(o);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('[OrdersPage] Refs fetch error:', e);
            }
          }
        }

        if (active) setOrdersList(fetchedList);
      } catch (err) {
        console.error('[OrdersPage] Fetch error:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOrders();
    return () => { active = false; };
  }, [session]);

  const filteredOrders = ordersList.filter((order) => {
    const matchesTab = tabValue === 'ALL' || order.status?.toUpperCase() === tabValue;
    const matchesSearch =
      !searchQuery.trim() ||
      order.ref?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', fontSize: { xs: '1.5rem', md: '2rem' } }}>
              {lang === 'en' ? 'My Orders' : 'ประวัติคำสั่งซื้อ'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted, #64748b)', mt: 0.5 }}>
              {lang === 'en' ? 'Track order status and download E-Receipts' : 'ติดตามสถานะคำสั่งซื้อและรับใบเสร็จรับเงินอิเล็กทรอนิกส์'}
            </Typography>
          </Box>

          <TextField
            placeholder="ค้นหาตามรหัสคำสั่งซื้อ..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color="#64748b" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 260 }, bgcolor: '#ffffff', borderRadius: 2 }}
          />
        </Box>

        {/* Filter Tabs */}
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, mb: 3, bgcolor: '#ffffff', overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={(_, val) => setTabValue(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2, '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', py: 2 } }}
          >
            <Tab label="ทั้งหมด (All)" value="ALL" />
            <Tab label="รอชำระเงิน (Pending)" value="PENDING" />
            <Tab label="ชำระเงินแล้ว (Paid)" value="PAID" />
            <Tab label="พร้อมรับสินค้า (Ready)" value="READY" />
            <Tab label="สำเร็จ (Completed)" value="COMPLETED" />
            <Tab label="ยกเลิก (Cancelled)" value="CANCELLED" />
          </Tabs>
        </Paper>

        {/* Orders List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={36} sx={{ color: '#1e3a5f' }} />
          </Box>
        ) : filteredOrders.length === 0 ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Package size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#475569' }}>
              ไม่พบรายการคำสั่งซื้อ
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, mb: 3 }}>
              ลองค้นหาด้วยรหัสอื่น หรือเลือกซื้อสินค้าในร้านค้า
            </Typography>
            <Button component={Link} href="/shop" variant="contained" sx={{ bgcolor: '#1e3a5f', borderRadius: 2.5, px: 3 }}>
              ไปยังหน้าร้านค้า
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredOrders.map((order) => {
              const statusInfo = STATUS_MAP[order.status?.toUpperCase()] || STATUS_MAP.PENDING;
              return (
                <Card
                  key={order.id || order.ref}
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: '#e2e8f0',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' },
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a5f', fontSize: '1.05rem' }}>
                            #{order.ref}
                          </Typography>
                          <Chip
                            label={statusInfo.label}
                            size="small"
                            sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: statusInfo.bg, color: statusInfo.color }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8rem' }}>
                          วันที่สั่งซื้อ: {new Date(order.createdAt || order.created_at || Date.now()).toLocaleDateString('th-TH')} | ลูกค้า: {order.customerName}
                        </Typography>
                      </Box>

                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a5f' }}>
                        ฿{Number(order.totalAmount || order.amount || 0).toLocaleString()}
                      </Typography>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 1, borderTop: '1px solid #f1f5f9' }}>
                      <Button
                        component={Link}
                        href={`/orders/${encodeURIComponent(order.ref)}`}
                        variant="contained"
                        size="small"
                        endIcon={<ExternalLink size={14} />}
                        sx={{ bgcolor: '#1e3a5f', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                      >
                        ดูรายละเอียดและติดตามสถานะ
                      </Button>

                      {['PENDING', 'WAITING_PAYMENT', 'UNPAID'].includes(order.status?.toUpperCase() || '') && (
                        <Button
                          component={Link}
                          href={`/payment/${encodeURIComponent(order.ref)}`}
                          variant="contained"
                          size="small"
                          startIcon={<QrCode size={14} />}
                          sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                        >
                          ชำระเงินทันที
                        </Button>
                      )}

                      {(order.status?.toUpperCase() === 'PAID' || order.paymentVerified) && (
                        <Button
                          component={Link}
                          href={`/receipt/${encodeURIComponent(order.ref)}`}
                          variant="outlined"
                          size="small"
                          startIcon={<FileText size={14} />}
                          sx={{ color: '#166534', borderColor: '#86efac', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                        >
                          ใบเสร็จ E-Receipt
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
