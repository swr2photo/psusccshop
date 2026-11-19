/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Clock, LogIn, MapPin, Package, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import MobileBottomNav from '@/components/MobileBottomNav';
import OrderHistoryDrawer from '@/components/OrderHistoryDrawer';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import { getShopStatus } from '@/components/ShopStatusCard';
import { cancelOrder, getHistory, getPublicConfig } from '@/lib/api-client';
import type { ShopConfig } from '@/lib/config';
import type { OrderHistory } from '@/lib/shop-constants';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotification } from '@/components/NotificationContext';
import { useRealtimeOrdersByEmail } from '@/hooks/useRealtimeOrders';

type HistoryFilter = 'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';

const PAGE_SIZE = 20;

function normalizeOrder(order: any): OrderHistory {
  const items = order.items || order.cart || [];
  let total = Number(order.total ?? order.totalAmount ?? order.amount ?? 0);
  if (!total && Array.isArray(items)) {
    total = items.reduce((sum: number, item: any) => {
      const qty = Number(item.qty ?? item.quantity ?? 1);
      const unit = Number(item.unitPrice ?? item.price ?? 0);
      return sum + Number(item.subtotal ?? unit * qty);
    }, 0);
  }

  return {
    ...order,
    ref: String(order.ref || ''),
    status: String(order.status || 'PENDING'),
    date: order.date || order.createdAt || order.created_at || new Date().toISOString(),
    total,
    items,
  };
}

/** Standalone route backed by the exact same order-history UI as the home popup. */
export default function StandaloneOrdersPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { t, lang } = useTranslation();
  const notify = useNotification();
  const email = session?.user?.email;
  const ordersRef = useRef<OrderHistory[]>([]);
  const refreshRef = useRef<() => void>(() => undefined);

  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [confirmCancelRef, setConfirmCancelRef] = useState<string | null>(null);
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [qrOrderRef, setQrOrderRef] = useState<string | null>(null);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const loadPage = useCallback(async (append = false, silent = false) => {
    if (!email) {
      if (sessionStatus !== 'loading') setLoading(false);
      return;
    }

    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);
    try {
      const offset = append ? ordersRef.current.length : 0;
      const response = await getHistory(email, offset, PAGE_SIZE);
      const raw = response.data?.history ?? (response as any).history;
      if (response.status !== 'success' || !Array.isArray(raw)) {
        throw new Error(response.message || t.misc.cannotLoadHistory);
      }

      const next = raw.map(normalizeOrder).filter((order) => order.ref);
      const serverHasMore = Boolean(response.data?.hasMore);
      const existingRefs = new Set(ordersRef.current.map((order) => order.ref));
      const uniqueNext = append ? next.filter((order) => !existingRefs.has(order.ref)) : next;

      // Keep already-rendered history if a transient API response is empty.
      if (!append && next.length === 0 && ordersRef.current.length > 0) return;
      // Avoid repeatedly requesting the same page when the backend returns duplicates.
      if (append && uniqueNext.length === 0) {
        setHasMore(false);
        return;
      }

      setOrders((previous) => {
        if (!append) return next;
        const refs = new Set(previous.map((order) => order.ref));
        return [...previous, ...uniqueNext.filter((order) => !refs.has(order.ref))];
      });
      setHasMore(serverHasMore);
    } catch (error) {
      console.error('[StandaloneOrdersPage] Failed to load history:', error);
      if (!silent) notify.error(t.common.error, t.misc.cannotLoadHistory);
    } finally {
      if (append) setLoadingMore(false);
      else if (!silent) setLoading(false);
    }
  }, [email, notify, sessionStatus, t.common.error, t.misc.cannotLoadHistory]);

  useEffect(() => {
    refreshRef.current = () => { void loadPage(false, true); };
  }, [loadPage]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    let active = true;
    void getPublicConfig().then((response) => {
      if (!active || response.status !== 'success') return;
      const nextConfig = (response.data as ShopConfig | undefined) ?? (response.config as ShopConfig | undefined);
      if (nextConfig) setConfig(nextConfig);
    });
    return () => { active = false; };
  }, []);

  const handleRealtimeChange = useCallback(() => {
    refreshRef.current();
  }, []);
  const realtime = useRealtimeOrdersByEmail(email, handleRealtimeChange);

  const isShopOpen = useMemo(() => {
    if (!config) return true;
    return getShopStatus(config.isOpen, config.closeDate, config.openDate) === 'OPEN';
  }, [config]);

  const confirmCancellation = async () => {
    if (!confirmCancelRef) return;
    const ref = confirmCancelRef;
    setConfirmCancelRef(null);
    setCancellingRef(ref);
    try {
      const response = await cancelOrder(ref);
      if (response.status !== 'success') throw new Error(response.message || t.common.error);
      setOrders((previous) => previous.map((order) => (
        order.ref === ref ? { ...order, status: 'CANCELLED' } : order
      )));
      notify.success(t.common.success);
    } catch (error) {
      notify.error(t.common.error, error instanceof Error ? error.message : t.common.error);
    } finally {
      setCancellingRef(null);
    }
  };

  return (
    <>
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background)', color: 'var(--foreground)' }}>
        <StorefrontNavbar />

        {sessionStatus === 'unauthenticated' && !email && (
          <Box
            sx={{
              maxWidth: 1080,
              mx: 'auto',
              px: { xs: 2, sm: 3, md: 4 },
              pt: { xs: 2.5, md: 3.5 },
            }}
          >
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: '18px',
                bgcolor: 'rgba(0,113,227,0.08)',
                border: '1px solid rgba(0,113,227,0.24)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {lang === 'en' ? 'Sign in to view your orders' : 'เข้าสู่ระบบเพื่อดูประวัติคำสั่งซื้อของคุณ'}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mt: 0.25 }}>
                  {lang === 'en'
                    ? 'Sign in with the Google account used when placing your order.'
                    : 'กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่ใช้สั่งซื้อเพื่อซิงก์รายการคำสั่งซื้อและใบเสร็จรับเงิน'}
                </Typography>
              </Box>
              <Button
                onClick={() => { void signIn('google'); }}
                startIcon={<LogIn size={16} />}
                sx={{
                  px: 2.25,
                  py: 0.9,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                  color: '#fff',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(0,113,227,0.28)',
                  '&:hover': { opacity: 0.92 },
                }}
              >
                {lang === 'en' ? 'Sign in with Google' : 'เข้าสู่ระบบด้วย Google'}
              </Button>
            </Box>
          </Box>
        )}

        <OrderHistoryDrawer
          standalone
          open
          onClose={() => router.push('/')}
          orderHistory={orders}
          loadingHistory={loading || sessionStatus === 'loading'}
          loadingHistoryMore={loadingMore}
          historyHasMore={hasMore}
          historyFilter={filter}
          onFilterChange={setFilter}
          onLoadMore={() => { void loadPage(true); }}
          onOpenPayment={(ref) => router.push(`/payment/${encodeURIComponent(ref)}`)}
          onCancelOrder={setConfirmCancelRef}
          onShowQR={setQrOrderRef}
          cancellingRef={cancellingRef}
          isShopOpen={isShopOpen}
          realtimeConnected={realtime.isConnected}
          config={config}
          onImageClick={setLightboxImage}
          onRefundRequested={() => { void loadPage(false, true); }}
          onBrowseShop={() => router.push('/')}
        />

        <MobileBottomNav activeKey="history" />
      </Box>

      <Dialog
        open={Boolean(lightboxImage)}
        onClose={() => setLightboxImage(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.97)',
            boxShadow: 'none',
          },
        }}
        sx={{ zIndex: 99999 }}
      >
        <IconButton
          onClick={() => setLightboxImage(null)}
          aria-label={t.common.close}
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 16 },
            color: '#fff',
            bgcolor: 'rgba(255,255,255,0.12)',
            zIndex: 1,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
          }}
        >
          <X size={22} />
        </IconButton>
        {lightboxImage && (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
            <Box
              component="img"
              src={lightboxImage}
              alt="Full size product"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 2, userSelect: 'none' }}
            />
          </Box>
        )}
      </Dialog>

      <Dialog
        open={Boolean(qrOrderRef)}
        onClose={() => setQrOrderRef(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'var(--background)',
            backgroundImage: 'radial-gradient(circle at 50% 50%, var(--glow-2), transparent 50%)',
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, position: 'relative' }}>
          <IconButton
            onClick={() => setQrOrderRef(null)}
            aria-label={t.common.close}
            sx={{ position: 'absolute', top: 16, right: 16, bgcolor: 'var(--glass-bg)', color: 'var(--foreground)', '&:hover': { bgcolor: 'var(--glass-bg)' } }}
          >
            <X size={24} />
          </IconButton>

          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
              <Package size={36} color="#0071e3" />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', mb: 0.5 }}>
              {t.qrDialog.title}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {t.qrDialog.instruction}
            </Typography>
          </Box>

          <Box sx={{ p: 4, borderRadius: '24px', bgcolor: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', mb: 3 }}>
            <QRCodeSVG
              value={`ORDER:${qrOrderRef || ''}`}
              size={Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 100 : 280)}
              level="H"
              includeMargin={false}
            />
          </Box>

          <Box sx={{ px: 3, py: 1.5, borderRadius: '16px', bgcolor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', mb: 4 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', mb: 0.5 }}>
              {t.qrDialog.orderNumber}
            </Typography>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '0.05em' }}>
              {qrOrderRef}
            </Typography>
          </Box>

          {(() => {
            const targetOrder = orders.find((order) => order.ref === qrOrderRef);
            if (!targetOrder) return null;
            const items = targetOrder.items || targetOrder.cart || [];
            const productIds = items.map((item: any) => item.productId || (item as any).id).filter(Boolean);
            const pickupProducts = config?.products?.filter((product) => product.pickup?.enabled && productIds.includes(product.id)) || [];
            if (pickupProducts.length === 0) return null;
            const locations = [...new Set(pickupProducts.map((product) => product.pickup?.location).filter(Boolean))];
            const firstPickup = pickupProducts[0]?.pickup;
            return (
              <Box sx={{ maxWidth: 360, width: '100%', p: 2.5, borderRadius: '16px', bgcolor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MapPin size={18} style={{ color: 'var(--success)' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>{t.qrDialog.pickupLocation}</Typography>
                </Box>
                {locations.map((location, index) => (
                  <Typography key={index} sx={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 600, mb: 0.5 }}>{location}</Typography>
                ))}
                {firstPickup && (firstPickup.startDate || firstPickup.endDate) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {firstPickup.startDate && new Date(firstPickup.startDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {firstPickup.startDate && firstPickup.endDate && ' - '}
                      {firstPickup.endDate && new Date(firstPickup.endDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
                {firstPickup?.notes && <Typography sx={{ fontSize: '0.8rem', color: 'var(--warning)', mt: 1 }}>{firstPickup.notes}</Typography>}
              </Box>
            );
          })()}

          <Button onClick={() => setQrOrderRef(null)} sx={{ mt: 4, px: 4, py: 1.5, borderRadius: '12px', bgcolor: 'var(--glass-bg)', color: 'var(--foreground)', fontSize: '1rem', fontWeight: 600, textTransform: 'none', '&:hover': { bgcolor: 'var(--glass-bg)' } }}>
            {t.common.close}
          </Button>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(confirmCancelRef)}
        onClose={() => setConfirmCancelRef(null)}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--glass-border)',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{t.orderHistory.confirmCancelTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'var(--foreground)', mb: 1 }}>
            {t.orderHistory.confirmCancelMessage} #{confirmCancelRef} {t.orderHistory.confirmCancelAsk}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t.orderHistory.cancelWarning}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirmCancelRef(null)} sx={{ color: 'var(--text-muted)' }}>
            {t.orderHistory.dontCancel}
          </Button>
          <Button onClick={() => { void confirmCancellation(); }} variant="contained" color="error">
            {t.orderHistory.confirmCancel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
