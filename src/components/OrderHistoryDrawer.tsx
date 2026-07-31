/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { apiFetch, uploadImageApi } from '@/lib/api-client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
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
  useMediaQuery,
} from '@mui/material';
import {
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Expand,
  ExternalLink,
  Info,
  MapPin,
  Package,
  FileText,
  RotateCcw,
  ShoppingBag,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import {
  refundLineAmount,
  type RefundPayoutMethod,
  type RefundSelectedItem,
} from '@/lib/refund-details';
import { 
  normalizeStatus, 
  getStatusLabel, 
  getStatusCategory,
  PAYABLE_STATUSES,
  CANCELABLE_STATUSES,
  REFUNDABLE_STATUSES,
  isOrderPaidForReceipt,
  type OrderHistory,
} from '@/lib/shop-constants';
import { ShopConfig, getProductName, type Product } from '@/lib/config';
import { SHIPPING_PROVIDERS, getTrackingUrl, getTrack123Url, type ShippingProvider } from '@/lib/shipping';
import TrackingTimeline from './TrackingTimeline';
import { useNotification } from './NotificationContext';
import { CountdownBadge, isOrderExpired } from './OrderCountdown';
import { useTranslation } from '@/hooks/useTranslation';
import { useCartStore } from '@/store/cartStore';
import type { CartItem } from '@/store/cartStore';
import {
  evaluateReorderItem,
  pickPrimaryReorderBlockReason,
  reorderBlockLabel,
  type ReorderBlockReason,
} from '@/lib/reorder-availability';

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
  onRefundRequested?: (ref: string) => void;
  /** Close drawer and scroll/focus the storefront shop section */
  onBrowseShop?: () => void;
}

const historyFilters: HistoryFilter[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'WAITING_PAYMENT', label: 'รอชำระ' },
  { key: 'SHIPPED', label: 'กำลังจัดส่ง' },
  { key: 'RECEIVED', label: 'รับแล้ว' },
  { key: 'COMPLETED', label: 'สำเร็จ' },
  { key: 'CANCELLED', label: 'ยกเลิก' },
];

/** Soft status badge — avoid loud red on cancelled / flashy blue pills */
function softStatusTone(category: string): { bg: string; color: string; border: string; bar: string } {
  switch (category) {
    case 'WAITING_PAYMENT':
      return {
        bg: 'rgba(245,158,11,0.12)',
        color: '#d97706',
        border: 'rgba(245,158,11,0.28)',
        bar: '#f59e0b',
      };
    case 'SHIPPED':
    case 'RECEIVED':
    case 'COMPLETED':
      return {
        bg: 'rgba(16,185,129,0.12)',
        color: '#059669',
        border: 'rgba(16,185,129,0.28)',
        bar: '#10b981',
      };
    case 'CANCELLED':
      return {
        bg: 'rgba(148,163,184,0.12)',
        color: '#94a3b8',
        border: 'rgba(148,163,184,0.28)',
        bar: '#94a3b8',
      };
    default:
      return {
        bg: 'rgba(100,116,139,0.1)',
        color: 'var(--text-muted)',
        border: 'var(--glass-border)',
        bar: '#64748b',
      };
  }
}

// Number of orders rendered per chunk (progressive rendering)
const ORDERS_PER_CHUNK = 8;

/** Soft bone using storefront `.skeleton` shimmer (matches ShopLoadingShell) */
function Bone({
  width,
  height,
  radius = 8,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Box
      className={className ? `skeleton ${className}` : 'skeleton'}
      sx={{
        width: width ?? '100%',
        height: height ?? 14,
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/**
 * Skeleton mirroring the collapsed order card:
 * accent bar → ref + status → date → product preview → net total → actions
 */
function OrderCardSkeleton({
  index = 0,
  showActions = true,
}: {
  index?: number;
  showActions?: boolean;
}) {
  const stagger = `${Math.min(index, 5) * 90}ms`;
  const refW = [42, 48, 36, 52, 40][index % 5];
  const badgeW = [72, 84, 64, 78, 70][index % 5];
  const nameW = ['72%', '64%', '78%', '58%', '68%'][index % 5];
  const metaW = ['44%', '38%', '50%', '42%', '46%'][index % 5];

  return (
    <Box
      aria-hidden
      sx={{
        borderRadius: '16px',
        bgcolor: 'var(--surface-2)',
        border: '1px solid var(--glass-border)',
        overflow: 'hidden',
        opacity: 0,
        animation: 'order-skel-in 0.45s ease forwards',
        animationDelay: stagger,
      }}
    >
      {/* Status accent — muted, no fake color */}
      <Bone height={3} radius={0} style={{ opacity: 0.55 }} />

      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        {/* Ref + status badge */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
          <Bone width={refW} height={18} radius={6} />
          <Bone width={badgeW} height={24} radius={8} />
        </Box>

        {/* Date · pieces + chevron */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
          <Bone width={metaW} height={12} radius={5} />
          <Bone width={14} height={14} radius={4} />
        </Box>

        {/* Product preview row */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.35,
            pb: 1.35,
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <Bone width={52} height={52} radius={12} />
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.55, pt: 0.15 }}>
            <Bone width={nameW} height={14} radius={5} />
            <Bone width="40%" height={11} radius={4} />
            <Bone width={56} height={14} radius={5} />
          </Box>
        </Box>

        {/* Net total */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 1.2,
            borderBottom: showActions ? '1px solid var(--glass-border)' : 'none',
          }}
        >
          <Bone width={72} height={12} radius={5} />
          <Bone width={64} height={18} radius={6} />
        </Box>

        {/* Action buttons */}
        {showActions && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
            <Bone height={34} radius={11} style={{ flex: 1 }} />
            <Bone height={34} radius={11} style={{ flex: 1 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Vertical list of skeleton cards with staggered entrance */
function OrderListSkeleton({
  count = 4,
  ariaLabel,
}: {
  count?: number;
  ariaLabel?: string;
}) {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 800,
        mx: 'auto',
        width: '100%',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} index={i} showActions={i % 3 !== 2} />
      ))}
    </Box>
  );
}

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
    onRefundRequested,
    onBrowseShop,
  } = props;

  const { success: toastSuccess, error: toastError, warning: toastWarning } = useNotification();
  const { t, lang } = useTranslation();
  const addToCart = useCartStore((s) => s.addToCart);
  const isMobile = useMediaQuery('(max-width:640px)');
  const [openingReceiptRef, setOpeningReceiptRef] = useState<string | null>(null);

  const openReceipt = useCallback((ref: string) => {
    // Open dedicated receipt page (same-origin cookies) — never bare /api/invoice
    // which shows raw JSON {"message":"กรุณาเข้าสู่ระบบ"} on auth miss / popup fallback.
    const url = `/receipt/${encodeURIComponent(ref)}?lang=${lang}`;
    setOpeningReceiptRef(ref);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.assign(url);
    }
    setOpeningReceiptRef(null);
  }, [lang]);

  const getOrderReorderMeta = useCallback((order: OrderHistory) => {
    const items = order.items || order.cart || [];
    const evals = items.map((item) =>
      evaluateReorderItem(item as Record<string, unknown>, config?.products as Product[] | undefined, lang)
    );
    const available = evals.filter((e) => e.ok);
    const blocked = evals.filter((e) => !e.ok);
    const primaryReason = pickPrimaryReorderBlockReason(
      blocked.map((b) => b.reason).filter(Boolean) as ReorderBlockReason[]
    );
    return {
      evals,
      available,
      blocked,
      canAddAny: available.length > 0,
      allBlocked: items.length > 0 && available.length === 0,
      primaryReason,
      buttonLabel: available.length > 0
        ? t.orderHistory.reorder
        : reorderBlockLabel(primaryReason, lang),
    };
  }, [config?.products, lang, t.orderHistory.reorder]);

  const handleReorder = useCallback((order: OrderHistory) => {
    const items = order.items || order.cart || [];
    const evals = items.map((item) =>
      evaluateReorderItem(item as Record<string, unknown>, config?.products as Product[] | undefined, lang)
    );

    let added = 0;
    const skippedNames: string[] = [];

    items.forEach((item, index) => {
      const verdict = evals[index];
      if (!verdict?.ok || !verdict.product) {
        if (verdict?.name) skippedNames.push(verdict.name);
        return;
      }

      const productInfo = verdict.product;
      const qty = verdict.qty;
      const unitPrice =
        item.unitPrice ??
        (item.subtotal && qty ? item.subtotal / qty : undefined) ??
        productInfo.basePrice ??
        0;
      const cartItem: CartItem = {
        id: productInfo.id,
        productId: productInfo.id,
        name: verdict.name,
        type: (productInfo as { type?: CartItem['type'] }).type || 'OTHER',
        category: productInfo.category,
        price: unitPrice,
        qty,
        size: item.size || 'Free Size',
        customName: item.customName || item.options?.customName,
        customNumber: item.customNumber || item.options?.customNumber,
        sleeve: item.isLongSleeve || item.options?.isLongSleeve ? 'LONG' : undefined,
        total: item.subtotal ?? unitPrice * qty,
      };
      addToCart(cartItem);
      added += 1;
    });

    if (added === 0) {
      toastError(t.orderHistory.reorderFailed);
      return;
    }

    toastSuccess(`${t.orderHistory.reorderAdded} (${added})`);
    if (skippedNames.length > 0) {
      const preview = skippedNames.slice(0, 2).join(', ');
      const more = skippedNames.length > 2 ? ` +${skippedNames.length - 2}` : '';
      toastWarning(
        t.orderHistory.reorderSkipped,
        `${preview}${more} — ${t.orderHistory.reorderSkippedItem}`
      );
    }
    onClose();
  }, [addToCart, config?.products, lang, onClose, t.orderHistory, toastError, toastSuccess, toastWarning]);

  const openTracking = useCallback((order: OrderHistory) => {
    if (order.trackingNumber) {
      const provider = (order.shippingProvider || 'custom') as ShippingProvider;
      const url =
        getTrackingUrl(provider, order.trackingNumber) ||
        getTrack123Url(order.trackingNumber);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.add(order.ref);
      return next;
    });
  }, []);

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
  const [refundOrderItems, setRefundOrderItems] = React.useState<OrderHistory['items']>([]);
  const [refundSelectedIndexes, setRefundSelectedIndexes] = React.useState<Set<number>>(new Set());
  const [refundReason, setRefundReason] = React.useState('');
  const [refundDetails, setRefundDetails] = React.useState('');
  const [refundPayoutMethod, setRefundPayoutMethod] = React.useState<RefundPayoutMethod>('promptpay');
  const [refundBankName, setRefundBankName] = React.useState('');
  const [refundBankAccount, setRefundBankAccount] = React.useState('');
  const [refundAccountName, setRefundAccountName] = React.useState('');
  const [refundEvidenceUrls, setRefundEvidenceUrls] = React.useState<string[]>([]);
  const [refundEvidenceUploading, setRefundEvidenceUploading] = React.useState(false);
  const [refundSubmitting, setRefundSubmitting] = React.useState(false);
  const [requestedRefundRefs, setRequestedRefundRefs] = React.useState<Set<string>>(new Set());
  const refundEvidenceInputRef = React.useRef<HTMLInputElement>(null);
  const refundReasons = React.useMemo(() => [
    t.orderHistory.reason_damaged,
    t.orderHistory.reason_wrong,
    t.orderHistory.reason_cantAttend,
    t.orderHistory.reason_changed,
    t.orderHistory.reason_other,
  ], [t]);
  const promptPayLabel = t.bankNames[12];
  const refundBanks = React.useMemo(
    () => t.bankNames.filter((b) => b !== promptPayLabel),
    [t, promptPayLabel]
  );

  const refundComputedAmount = React.useMemo(() => {
    const items = refundOrderItems || [];
    if (items.length === 0) return refundOrderTotal;
    const selected = items.filter((_, i) => refundSelectedIndexes.has(i));
    if (selected.length === 0) return 0;
    const itemsSum = selected.reduce(
      (sum, item) => sum + refundLineAmount(item as Record<string, unknown>),
      0
    );
    const allSelected = selected.length === items.length;
    if (allSelected && refundOrderTotal > 0) return refundOrderTotal;
    return Math.min(itemsSum, refundOrderTotal || itemsSum);
  }, [refundOrderItems, refundSelectedIndexes, refundOrderTotal]);

  const refundSelectedPayload = React.useMemo((): RefundSelectedItem[] => {
    const items = refundOrderItems || [];
    return items
      .map((item, index) => {
        if (!refundSelectedIndexes.has(index)) return null;
        const productInfo = item.productId
          ? config?.products?.find((p) => p.id === item.productId)
          : null;
        const name =
          (productInfo ? getProductName(productInfo, lang) : null) ||
          item.name ||
          item.productName ||
          t.orderHistory.unknownProduct;
        return {
          index,
          name,
          size: item.size || undefined,
          qty: Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1),
          amount: refundLineAmount(item as Record<string, unknown>),
        };
      })
      .filter(Boolean) as RefundSelectedItem[];
  }, [refundOrderItems, refundSelectedIndexes, config?.products, lang, t.orderHistory.unknownProduct]);

  const openRefundDialog = (order: OrderHistory) => {
    const items = order.items || order.cart || [];
    const total = order.total || 0;
    setRefundOrderRef(order.ref);
    setRefundOrderTotal(total);
    setRefundOrderItems(items);
    setRefundSelectedIndexes(new Set(items.map((_, i) => i)));
    setRefundReason('');
    setRefundDetails('');
    setRefundPayoutMethod('promptpay');
    setRefundBankName('');
    setRefundBankAccount('');
    setRefundAccountName('');
    setRefundEvidenceUrls([]);
    setRefundDialogOpen(true);
  };

  const toggleRefundItem = (index: number) => {
    setRefundSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        if (next.size <= 1) return prev;
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleRefundEvidenceSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 3 - refundEvidenceUrls.length;
    if (remaining <= 0) {
      toastError(t.orderHistory.evidenceMax);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    setRefundEvidenceUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 5 * 1024 * 1024) {
          toastError(t.orderHistory.evidenceTooLarge);
          continue;
        }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(file);
        });
        const res = await uploadImageApi({
          base64,
          filename: file.name,
          mime: file.type,
        });
        const json = await res.json();
        if (json.status === 'success' && json.data?.url) {
          uploaded.push(json.data.url);
        } else {
          toastError(json.message || t.orderHistory.evidenceUploadFailed);
        }
      }
      if (uploaded.length > 0) {
        setRefundEvidenceUrls((prev) => [...prev, ...uploaded].slice(0, 3));
      }
    } catch {
      toastError(t.orderHistory.evidenceUploadFailed);
    } finally {
      setRefundEvidenceUploading(false);
      if (refundEvidenceInputRef.current) refundEvidenceInputRef.current.value = '';
    }
  };

  const handleSubmitRefund = async () => {
    const accountOk = Boolean(refundBankAccount.trim() && refundAccountName.trim());
    const bankOk = refundPayoutMethod === 'promptpay' || Boolean(refundBankName);
    if (!refundReason || !accountOk || !bankOk || refundSelectedPayload.length === 0 || refundComputedAmount <= 0) {
      return;
    }
    if (refundPayoutMethod === 'promptpay') {
      const digits = refundBankAccount.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        toastError(t.orderHistory.promptPayInvalid);
        return;
      }
    }
    setRefundSubmitting(true);
    try {
      const res = await apiFetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: refundOrderRef,
          reason: refundReason,
          details: refundDetails,
          bankName: refundPayoutMethod === 'promptpay' ? promptPayLabel : refundBankName,
          bankAccount: refundBankAccount.replace(/\D/g, ''),
          accountName: refundAccountName.trim(),
          amount: refundComputedAmount,
          payoutMethod: refundPayoutMethod,
          evidenceUrls: refundEvidenceUrls,
          items: refundSelectedPayload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRefundDialogOpen(false);
        toastSuccess(t.orderHistory.refundSuccess);
        setRequestedRefundRefs((prev) => {
          const next = new Set(prev);
          next.add(refundOrderRef);
          return next;
        });
        if (onRefundRequested) {
          onRefundRequested(refundOrderRef);
        }
      } else {
        toastError(data.error || t.orderHistory.refundError);
      }
    } catch {
      toastError(t.orderHistory.refundRequestError);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const refundFormValid =
    Boolean(refundReason) &&
    Boolean(refundBankAccount.trim()) &&
    Boolean(refundAccountName.trim()) &&
    (refundPayoutMethod === 'promptpay' || Boolean(refundBankName)) &&
    refundSelectedPayload.length > 0 &&
    refundComputedAmount > 0;

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

  // Progressive rendering: only mount a chunk of order cards at a time so the
  // drawer opens instantly even with a long history; more cards render as the
  // user scrolls near the bottom (and remote pages auto-load via onLoadMore)
  const [visibleCount, setVisibleCount] = useState(ORDERS_PER_CHUNK);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreLockRef = useRef(false);

  // Reset chunk size when the drawer reopens or the filter changes
  useEffect(() => {
    setVisibleCount(ORDERS_PER_CHUNK);
    loadingMoreLockRef.current = false;
  }, [open, historyFilter]);

  const visibleOrders = React.useMemo(
    () => filteredOrders.slice(0, visibleCount),
    [filteredOrders, visibleCount]
  );
  const hasLocalMore = visibleCount < filteredOrders.length;

  // Keep latest values in refs so the observer callback stays current
  const loadStateRef = useRef({ hasLocalMore, historyHasMore, loadingHistoryMore, onLoadMore });
  loadStateRef.current = { hasLocalMore, historyHasMore, loadingHistoryMore, onLoadMore };

  useEffect(() => {
    if (!open || loadingHistory) return;

    let observer: IntersectionObserver | null = null;
    let cancelled = false;
    let raf = 0;

    const attach = () => {
      if (cancelled) return;
      const sentinel = sentinelRef.current;
      const root = scrollContainerRef.current;
      if (!sentinel || !root) {
        raf = requestAnimationFrame(attach);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          const state = loadStateRef.current;
          if (state.hasLocalMore) {
            setVisibleCount((c) => c + ORDERS_PER_CHUNK);
            return;
          }
          if (state.historyHasMore && !state.loadingHistoryMore && !loadingMoreLockRef.current) {
            loadingMoreLockRef.current = true;
            state.onLoadMore();
          }
        },
        { root, rootMargin: '280px 0px', threshold: 0 }
      );
      observer.observe(sentinel);
    };

    attach();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [open, loadingHistory, filteredOrders.length, visibleCount, historyHasMore, loadingHistoryMore]);

  // Release load-more lock when the remote page finishes
  useEffect(() => {
    if (!loadingHistoryMore) loadingMoreLockRef.current = false;
  }, [loadingHistoryMore]);

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
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: isMobile ? { xs: '92vh', sm: '85vh' } : '100vh',
          maxHeight: isMobile ? '92vh' : '100vh',
          width: isMobile ? '100%' : '520px',
          borderTopLeftRadius: isMobile ? { xs: 20, sm: 24 } : { xs: 0, sm: 24 },
          borderTopRightRadius: isMobile ? { xs: 20, sm: 24 } : 0,
          borderBottomLeftRadius: isMobile ? 0 : { xs: 0, sm: 24 },
          bgcolor: 'var(--background)',
          color: 'var(--foreground)',
          overflow: 'hidden',
          transform: isMobile && dragOffset > 0 ? `translateY(${dragOffset}px) !important` : undefined,
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
        {isMobile && (
          <Box
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
            sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.5, cursor: 'grab', touchAction: 'none' }}
          >
            <Box sx={{ width: isDragging ? 48 : 36, height: 4, bgcolor: isDragging ? 'var(--text-muted)' : 'var(--glass-bg)', borderRadius: 2, transition: 'all 0.2s ease' }} />
          </Box>
        )}
        
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

        {/* Filter Tabs — muted segmented control */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.4,
            p: 0.45,
            borderRadius: '14px',
            bgcolor: 'var(--surface)',
            border: '1px solid var(--glass-border)',
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {historyFilters.map((filter) => {
            const isActive = historyFilter === filter.key;
            const count = filterCounts[filter.key] ?? 0;
            const isCancelled = filter.key === 'CANCELLED';
            const showCount = filter.key === 'ALL' || count > 0;
            return (
              <Box
                key={filter.key}
                onClick={() => onFilterChange(filter.key as any)}
                sx={{
                  px: 1.4,
                  py: 0.7,
                  borderRadius: '10px',
                  bgcolor: isActive ? 'var(--surface-2)' : 'transparent',
                  border: isActive ? '1px solid var(--glass-border)' : '1px solid transparent',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  color: isActive
                    ? 'var(--foreground)'
                    : isCancelled
                      ? 'rgba(148,163,184,0.85)'
                      : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.6,
                  flexShrink: 0,
                  '&:hover': {
                    color: 'var(--foreground)',
                    bgcolor: isActive ? 'var(--surface-2)' : 'rgba(100,116,139,0.06)',
                  },
                }}
              >
                {filterLabelMap[filter.key] || filter.label}
                {showCount && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      opacity: isCancelled && !isActive ? 0.55 : isActive ? 0.85 : 0.65,
                      color: 'inherit',
                      minWidth: 14,
                      textAlign: 'center',
                    }}
                  >
                    {count}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Content */}
      <Box ref={scrollContainerRef} sx={{
        flex: 1,
        overflow: 'auto',
        px: { xs: 1.5, sm: 2.5 },
        py: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {loadingHistory ? (
          <OrderListSkeleton count={4} ariaLabel={t.orderHistory.loading} />
        ) : filteredOrders.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2, px: 2 }}>
            <Box sx={{
              width: 88,
              height: 88,
              borderRadius: '22px',
              bgcolor: 'rgba(100,116,139,0.08)',
              border: '1px dashed var(--glass-border)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Package size={36} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
            </Box>
            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.98rem', fontWeight: 700, textAlign: 'center' }}>
              {t.orderHistory.empty}
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              {historyFilter === 'ALL' ? t.orderHistory.noOrders : t.orderHistory.tryFilter}
            </Typography>
            <Button
              onClick={() => {
                onClose();
                onBrowseShop?.();
              }}
              startIcon={<ShoppingBag size={16} />}
              sx={{
                mt: 1,
                px: 2.5,
                py: 1,
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: 'var(--foreground)',
                color: 'var(--background)',
                '&:hover': { opacity: 0.9, bgcolor: 'var(--foreground)' },
              }}
            >
              {t.orderHistory.goShop}
            </Button>
          </Box>
        ) : (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxWidth: 800,
            mx: 'auto',
            width: '100%',
          }}>
            {visibleOrders.map((order, idx) => {
              const statusKey = normalizeStatus(order.status);
              const statusLabel = getStatusLabel(statusKey, lang);
              const canCancel = CANCELABLE_STATUSES.includes(statusKey);
              const canPay = isShopOpen && PAYABLE_STATUSES.includes(statusKey);
              const orderDateStr = order.receiptIssuedAt || order.paymentVerifiedAt || order.date;
              const referenceDate = orderDateStr ? new Date(orderDateStr) : null;
              const isWithin5Days = referenceDate ? (new Date().getTime() - referenceDate.getTime()) <= 5 * 24 * 60 * 60 * 1000 : false;
              const tempRefundStatus = order.refundStatus || (requestedRefundRefs.has(order.ref) ? 'REQUESTED' : null);
              const canRequestRefund = REFUNDABLE_STATUSES.includes(statusKey) && isWithin5Days && !tempRefundStatus;
              const hasRequestedRefund = !!tempRefundStatus;
              const canViewReceipt = isOrderPaidForReceipt(order);
              const category = getStatusCategory(statusKey);
              const statusTone = softStatusTone(category);
              const isExpanded = expandedOrders.has(order.ref);
              const orderItems = order.items || order.cart || [];
              const totalItems = orderItems.reduce((sum: number, item: any) => sum + (item.qty || item.quantity || 1), 0);
              const firstItem = orderItems[0];
              const firstProductInfo = firstItem
                ? config?.products?.find((p) => p.id === firstItem.productId)
                : null;
              const firstProductImage =
                firstProductInfo?.coverImage || firstProductInfo?.images?.[0] || null;
              const firstItemName =
                (firstProductInfo ? getProductName(firstProductInfo, lang) : null) ||
                firstItem?.name ||
                firstItem?.productName ||
                firstProductInfo?.name ||
                t.orderHistory.unknownProduct;
              const firstItemQty = firstItem?.qty || firstItem?.quantity || 1;
              const firstItemOption = firstItem?.size
                ? `${firstItem.size} × ${firstItemQty}`
                : `${firstItemQty} ${t.common.pieces}`;
              const firstItemPrice =
                firstItem?.subtotal ??
                (firstItem?.unitPrice ? firstItem.unitPrice * firstItemQty : undefined) ??
                order.total;
              const canReorderCategory =
                category === 'CANCELLED' ||
                category === 'RECEIVED' ||
                category === 'COMPLETED' ||
                category === 'SHIPPED';
              const reorderMeta = canReorderCategory ? getOrderReorderMeta(order) : null;
              const canReorder = Boolean(canReorderCategory);
              const canTrack =
                Boolean(order.trackingNumber) ||
                category === 'SHIPPED' ||
                (['READY', 'PAID'].includes(statusKey) &&
                  ((order.shippingOption &&
                    order.shippingOption !== 'pickup' &&
                    !order.shippingOption.toLowerCase().includes('รับ')) ||
                    (!order.shippingOption && order.shippingFee && order.shippingFee > 0)));

              const getStatusIcon = () => {
                if (category === 'WAITING_PAYMENT') return <Clock size={14} />;
                if (category === 'COMPLETED') return <CheckCircle size={14} />;
                if (category === 'SHIPPED') return <Truck size={14} />;
                if (category === 'RECEIVED') return <Package size={14} />;
                if (category === 'CANCELLED') return <XCircle size={14} />;
                return <span>•</span>;
              };

              const actionBtnSx = {
                px: 1.6,
                py: 0.85,
                borderRadius: '11px',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'none' as const,
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap' as const,
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
                  <Box sx={{ height: 3, background: statusTone.bar, opacity: 0.9 }} />

                  {/* Order Summary (always visible) */}
                  <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Box
                      onClick={() => toggleExpanded(order.ref)}
                      sx={{
                        cursor: 'pointer',
                        '&:active': { opacity: 0.92 },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.6 }}>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                          #{order.ref}
                        </Typography>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.35,
                          borderRadius: '8px',
                          bgcolor: statusTone.bg,
                          border: `1px solid ${statusTone.border}`,
                          flexShrink: 0,
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', color: statusTone.color }}>{getStatusIcon()}</Box>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: statusTone.color }}>
                            {statusLabel}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                        <Typography sx={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {new Date(order.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' • '}
                          {totalItems} {t.common.pieces}
                        </Typography>
                        {isExpanded ? (
                          <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                        ) : (
                          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </Box>

                      {/* Product preview — always visible */}
                      {firstItem && (
                        <Box sx={{
                          display: 'flex',
                          gap: 1.35,
                          pb: 1.35,
                          borderBottom: '1px solid var(--glass-border)',
                        }}>
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
                          }}>
                            {firstProductImage ? (
                              <Box
                                component="img"
                                src={firstProductImage}
                                alt=""
                                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                loading="lazy"
                              />
                            ) : (
                              <ShoppingBag size={20} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              color: 'var(--foreground)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {firstItemName}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 0.15 }}>
                              {lang === 'en' ? 'Option: ' : 'ตัวเลือก: '}{firstItemOption}
                              {orderItems.length > 1 ? ` · +${orderItems.length - 1}` : ''}
                            </Typography>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', mt: 0.35 }}>
                              ฿{(firstItemPrice ?? 0)?.toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {/* Net total */}
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1.2,
                      borderBottom: '1px solid var(--glass-border)',
                    }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {t.orderHistory.netTotal}
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
                        ฿{order.total?.toLocaleString() || '0'}
                      </Typography>
                    </Box>

                    {canPay && order.date && !isOrderExpired(order.date) && (
                      <Box sx={{ mt: 1.1 }}>
                        <CountdownBadge orderDate={order.date} compact />
                      </Box>
                    )}

                    {/* Footer actions — status-driven */}
                    <Box
                      sx={{ display: 'flex', gap: 1, mt: 1.25, flexWrap: 'wrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canPay && !isOrderExpired(order.date) && (
                        <Button
                          size="small"
                          onClick={() => onOpenPayment(order.ref)}
                          startIcon={<CreditCard size={14} />}
                          sx={{
                            ...actionBtnSx,
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(245,158,11,0.28)',
                            '&:hover': { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
                          }}
                        >
                          {t.orderHistory.attachSlip}
                        </Button>
                      )}
                      {canTrack && (
                        <Button
                          size="small"
                          onClick={() => openTracking(order)}
                          startIcon={<Truck size={14} />}
                          sx={{
                            ...actionBtnSx,
                            bgcolor: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.28)',
                            color: '#059669',
                            '&:hover': { bgcolor: 'rgba(16,185,129,0.18)' },
                          }}
                        >
                          {t.orderHistory.trackPackage}
                        </Button>
                      )}
                      {canReorder && reorderMeta && (
                        <Button
                          size="small"
                          onClick={() => {
                            if (!reorderMeta.canAddAny) return;
                            handleReorder(order);
                          }}
                          disabled={!reorderMeta.canAddAny}
                          startIcon={<RotateCcw size={14} />}
                          title={
                            reorderMeta.allBlocked
                              ? reorderMeta.buttonLabel
                              : reorderMeta.blocked.length > 0
                                ? `${reorderMeta.available.length}/${reorderMeta.evals.length}`
                                : undefined
                          }
                          sx={{
                            ...actionBtnSx,
                            bgcolor: reorderMeta.canAddAny ? 'var(--surface)' : 'rgba(148,163,184,0.12)',
                            border: '1px solid var(--glass-border)',
                            color: reorderMeta.canAddAny ? 'var(--foreground)' : 'var(--text-muted)',
                            opacity: reorderMeta.canAddAny ? 1 : 0.85,
                            cursor: reorderMeta.canAddAny ? 'pointer' : 'not-allowed',
                            '&:hover': reorderMeta.canAddAny
                              ? { bgcolor: 'rgba(100,116,139,0.08)' }
                              : { bgcolor: 'rgba(148,163,184,0.12)' },
                            '&.Mui-disabled': {
                              color: 'var(--text-muted)',
                              bgcolor: 'rgba(148,163,184,0.12)',
                              borderColor: 'var(--glass-border)',
                              opacity: 1,
                            },
                          }}
                        >
                          {reorderMeta.buttonLabel}
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          size="small"
                          onClick={() => onCancelOrder(order.ref)}
                          disabled={cancellingRef === order.ref}
                          sx={{
                            ...actionBtnSx,
                            flex: '0 0 auto',
                            bgcolor: 'rgba(239,68,68,0.06)',
                            border: '1px solid rgba(239,68,68,0.18)',
                            color: 'var(--error)',
                            '&:hover': { bgcolor: 'rgba(239,68,68,0.12)' },
                            '&:disabled': { color: 'var(--text-muted)', borderColor: 'rgba(100,116,139,0.2)' },
                          }}
                        >
                          {cancellingRef === order.ref ? t.orderHistory.cancelling : t.orderHistory.cancelOrder}
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={() => toggleExpanded(order.ref)}
                        sx={{
                          ...actionBtnSx,
                          flex: canPay || canTrack || canReorder ? '0 0 auto' : 1,
                          bgcolor: 'transparent',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--text-muted)',
                          '&:hover': { bgcolor: 'rgba(100,116,139,0.06)', color: 'var(--foreground)' },
                        }}
                      >
                        {isExpanded ? t.orderHistory.hideDetails : t.orderHistory.viewDetails}
                      </Button>
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
                          width: '100%',
                        }}>
                          <Clock size={12} />
                          {t.orderHistory.expiredPayment}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <Box sx={{ borderTop: '1px solid var(--glass-border)' }}>

                      {/* Refund Status Badge */}
                      {tempRefundStatus && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                            px: 1.5,
                            py: 0.7,
                            borderRadius: '10px',
                            bgcolor: tempRefundStatus === 'REJECTED' ? 'rgba(239,68,68,0.08)' :
                                     tempRefundStatus === 'COMPLETED' ? 'rgba(16,185,129,0.08)' :
                                     'rgba(124,58,237,0.08)',
                            border: `1px solid ${
                              tempRefundStatus === 'REJECTED' ? 'rgba(239,68,68,0.2)' :
                              tempRefundStatus === 'COMPLETED' ? 'rgba(16,185,129,0.2)' :
                              'rgba(124,58,237,0.2)'
                            }`,
                          }}>
                            <RotateCcw size={13} style={{
                              color: tempRefundStatus === 'REJECTED' ? 'var(--error)' :
                                     tempRefundStatus === 'COMPLETED' ? 'var(--success)' : '#bf5af2',
                            }} />
                            <Typography sx={{
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              color: tempRefundStatus === 'REJECTED' ? 'var(--error)' :
                                     tempRefundStatus === 'COMPLETED' ? 'var(--success)' : '#bf5af2',
                            }}>
                              {tempRefundStatus === 'REQUESTED' ? t.orderHistory.refundPending :
                               tempRefundStatus === 'APPROVED' ? t.orderHistory.refundApproved :
                               tempRefundStatus === 'COMPLETED' ? t.orderHistory.refundCompleted :
                               tempRefundStatus === 'REJECTED' ? t.orderHistory.refundRejected :
                               t.orderHistory.refundRequest}
                            </Typography>
                            {order.refundAmount && (
                              <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--warning)', ml: 0.5 }}>
                                ฿{order.refundAmount?.toLocaleString()}
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
                              const itemPattern = item.pattern || item.options?.pattern;
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
                                        <Box
                                          component="img"
                                          src={productImage}
                                          alt={itemName}
                                          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                                      {itemPattern && (
                                        <Box sx={{ px: 0.8, py: 0.2, borderRadius: '5px', bgcolor: 'rgba(56,189,248,0.12)', fontSize: '0.65rem', fontWeight: 600, color: '#38bdf8' }}>
                                          {itemPattern}
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
                                      ฿{itemSubtotal?.toLocaleString()}
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

                      {/* Pickup Confirmation - When order has been picked up */}
                      {order.pickup?.pickedUp && (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                            <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {t.orderHistory.pickupSection}
                            </Typography>
                          </Box>
                          <Box sx={{
                            p: 1.5,
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(52,199,89,0.08) 100%)',
                            border: '1px solid rgba(16,185,129,0.25)',
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                              <CheckCircle size={16} style={{ color: '#10b981' }} />
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                                {t.orderHistory.pickupConfirmed}
                              </Typography>
                            </Box>
                            {order.pickup.pickedUpAt && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {new Date(order.pickup.pickedUpAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            )}
                            {order.pickup.notes && (
                              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
                                {t.orderHistory.pickupNotes}: {order.pickup.notes}
                              </Typography>
                            )}
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
                          {(canRequestRefund || hasRequestedRefund) && (
                            <Button
                              size="small"
                              onClick={() => canRequestRefund ? openRefundDialog(order) : null}
                              disabled={hasRequestedRefund}
                              sx={{
                                px: 1.5,
                                py: 0.6,
                                borderRadius: '8px',
                                bgcolor: hasRequestedRefund ? 'rgba(100,116,139,0.08)' : 'rgba(124,58,237,0.08)',
                                border: hasRequestedRefund ? '1px solid rgba(100,116,139,0.2)' : '1px solid rgba(124,58,237,0.2)',
                                color: hasRequestedRefund ? 'var(--text-muted)' : '#8b5cf6',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                minWidth: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': { bgcolor: hasRequestedRefund ? 'rgba(100,116,139,0.08)' : 'rgba(124,58,237,0.15)' },
                                '&:disabled': {
                                  color: 'var(--text-muted)',
                                  borderColor: 'rgba(100,116,139,0.2)',
                                }
                              }}
                            >
                              <RotateCcw size={12} />
                              {hasRequestedRefund ? `ขอคืนเงิน: ${
                                (tempRefundStatus === 'REQUESTED' || tempRefundStatus === 'PENDING') ? 'รอตรวจสอบ' :
                                tempRefundStatus === 'APPROVED' ? 'อนุมัติแล้ว' :
                                tempRefundStatus === 'REJECTED' ? 'ถูกปฏิเสธ' : tempRefundStatus
                              }` : t.orderHistory.requestRefund}
                            </Button>
                          )}
                          {/* Invoice — only after payment confirmed */}
                          {canViewReceipt && (
                            <Button
                              size="small"
                              onClick={() => openReceipt(order.ref)}
                              disabled={openingReceiptRef === order.ref}
                              sx={{
                                px: 1.5,
                                py: 0.6,
                                borderRadius: '8px',
                                bgcolor: 'rgba(0,113,227,0.08)',
                                border: '1px solid rgba(0,113,227,0.2)',
                                color: '#2997ff',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'none',
                                minWidth: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': { bgcolor: 'rgba(0,113,227,0.15)' },
                              }}
                            >
                              {openingReceiptRef === order.ref ? (
                                <CircularProgress size={12} sx={{ color: '#2997ff' }} />
                              ) : (
                                <FileText size={12} />
                              )}
                              {t.invoice?.download || (lang === 'en' ? 'View receipt' : 'ดูใบเสร็จ')}
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* Skeletons while fetching the next remote page */}
            {loadingHistoryMore && (
              <Box
                role="status"
                aria-busy="true"
                aria-label={t.orderHistory.loadingMore}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <OrderCardSkeleton index={0} showActions={false} />
                <OrderCardSkeleton index={1} showActions={false} />
              </Box>
            )}

            {/* Infinite-scroll sentinel — keep in DOM while more local/remote pages exist */}
            {(hasLocalMore || historyHasMore) && (
              <Box
                ref={sentinelRef}
                aria-hidden
                sx={{ height: 24, flexShrink: 0 }}
              />
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
          pr: 1.5,
        }}>
          <RotateCcw size={20} style={{ color: '#8b5cf6' }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--foreground)' }}>
              {t.orderHistory.refundTitle}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 0.15 }}>
              {refundOrderRef}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => !refundSubmitting && setRefundDialogOpen(false)}
            disabled={refundSubmitting}
            sx={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {/* Product selection */}
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, mb: 1, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Package size={14} />
              {t.orderHistory.refundItemsTitle}
            </Typography>
            {(refundOrderItems || []).length === 0 ? (
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t.orderHistory.unknownProduct}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(refundOrderItems || []).map((item, index) => {
                  const productInfo = item.productId
                    ? config?.products?.find((p) => p.id === item.productId)
                    : null;
                  const image = productInfo?.coverImage || productInfo?.images?.[0] || null;
                  const name =
                    (productInfo ? getProductName(productInfo, lang) : null) ||
                    item.name ||
                    item.productName ||
                    t.orderHistory.unknownProduct;
                  const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
                  const lineAmt = refundLineAmount(item as Record<string, unknown>);
                  const checked = refundSelectedIndexes.has(index);
                  const multi = (refundOrderItems || []).length > 1;
                  return (
                    <Box
                      key={`${refundOrderRef}-${index}`}
                      onClick={() => multi && toggleRefundItem(index)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.15,
                        borderRadius: '12px',
                        border: checked ? '1px solid rgba(139,92,246,0.35)' : '1px solid var(--glass-border)',
                        bgcolor: checked ? 'rgba(139,92,246,0.06)' : 'var(--surface-2)',
                        cursor: multi ? 'pointer' : 'default',
                      }}
                    >
                      {multi && (
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleRefundItem(index)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          sx={{ p: 0.25, color: 'var(--text-muted)', '&.Mui-checked': { color: '#8b5cf6' } }}
                        />
                      )}
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '10px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          bgcolor: 'var(--glass-bg)',
                          border: '1px solid var(--glass-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Package size={18} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3 }}>
                          {name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 0.2 }}>
                          {item.size ? `${item.size} × ${qty}` : `${qty} ${t.common.pieces}`}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                        ฿{lineAmt?.toLocaleString()}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
            {(refundOrderItems || []).length > 1 && (
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.85 }}>
                {t.orderHistory.refundItemsHint}
              </Typography>
            )}
            <Box sx={{
              mt: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.25,
              py: 1,
              borderRadius: '10px',
              bgcolor: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                {t.orderHistory.refundAmountAuto}
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669' }}>
                ฿{refundComputedAmount?.toLocaleString()}
              </Typography>
            </Box>
          </Box>

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
              rows={2}
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

          {/* Evidence photos */}
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.75, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Camera size={14} />
              {t.orderHistory.evidenceTitle}
            </Typography>
            <input
              ref={refundEvidenceInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleRefundEvidenceSelect(e.target.files)}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {refundEvidenceUrls.map((url) => (
                <Box
                  key={url}
                  sx={{
                    position: 'relative',
                    width: 72,
                    height: 72,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <IconButton
                    size="small"
                    onClick={() => setRefundEvidenceUrls((prev) => prev.filter((u) => u !== url))}
                    disabled={refundSubmitting || refundEvidenceUploading}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 22,
                      height: 22,
                      bgcolor: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                    }}
                  >
                    <X size={12} />
                  </IconButton>
                </Box>
              ))}
              {refundEvidenceUrls.length < 3 && (
                <Button
                  onClick={() => refundEvidenceInputRef.current?.click()}
                  disabled={refundSubmitting || refundEvidenceUploading}
                  sx={{
                    width: 72,
                    height: 72,
                    minWidth: 72,
                    borderRadius: '10px',
                    border: '1px dashed var(--glass-border)',
                    color: 'var(--text-muted)',
                    textTransform: 'none',
                    fontSize: '0.68rem',
                    flexDirection: 'column',
                    gap: 0.35,
                    bgcolor: 'var(--surface-2)',
                    '&:hover': { bgcolor: 'var(--glass-bg)', borderColor: 'rgba(139,92,246,0.4)' },
                  }}
                >
                  {refundEvidenceUploading ? <CircularProgress size={16} /> : <Camera size={16} />}
                  {t.orderHistory.evidenceAdd}
                </Button>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)', mt: 0.6 }}>
              {t.orderHistory.evidenceHint}
            </Typography>
          </Box>

          {/* Payout method */}
          <Box sx={{
            p: 1.75,
            borderRadius: '12px',
            bgcolor: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, mb: 1.25, color: '#059669', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CreditCard size={14} />
              {t.orderHistory.payoutTitle}
            </Typography>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.75,
              mb: 1.5,
              p: 0.4,
              borderRadius: '10px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
            }}>
              {([
                { key: 'promptpay' as const, label: t.orderHistory.payoutPromptPay },
                { key: 'bank' as const, label: t.orderHistory.payoutBank },
              ]).map((opt) => {
                const active = refundPayoutMethod === opt.key;
                return (
                  <Button
                    key={opt.key}
                    onClick={() => {
                      setRefundPayoutMethod(opt.key);
                      if (opt.key === 'promptpay') setRefundBankName('');
                    }}
                    sx={{
                      py: 0.85,
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      color: active ? '#fff' : 'var(--text-muted)',
                      bgcolor: active ? '#059669' : 'transparent',
                      boxShadow: active ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
                      '&:hover': {
                        bgcolor: active ? '#047857' : 'var(--glass-bg)',
                      },
                    }}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.35 }}>
              {refundPayoutMethod === 'bank' && (
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.3, color: 'var(--foreground)' }}>
                    {t.orderHistory.bankName}
                  </Typography>
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
              )}

              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.3, color: 'var(--foreground)' }}>
                  {refundPayoutMethod === 'promptpay' ? t.orderHistory.promptPayNumber : t.orderHistory.accountNumber}
                </Typography>
                <TextField
                  value={refundBankAccount}
                  onChange={(e) => setRefundBankAccount(e.target.value.replace(/[^0-9-]/g, ''))}
                  fullWidth
                  size="small"
                  placeholder={refundPayoutMethod === 'promptpay' ? t.orderHistory.promptPayHint : t.orderHistory.accountHint}
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
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.3, color: 'var(--foreground)' }}>
                  {t.orderHistory.accountOwner}
                </Typography>
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

          {/* SLA note */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'flex-start',
            p: 1.25,
            borderRadius: '10px',
            bgcolor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.18)',
          }}>
            <Info size={15} style={{ color: '#3b82f6', marginTop: 1, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.72rem', color: 'var(--foreground)', lineHeight: 1.45 }}>
              {t.orderHistory.refundSlaNote}
            </Typography>
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
            disabled={refundSubmitting || refundEvidenceUploading || !refundFormValid}
            sx={{
              px: 3,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
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
              `${t.orderHistory.submitRefund} ฿${refundComputedAmount?.toLocaleString()}`
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
