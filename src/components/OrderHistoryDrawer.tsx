'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Expand,
  ExternalLink,
  MapPin,
  Package,
  RotateCcw,
  ShoppingBag,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { 
  normalizeStatus, 
  getStatusLabel, 
  getStatusColor, 
  getStatusCategory,
  PAYABLE_STATUSES,
  CANCELABLE_STATUSES,
  REFUNDABLE_STATUSES,
  type OrderHistory,
} from '@/lib/shop-constants';
import { ShopConfig, getProductName } from '@/lib/config';
import { SHIPPING_PROVIDERS, getTrackingUrl, getTrack123Url, type ShippingProvider } from '@/lib/shipping';
import TrackingTimeline from './TrackingTimeline';
import { useNotification } from './NotificationContext';
import { CountdownBadge, isOrderExpired } from './OrderCountdown';
import { useTranslation } from '@/hooks/useTranslation';

interface HistoryFilter {
  key: string;
  label: string;
}

interface OrderHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  orderHistory: OrderHistory[];
  loadingHistory: boolean;
  loadingHistoryMore: boolean;
  historyHasMore: boolean;
  historyFilter: 'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  onFilterChange: (filter: 'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED') => void;
  onLoadMore: () => void;
  onOpenPayment: (ref: string) => void;
  onCancelOrder: (ref: string) => void;
  onShowQR: (ref: string) => void;
  cancellingRef: string | null;
  isShopOpen: boolean;
  realtimeConnected: boolean;
  config: ShopConfig | null;
  onImageClick?: (image: string) => void;
}

const historyFilters: HistoryFilter[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'WAITING_PAYMENT', label: 'รอชำระ' },
  { key: 'COMPLETED', label: 'สำเร็จ' },
  { key: 'SHIPPED', label: 'กำลังจัดส่ง' },
  { key: 'RECEIVED', label: 'รับแล้ว' },
  { key: 'CANCELLED', label: 'ยกเลิก' },
];

export default function OrderHistoryDrawer(props: OrderHistoryDrawerProps) {
  const {
    open,
    onClose,
    orderHistory,
    loadingHistory,
    loadingHistoryMore,
    historyHasMore,
    historyFilter,
    onFilterChange,
    onLoadMore,
    onOpenPayment,
    onCancelOrder,
    onShowQR,
    cancellingRef,
    isShopOpen,
    realtimeConnected,
    config,
    onImageClick,
  } = props;

  const { success: toastSuccess, error: toastError } = useNotification();
  const { t, lang } = useTranslation();

  // Filter label map for translating static historyFilters
  const filterLabelMap: Record<string, string> = {
    ALL: t.orderHistory.filterAll,
    WAITING_PAYMENT: t.orderHistory.filterWaiting,
    COMPLETED: t.orderHistory.filterCompleted,
    SHIPPED: t.orderHistory.filterShipped,
    RECEIVED: t.orderHistory.filterReceived,
    CANCELLED: t.orderHistory.filterCancelled,
  };

  // Expanded order cards
  const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (ref: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  // Refund request state
  const [refundDialogOpen, setRefundDialogOpen] = React.useState(false);
  const [refundOrderRef, setRefundOrderRef] = React.useState('');
  const [refundOrderTotal, setRefundOrderTotal] = React.useState(0);
  const [refundReason, setRefundReason] = React.useState('');
  const [refundDetails, setRefundDetails] = React.useState('');
  const [refundBankName, setRefundBankName] = React.useState('');
  const [refundBankAccount, setRefundBankAccount] = React.useState('');
  const [refundAccountName, setRefundAccountName] = React.useState('');
  const [refundAmount, setRefundAmount] = React.useState('');
  const [refundSubmitting, setRefundSubmitting] = React.useState(false);
  const refundReasons = React.useMemo(() => [
    t.orderHistory.reason_damaged,
    t.orderHistory.reason_wrong,
    t.orderHistory.reason_cantAttend,
    t.orderHistory.reason_changed,
    t.orderHistory.reason_other,
  ], [t]);
  const refundBanks = React.useMemo(() => [...t.bankNames], [t]);
  const promptPayLabel = t.bankNames[12];

  const openRefundDialog = (ref: string, total: number) => {
    setRefundOrderRef(ref);
    setRefundOrderTotal(total);
    setRefundAmount(String(total));
    setRefundReason('');
    setRefundDetails('');
    setRefundBankName('');
    setRefundBankAccount('');
    setRefundAccountName('');
    setRefundDialogOpen(true);
  };

  const handleSubmitRefund = async () => {
    if (!refundReason || !refundBankName || !refundBankAccount || !refundAccountName) return;
    setRefundSubmitting(true);
    try {
      const res = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: refundOrderRef,
          reason: refundReason,
          details: refundDetails,
          bankName: refundBankName,
          bankAccount: refundBankAccount,
          accountName: refundAccountName,
          amount: Number(refundAmount) || refundOrderTotal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRefundDialogOpen(false);
        toastSuccess(t.orderHistory.refundSuccess);
      } else {
        toastError(data.error || t.orderHistory.refundError);
      }
    } catch {
      toastError(t.orderHistory.refundRequestError);
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Filter counts
  const filterCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: orderHistory.length };
    orderHistory.forEach((order) => {
      const category = getStatusCategory(normalizeStatus(order.status));
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [orderHistory]);

  // Filtered orders
  const filteredOrders = React.useMemo(() => {
    if (historyFilter === 'ALL') return orderHistory;
    return orderHistory.filter((order) => {
      const category = getStatusCategory(normalizeStatus(order.status));
      return category === historyFilter;
    });
  }, [orderHistory, historyFilter]);

  // Swipe-to-dismiss state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const swipeStartY = useRef(0);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - swipeStartY.current;
    if (delta < 0) { setDragOffset(0); return; }
    setDragOffset(delta > 80 ? 80 + (delta - 80) * 0.3 : delta);
  }, [isDragging]);

  const handleSwipeEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset >= 80) {
      setDragOffset(window.innerHeight);
      setTimeout(() => { onClose(); setDragOffset(0); }, 200);
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, onClose]);

  React.useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: { xs: '92vh', sm: '85vh' },
          maxHeight: '92vh',
          borderTopLeftRadius: { xs: 20, sm: 24 },
          borderTopRightRadius: { xs: 20, sm: 24 },
          bgcolor: 'var(--background)',
          color: 'var(--foreground)',
          overflow: 'hidden',
          transform: dragOffset > 0 ? `translateY(${dragOffset}px) !important` : undefined,
          transition: isDragging ? 'none !important' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 2 },
        borderBottom: '1px solid var(--glass-border)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Drag Handle - Swipe to dismiss */}
        <Box
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={handleSwipeEnd}
          sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.5, cursor: 'grab', touchAction: 'none' }}
        >
          <Box sx={{ width: isDragging ? 48 : 36, height: 4, bgcolor: isDragging ? 'var(--text-muted)' : 'var(--glass-bg)', borderRadius: 2, transition: 'all 0.2s ease' }} />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Package size={20} color="white" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {t.orderHistory.title}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {orderHistory.length} {t.common.items}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </IconButton>
        </Box>

        {/* Filter Tabs */}
        <Box sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          mx: -2,
          px: 2,
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}>
          {historyFilters.map((filter) => {
            const isActive = historyFilter === filter.key;
            const count = filterCounts[filter.key] ?? 0;
            return (
              <Box
                key={filter.key}
                onClick={() => onFilterChange(filter.key as any)}
                sx={{
                  px: 2,
                  py: 0.8,
                  borderRadius: '20px',
                  bgcolor: isActive ? 'rgba(0,113,227,0.15)' : 'var(--surface-2)',
                  border: isActive ? '1px solid rgba(0,113,227,0.4)' : '1px solid var(--glass-border)',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(0,113,227,0.2)' : 'var(--glass-bg)',
                  },
                }}
              >
                {filterLabelMap[filter.key] || filter.label}
                <Box sx={{
                  px: 0.8,
                  py: 0.1,
                  borderRadius: '8px',
                  bgcolor: isActive ? 'rgba(0,113,227,0.3)' : 'var(--glass-bg)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {count}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        px: { xs: 1.5, sm: 2.5 },
        py: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {loadingHistory ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
            <CircularProgress size={36} sx={{ color: 'var(--primary)' }} />
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t.orderHistory.loading}</Typography>
          </Box>
        ) : filteredOrders.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(100,116,139,0.1)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Package size={36} style={{ color: 'var(--text-muted)' }} />
            </Box>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{t.orderHistory.empty}</Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {historyFilter === 'ALL' ? t.orderHistory.noOrders : t.orderHistory.tryFilter}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredOrders.map((order, idx) => {
              const statusKey = normalizeStatus(order.status);
              const statusLabel = getStatusLabel(statusKey, lang);
              const statusColor = getStatusColor(statusKey);
              const canCancel = CANCELABLE_STATUSES.includes(statusKey);
              const canPay = isShopOpen && PAYABLE_STATUSES.includes(statusKey);
              const canRequestRefund = REFUNDABLE_STATUSES.includes(statusKey) && !order.refundStatus;
              const category = getStatusCategory(statusKey);
              const isExpanded = expandedOrders.has(order.ref);
              const orderItems = order.items || order.cart || [];
              const totalItems = orderItems.reduce((sum: number, item: any) => sum + (item.qty || item.quantity || 1), 0);
              const firstProductImage = (() => {
                const firstItem = orderItems[0];
                if (!firstItem) return null;
                const productInfo = config?.products?.find((p) => p.id === firstItem.productId);
                return productInfo?.coverImage || productInfo?.images?.[0] || null;
              })();

              const getStatusIcon = () => {
                if (category === 'WAITING_PAYMENT') return <Clock size={14} />;
                if (category === 'COMPLETED') return <CheckCircle size={14} />;
                if (category === 'SHIPPED') return <Truck size={14} />;
                if (category === 'RECEIVED') return <Package size={14} />;
                if (category === 'CANCELLED') return <XCircle size={14} />;
                return <span>•</span>;
              };

              return (
                <Box
                  key={order.ref || idx}
                  sx={{
                    borderRadius: '16px',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Status Accent Bar */}
                  <Box sx={{ height: 3, background: statusColor, opacity: 0.85 }} />

                  {/* Order Summary (always visible) */}
                  <Box
                    onClick={() => toggleExpanded(order.ref)}
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      cursor: 'pointer',
                      '&:active': { bgcolor: 'rgba(0,0,0,0.02)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {/* Product Thumbnail Preview */}
                      <Box sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '12px',
                        bgcolor: 'var(--surface)',
                        flexShrink: 0,
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}>
                        {firstProductImage ? (
                          <img
                            src={firstProductImage}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            loading="lazy"
                          />
                        ) : (
                          <ShoppingBag size={22} style={{ color: 'var(--text-muted)' }} />
                        )}
                        {totalItems > 1 && (
                          <Box sx={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'var(--primary)',
                            color: 'white',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                            border: '2px solid var(--surface-2)',
                          }}>
                            {totalItems}
                          </Box>
                        )}
                      </Box>

                      {/* Order Info */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
                          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            #{order.ref}
                          </Typography>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            py: 0.3,
                            borderRadius: '8px',
                            bgcolor: `${statusColor}15`,
                            border: `1px solid ${statusColor}25`,
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', color: statusColor }}>{getStatusIcon()}</Box>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: statusColor }}>
                              {statusLabel}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(order.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            {' • '}
                            {totalItems} {t.common.pieces}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>
                              ฿{order.total?.toLocaleString() || '0'}
                            </Typography>
                            {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Quick Action Buttons (always visible for important actions) */}
                    {/* Countdown timer for WAITING_PAYMENT orders */}
                    {canPay && order.date && !isOrderExpired(order.date) && (
                      <Box sx={{ mt: 1, ml: '68px' }}>
                        <CountdownBadge orderDate={order.date} compact />
                      </Box>
                    )}

                    {(canPay || (canCancel && !canPay)) && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, ml: '68px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {canPay && !isOrderExpired(order.date) && (
                          <Button
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onOpenPayment(order.ref); }}
                            sx={{
                              px: 2,
                              py: 0.7,
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #34c759 0%, #30d158 100%)',
                              color: 'white',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              textTransform: 'none',
                              boxShadow: '0 2px 8px rgba(52,199,89,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              '&:hover': {
                                background: 'linear-gradient(135deg, #30d158 0%, #28a745 100%)',
                              },
                            }}
                          >
                            <CreditCard size={14} />
                            {t.orderHistory.payNow}
                          </Button>
                        )}
                        {canPay && isOrderExpired(order.date) && (
                          <CountdownBadge orderDate={order.date} compact />
                        )}
                        {!isShopOpen && PAYABLE_STATUSES.includes(statusKey) && (
                          <Typography sx={{ 
                            fontSize: '0.7rem', 
                            color: 'var(--warning)',
                            bgcolor: 'rgba(245,158,11,0.1)',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}>
                            <Clock size={12} />
                            {t.orderHistory.expiredPayment}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <Box sx={{ borderTop: '1px solid var(--glass-border)' }}>

                      {/* Refund Status Badge */}
                      {order.refundStatus && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                            px: 1.5,
                            py: 0.7,
                            borderRadius: '10px',
                            bgcolor: order.refundStatus === 'REJECTED' ? 'rgba(239,68,68,0.08)' :
                                     order.refundStatus === 'COMPLETED' ? 'rgba(16,185,129,0.08)' :
                                     'rgba(124,58,237,0.08)',
                            border: `1px solid ${
                              order.refundStatus === 'REJECTED' ? 'rgba(239,68,68,0.2)' :
                              order.refundStatus === 'COMPLETED' ? 'rgba(16,185,129,0.2)' :
                              'rgba(124,58,237,0.2)'
                            }`,
                          }}>
                            <RotateCcw size={13} style={{
                              color: order.refundStatus === 'REJECTED' ? 'var(--error)' :
                                     order.refundStatus === 'COMPLETED' ? 'var(--success)' : '#bf5af2',
                            }} />
                            <Typography sx={{
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              color: order.refundStatus === 'REJECTED' ? 'var(--error)' :
                                     order.refundStatus === 'COMPLETED' ? 'var(--success)' : '#bf5af2',
                            }}>
                              {order.refundStatus === 'REQUESTED' ? t.orderHistory.refundPending :
                               order.refundStatus === 'APPROVED' ? t.orderHistory.refundApproved :
                               order.refundStatus === 'COMPLETED' ? t.orderHistory.refundCompleted :
                               order.refundStatus === 'REJECTED' ? t.orderHistory.refundRejected :
                               t.orderHistory.refundRequest}
                            </Typography>
                            {order.refundAmount && (
                              <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--warning)', ml: 0.5 }}>
                                ฿{order.refundAmount.toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                          {order.refundAdminNote && (
                            <Typography sx={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              mt: 0.8,
                              px: 1.5,
                              py: 0.5,
                              bgcolor: 'rgba(100,116,139,0.06)',
                              borderRadius: '8px',
                            }}>
                              {t.orderHistory.adminNote} {order.refundAdminNote}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* ── Section: Products ── */}
                      {orderItems.length > 0 && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 2, pb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.5 }}>
                            <ShoppingBag size={14} style={{ color: 'var(--text-muted)' }} />
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t.orderHistory.orderItems} ({orderItems.length} {t.common.items})
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {orderItems.map((item: any, itemIdx: number) => {
                              const productInfo = config?.products?.find((p) => p.id === item.productId);
                              const productImage = productInfo?.coverImage || productInfo?.images?.[0];
                              const itemName = (productInfo ? getProductName(productInfo, lang) : null) || item.name || item.productName || productInfo?.name || t.orderHistory.unknownProduct;
                              const itemQty = item.qty || item.quantity || 1;
                              const itemIsLongSleeve = item.isLongSleeve || item.options?.isLongSleeve;
                              const itemCustomName = item.customName || item.options?.customName;
                              const itemCustomNumber = item.customNumber || item.options?.customNumber;
                              const itemSubtotal = item.subtotal || (item.unitPrice ? item.unitPrice * itemQty : 0);
                              
                              return (
                                <Box
                                  key={itemIdx}
                                  sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    p: 1.2,
                                    borderRadius: '12px',
                                    bgcolor: 'var(--surface)',
                                    border: '1px solid var(--glass-border)',
                                  }}
                                >
                                  {/* Clickable Product Image */}
                                  <Box
                                    onClick={() => productImage && onImageClick?.(productImage)}
                                    sx={{
                                      width: 56,
                                      height: 56,
                                      borderRadius: '10px',
                                      bgcolor: 'var(--surface-2)',
                                      flexShrink: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--glass-border)',
                                      overflow: 'hidden',
                                      cursor: productImage ? 'pointer' : 'default',
                                      position: 'relative',
                                      '&:hover .img-expand': { opacity: 1 },
                                    }}
                                  >
                                    {productImage ? (
                                      <>
                                        <img
                                          src={productImage}
                                          alt={itemName}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                          loading="lazy"
                                        />
                                        <Box
                                          className="img-expand"
                                          sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            bgcolor: 'rgba(0,0,0,0.35)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: 0,
                                            transition: 'opacity 0.15s ease',
                                          }}
                                        >
                                          <Expand size={16} color="white" />
                                        </Box>
                                      </>
                                    ) : (
                                      <Package size={20} style={{ color: 'var(--text-muted)' }} />
                                    )}
                                  </Box>
                                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Typography sx={{
                                      fontSize: '0.82rem',
                                      fontWeight: 700,
                                      color: 'var(--foreground)',
                                      lineHeight: 1.3,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {itemName}
                                    </Typography>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                                      {item.size && (
                                        <Box sx={{ 
                                          px: 0.8, py: 0.2, borderRadius: '5px', 
                                          bgcolor: 'rgba(0,113,227,0.12)', 
                                          fontSize: '0.68rem', fontWeight: 600, color: 'var(--secondary)' 
                                        }}>
                                          {item.size}
                                        </Box>
                                      )}
                                      <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        ×{itemQty}
                                      </Typography>
                                      {itemIsLongSleeve && (
                                        <Box sx={{ px: 0.8, py: 0.2, borderRadius: '5px', bgcolor: 'rgba(245,158,11,0.12)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--warning)' }}>
                                          {t.common.longSleeve}
                                        </Box>
                                      )}
                                      {itemCustomName && (
                                        <Box sx={{ px: 0.8, py: 0.2, borderRadius: '5px', bgcolor: 'rgba(16,185,129,0.12)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--success)' }}>
                                          {itemCustomName}
                                        </Box>
                                      )}
                                      {itemCustomNumber && (
                                        <Box sx={{ px: 0.8, py: 0.2, borderRadius: '5px', bgcolor: 'rgba(236,72,153,0.12)', fontSize: '0.65rem', fontWeight: 600, color: '#ec4899' }}>
                                          #{itemCustomNumber}
                                        </Box>
                                      )}
                                    </Box>
                                    
                                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)', mt: 'auto' }}>
                                      ฿{itemSubtotal.toLocaleString()}
                                    </Typography>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}

                      {/* ── Section: Shipping / Pickup ── */}
                      {/* QR Code for Pickup */}
                      {['READY', 'SHIPPED', 'PAID'].includes(statusKey) && !order.trackingNumber && 
                       ((!order.shippingOption && !order.shippingFee) || order.shippingOption === 'pickup' || order.shippingOption?.toLowerCase().includes('รับ')) && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t.orderHistory.pickupSection}
                            </Typography>
                          </Box>
                          <Box sx={{
                            p: 1.5,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(16,185,129,0.08) 100%)',
                            border: '1px solid rgba(6,182,212,0.2)',
                          }}>
                            {(() => {
                              const productIds = orderItems.map((item: any) => item.productId || item.id).filter(Boolean);
                              const productsWithPickup = config?.products?.filter(
                                (p) => p.pickup?.enabled && productIds.includes(p.id)
                              ) || [];
                              if (productsWithPickup.length === 0) return null;
                              const uniqueLocations = [...new Set(productsWithPickup.map(p => p.pickup?.location).filter(Boolean))];
                              return (
                                <Box sx={{ mb: 1.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                    <MapPin size={14} style={{ color: 'var(--success)' }} />
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>{t.orderHistory.pickupLocation}</Typography>
                                  </Box>
                                  {uniqueLocations.map((loc, locIdx) => (
                                    <Typography key={locIdx} sx={{ fontSize: '0.82rem', color: 'var(--foreground)', fontWeight: 600 }}>{loc}</Typography>
                                  ))}
                                  {productsWithPickup[0]?.pickup && (productsWithPickup[0].pickup.startDate || productsWithPickup[0].pickup.endDate) && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.8 }}>
                                      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {productsWithPickup[0].pickup.startDate && new Date(productsWithPickup[0].pickup.startDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {productsWithPickup[0].pickup.startDate && productsWithPickup[0].pickup.endDate && ' - '}
                                        {productsWithPickup[0].pickup.endDate && new Date(productsWithPickup[0].pickup.endDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </Typography>
                                    </Box>
                                  )}
                                  {productsWithPickup[0]?.pickup?.notes && (
                                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--warning)', mt: 0.5 }}>{productsWithPickup[0].pickup.notes}</Typography>
                                  )}
                                </Box>
                              );
                            })()}
                            
                            <Button
                              fullWidth
                              onClick={() => onShowQR(order.ref)}
                              sx={{
                                py: 1.2,
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #64d2ff 0%, #34c759 100%)',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.8,
                                boxShadow: '0 3px 10px rgba(6,182,212,0.25)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #0891b2 0%, #34c759 100%)',
                                },
                              }}
                            >
                              <Package size={18} />
                              {t.orderHistory.showQR}
                            </Button>
                          </Box>
                        </Box>
                      )}

                      {/* Delivery Status - Preparing to ship */}
                      {['READY', 'PAID'].includes(statusKey) && !order.trackingNumber && 
                       ((order.shippingOption && order.shippingOption !== 'pickup' && !order.shippingOption.toLowerCase().includes('รับ')) || 
                        (!order.shippingOption && order.shippingFee && order.shippingFee > 0)) && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                            <Truck size={14} style={{ color: 'var(--text-muted)' }} />
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t.orderHistory.shippingSection}
                            </Typography>
                          </Box>
                          <Box sx={{
                            p: 1.5,
                            borderRadius: '12px',
                            bgcolor: 'rgba(0,113,227,0.06)',
                            border: '1px solid rgba(0,113,227,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                          }}>
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}>
                              <Truck size={18} color="#fff" />
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--secondary)' }}>
                                {t.orderHistory.preparingShipment}
                              </Typography>
                              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {t.orderHistory.preparingShipmentDesc}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )}

                      {/* Tracking Info */}
                      {order.trackingNumber && order.shippingProvider && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                            <Truck size={14} style={{ color: 'var(--text-muted)' }} />
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t.orderHistory.trackPackage}
                            </Typography>
                          </Box>
                          <TrackingTimeline
                            trackingNumber={order.trackingNumber}
                            shippingProvider={order.shippingProvider as ShippingProvider}
                            compact
                          />
                        </Box>
                      )}

                      {/* ── Section: Total & Actions ── */}
                      <Box sx={{
                        px: { xs: 1.5, sm: 2 },
                        py: 1.5,
                        mt: 1,
                        borderTop: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)', mb: 0.1 }}>{t.orderHistory.totalAmount}</Typography>
                          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)' }}>
                            ฿{order.total?.toLocaleString() || '0'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
                          {canCancel && (
                            <Button
                              size="small"
                              onClick={() => onCancelOrder(order.ref)}
                              disabled={cancellingRef === order.ref}
                              sx={{
                                px: 1.5,
                                py: 0.6,
                                borderRadius: '8px',
                                bgcolor: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                color: 'var(--error)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                minWidth: 'auto',
                                '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' },
                                '&:disabled': { color: 'var(--text-muted)', borderColor: 'rgba(100,116,139,0.2)' },
                              }}
                            >
                              {cancellingRef === order.ref ? t.orderHistory.cancelling : t.orderHistory.cancelOrder}
                            </Button>
                          )}
                          {canRequestRefund && (
                            <Button
                              size="small"
                              onClick={() => openRefundDialog(order.ref, order.total || 0)}
                              sx={{
                                px: 1.5,
                                py: 0.6,
                                borderRadius: '8px',
                                bgcolor: 'rgba(124,58,237,0.08)',
                                border: '1px solid rgba(124,58,237,0.2)',
                                color: '#8b5cf6',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                minWidth: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': { bgcolor: 'rgba(124,58,237,0.15)' },
                              }}
                            >
                              <RotateCcw size={12} />
                              {t.orderHistory.requestRefund}
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* Load More */}
            {historyHasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <Button
                  onClick={onLoadMore}
                  disabled={loadingHistoryMore}
                  sx={{
                    px: 4,
                    py: 1,
                    borderRadius: '12px',
                    bgcolor: 'rgba(0,113,227,0.1)',
                    border: '1px solid rgba(0,113,227,0.3)',
                    color: 'var(--secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(0,113,227,0.2)' },
                    '&:disabled': { color: 'var(--text-muted)' },
                  }}
                >
                  {loadingHistoryMore ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} sx={{ color: 'var(--secondary)' }} />
                      {t.orderHistory.loadingMore}
                    </Box>
                  ) : (
                    t.orderHistory.loadMore
                  )}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Bottom */}
      <Box sx={{
        px: { xs: 2, sm: 3 },
        py: 1.5,
        borderTop: '1px solid var(--glass-border)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <Button
          fullWidth
          onClick={onClose}
          sx={{
            py: 1.3,
            borderRadius: '12px',
            bgcolor: 'var(--glass-bg)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { bgcolor: 'var(--glass-bg)' },
          }}
        >
          {t.common.close}
        </Button>
      </Box>

      {/* Refund Request Dialog */}
      <Dialog
        open={refundDialogOpen}
        onClose={() => !refundSubmitting && setRefundDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            backgroundImage: 'none',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
          },
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 700,
          fontSize: '1.05rem',
          borderBottom: '1px solid var(--glass-border)',
          pb: 1.5,
        }}>
          <RotateCcw size={20} style={{ color: '#bf5af2' }} />
          {t.orderHistory.refundTitle}
          <Typography sx={{ ml: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {refundOrderRef}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Reason */}
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: 'var(--foreground)' }}>
              {t.orderHistory.refundReason}
            </Typography>
            <Select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value as string)}
              fullWidth
              size="small"
              displayEmpty
              sx={{
                borderRadius: '10px',
                fontSize: '0.85rem',
                color: 'var(--foreground)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--glass-border)' },
                '& .MuiSelect-icon': { color: 'var(--text-muted)' },
              }}
            >
              <MenuItem value="" disabled>{t.orderHistory.selectReason}</MenuItem>
              {refundReasons.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* Details */}
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: 'var(--foreground)' }}>
              {t.orderHistory.additionalDetails}
            </Typography>
            <TextField
              value={refundDetails}
              onChange={(e) => setRefundDetails(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder={t.orderHistory.detailsPlaceholder}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  color: 'var(--foreground)',
                  '& fieldset': { borderColor: 'var(--glass-border)' },
                  '& input::placeholder, & textarea::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                },
              }}
            />
          </Box>

          {/* Refund Amount */}
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: 'var(--foreground)' }}>
              {t.orderHistory.refundAmount}
            </Typography>
            <TextField
              value={refundAmount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '');
                if (Number(v) <= refundOrderTotal) setRefundAmount(v);
              }}
              fullWidth
              size="small"
              type="text"
              inputMode="decimal"
              placeholder={`${t.orderHistory.maxAmount} ฿${refundOrderTotal.toLocaleString()}`}
              helperText={`${t.orderHistory.orderTotal} ฿${refundOrderTotal.toLocaleString()}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  color: 'var(--foreground)',
                  '& fieldset': { borderColor: 'var(--glass-border)' },
                  '& input::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                },
              }}
            />
          </Box>

          {/* Bank Info */}
          <Box sx={{
            p: 2,
            borderRadius: '12px',
            bgcolor: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.2)',
          }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, mb: 1.5, color: '#bf5af2' }}>
              {t.orderHistory.bankInfo}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.3, color: 'var(--foreground)' }}>{t.orderHistory.bankName}</Typography>
                <Select
                  value={refundBankName}
                  onChange={(e) => setRefundBankName(e.target.value as string)}
                  fullWidth
                  size="small"
                  displayEmpty
                  sx={{
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    color: 'var(--foreground)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--glass-border)' },
                    '& .MuiSelect-icon': { color: 'var(--text-muted)' },
                  }}
                >
                  <MenuItem value="" disabled>{t.orderHistory.selectBank}</MenuItem>
                  {refundBanks.map((b) => (
                    <MenuItem key={b} value={b}>{b}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.3, color: 'var(--foreground)' }}>
                  {refundBankName === promptPayLabel ? t.orderHistory.promptPayNumber : t.orderHistory.accountNumber}
                </Typography>
                <TextField
                  value={refundBankAccount}
                  onChange={(e) => setRefundBankAccount(e.target.value.replace(/[^0-9-]/g, ''))}
                  fullWidth
                  size="small"
                  placeholder={refundBankName === promptPayLabel ? t.orderHistory.promptPayHint : t.orderHistory.accountHint}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      color: 'var(--foreground)',
                      '& fieldset': { borderColor: 'var(--glass-border)' },
                      '& input::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.3, color: 'var(--foreground)' }}>{t.orderHistory.accountOwner}</Typography>
                <TextField
                  value={refundAccountName}
                  onChange={(e) => setRefundAccountName(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder={t.orderHistory.accountOwnerHint}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      color: 'var(--foreground)',
                      '& fieldset': { borderColor: 'var(--glass-border)' },
                      '& input::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--glass-border)', gap: 1 }}>
          <Button
            onClick={() => setRefundDialogOpen(false)}
            disabled={refundSubmitting}
            sx={{
              px: 3,
              borderRadius: '10px',
              color: 'var(--text-muted)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSubmitRefund}
            disabled={refundSubmitting || !refundReason || !refundBankName || !refundBankAccount || !refundAccountName || !refundAmount}
            sx={{
              px: 3,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #bf5af2 0%, #6d28d9 100%)',
              color: 'white',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)',
              },
              '&:disabled': {
                background: 'rgba(100,116,139,0.2)',
                color: 'rgba(100,116,139,0.5)',
              },
            }}
          >
            {refundSubmitting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} sx={{ color: 'white' }} />
                {t.orderHistory.submitting}
              </Box>
            ) : (
              t.orderHistory.submitRefund
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
