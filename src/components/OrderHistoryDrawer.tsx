'use client';

import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Clock,
  ExternalLink,
  MapPin,
  Package,
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
  type OrderHistory,
} from '@/lib/shop-constants';
import { ShopConfig } from '@/lib/config';
import { SHIPPING_PROVIDERS, getTrackingUrl, getTrack123Url, type ShippingProvider } from '@/lib/shipping';
import TrackingTimeline from './TrackingTimeline';

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
  } = props;

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
          bgcolor: 'background.default',
          overflow: 'hidden',
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
        {/* Drag Handle */}
        <Box sx={{ width: 36, height: 4, bgcolor: 'var(--glass-bg)', borderRadius: 2, mx: 'auto', mb: 2 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Package size={20} color="white" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'text.primary' }}>
                คำสั่งซื้อของฉัน
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {orderHistory.length} รายการ
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
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
                  bgcolor: isActive ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '1px solid rgba(37,99,235,0.4)' : '1px solid var(--glass-border)',
                  color: isActive ? '#93c5fd' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  '&:hover': {
                    bgcolor: isActive ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                {filter.label}
                <Box sx={{
                  px: 0.8,
                  py: 0.1,
                  borderRadius: '8px',
                  bgcolor: isActive ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.08)',
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
        px: { xs: 2, sm: 3 },
        py: 2,
        WebkitOverflowScrolling: 'touch',
      }}>
        {loadingHistory ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
            <CircularProgress size={36} sx={{ color: '#2563eb' }} />
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>กำลังโหลดคำสั่งซื้อ...</Typography>
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
            <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>ไม่พบคำสั่งซื้อ</Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {historyFilter === 'ALL' ? 'ยังไม่มีคำสั่งซื้อ' : 'ลองเปลี่ยนตัวกรองดู'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filteredOrders.map((order, idx) => {
              const statusKey = normalizeStatus(order.status);
              const statusLabel = getStatusLabel(statusKey);
              const statusColor = getStatusColor(statusKey);
              const canCancel = CANCELABLE_STATUSES.includes(statusKey);
              const canPay = isShopOpen && PAYABLE_STATUSES.includes(statusKey);
              const category = getStatusCategory(statusKey);

              const getStatusIcon = () => {
                if (category === 'WAITING_PAYMENT') return <Clock size={14} />;
                if (category === 'COMPLETED') return <CheckCircle size={14} />;
                if (category === 'RECEIVED') return <Package size={14} />;
                if (category === 'CANCELLED') return <XCircle size={14} />;
                return <span>•</span>;
              };

              return (
                <Box
                  key={order.ref || idx}
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: '18px',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'var(--surface-2)',
                      borderColor: 'var(--glass-border)',
                    },
                  }}
                >
                  {/* Order Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.primary', letterSpacing: '0.02em' }}>
                        #{order.ref}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.3 }}>
                        {new Date(order.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}
                        {' • '}
                        {new Date(order.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.6,
                      px: 1.2,
                      py: 0.4,
                      borderRadius: '8px',
                      bgcolor: `${statusColor}18`,
                      border: `1px solid ${statusColor}30`,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', color: statusColor }}>{getStatusIcon()}</Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>
                        {statusLabel}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Product Items */}
                  {(() => {
                    const orderItems = order.items || order.cart || [];
                    if (orderItems.length === 0) return null;
                    
                    return (
                      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {orderItems.slice(0, 3).map((item: any, itemIdx: number) => {
                          const productInfo = config?.products?.find((p) => p.id === item.productId);
                          const productImage = productInfo?.images?.[0];
                          const itemName = item.name || item.productName || productInfo?.name || 'ไม่ทราบชื่อสินค้า';
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
                                p: 1.5,
                                borderRadius: '14px',
                                bgcolor: 'var(--surface)',
                                border: '1px solid var(--glass-border)',
                              }}
                            >
                              <Box sx={{
                                width: 60,
                                height: 60,
                                borderRadius: '12px',
                                bgcolor: 'var(--surface-2)',
                                backgroundImage: productImage ? `url(${productImage})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--glass-border)',
                              }}>
                                {!productImage && <Package size={20} style={{ color: 'var(--text-muted)' }} />}
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                {/* Product Name */}
                                <Typography sx={{
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                  color: 'text.primary',
                                  lineHeight: 1.3,
                                }}>
                                  {itemName}
                                </Typography>
                                
                                {/* Size & Quantity Row */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {item.size && (
                                    <Box sx={{ 
                                      px: 1, 
                                      py: 0.3, 
                                      borderRadius: '6px', 
                                      bgcolor: 'rgba(37,99,235,0.15)', 
                                      fontSize: '0.72rem', 
                                      fontWeight: 600, 
                                      color: 'var(--secondary)' 
                                    }}>
                                      ไซส์ {item.size}
                                    </Box>
                                  )}
                                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                                    จำนวน {itemQty} ชิ้น
                                  </Typography>
                                </Box>
                                
                                {/* Custom Options Row */}
                                {(itemIsLongSleeve || itemCustomName || itemCustomNumber) && (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                                    {itemIsLongSleeve && (
                                      <Box sx={{ 
                                        px: 0.8, 
                                        py: 0.2, 
                                        borderRadius: '5px', 
                                        bgcolor: 'rgba(245,158,11,0.15)', 
                                        fontSize: '0.68rem', 
                                        fontWeight: 600, 
                                        color: '#fbbf24' 
                                      }}>
                                        แขนยาว
                                      </Box>
                                    )}
                                    {itemCustomName && (
                                      <Box sx={{ 
                                        px: 0.8, 
                                        py: 0.2, 
                                        borderRadius: '5px', 
                                        bgcolor: 'rgba(16,185,129,0.15)', 
                                        fontSize: '0.68rem', 
                                        fontWeight: 600, 
                                        color: '#34d399' 
                                      }}>
                                        ชื่อ: {itemCustomName}
                                      </Box>
                                    )}
                                    {itemCustomNumber && (
                                      <Box sx={{ 
                                        px: 0.8, 
                                        py: 0.2, 
                                        borderRadius: '5px', 
                                        bgcolor: 'rgba(236,72,153,0.15)', 
                                        fontSize: '0.68rem', 
                                        fontWeight: 600, 
                                        color: '#f472b6' 
                                      }}>
                                        เบอร์ #{itemCustomNumber}
                                      </Box>
                                    )}
                                  </Box>
                                )}
                                
                                {/* Price Row */}
                                <Box sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  pt: 0.5,
                                  borderTop: '1px solid var(--glass-border)',
                                }}>
                                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                                    ราคาต่อชิ้น ฿{(itemSubtotal / itemQty).toLocaleString()}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981' }}>
                                    ฿{itemSubtotal.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                        {orderItems.length > 3 && (
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center', py: 0.5 }}>
                            +{orderItems.length - 3} รายการ
                          </Typography>
                        )}
                      </Box>
                    );
                  })()}

                  {/* QR Code for Pickup - Only show when pickup (not delivery) and NOT shipped with tracking */}
                  {['READY', 'SHIPPED', 'PAID'].includes(statusKey) && !order.trackingNumber && 
                   ((!order.shippingOption && !order.shippingFee) || order.shippingOption === 'pickup' || order.shippingOption?.toLowerCase().includes('รับ')) && (
                    <Box sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(16,185,129,0.1) 100%)',
                      border: '1px solid rgba(6,182,212,0.3)',
                    }}>
                      {(() => {
                        const orderItems = order.items || order.cart || [];
                        const productIds = orderItems.map((item: any) => item.productId || item.id).filter(Boolean);
                        const productsWithPickup = config?.products?.filter(
                          (p) => p.pickup?.enabled && productIds.includes(p.id)
                        ) || [];
                        
                        if (productsWithPickup.length === 0) return null;
                        
                        const uniqueLocations = [...new Set(productsWithPickup.map(p => p.pickup?.location).filter(Boolean))];
                        
                        return (
                          <Box sx={{ mb: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'left' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <MapPin size={14} style={{ color: '#10b981' }} />
                              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>สถานที่รับสินค้า</Typography>
                            </Box>
                            {uniqueLocations.map((loc, idx) => (
                              <Typography key={idx} sx={{ fontSize: '0.85rem', color: 'text.primary', fontWeight: 600 }}>{loc}</Typography>
                            ))}
                            {productsWithPickup[0]?.pickup && (productsWithPickup[0].pickup.startDate || productsWithPickup[0].pickup.endDate) && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                                <Clock size={14} style={{ color: 'text.secondary' }} />
                                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                  {productsWithPickup[0].pickup.startDate && new Date(productsWithPickup[0].pickup.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  {productsWithPickup[0].pickup.startDate && productsWithPickup[0].pickup.endDate && ' - '}
                                  {productsWithPickup[0].pickup.endDate && new Date(productsWithPickup[0].pickup.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            )}
                            {productsWithPickup[0]?.pickup?.notes && (
                              <Typography sx={{ fontSize: '0.7rem', color: '#fbbf24', mt: 0.5 }}>{productsWithPickup[0].pickup.notes}</Typography>
                            )}
                          </Box>
                        );
                      })()}
                      
                      <Button
                        fullWidth
                        onClick={() => onShowQR(order.ref)}
                        sx={{
                          py: 1.5,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
                          color: 'white',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          textTransform: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          boxShadow: '0 4px 14px rgba(6,182,212,0.3)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #0891b2 0%, #059669 100%)',
                            boxShadow: '0 6px 20px rgba(6,182,212,0.4)',
                          },
                        }}
                      >
                        <Package size={20} />
                        แสดง QR รับสินค้า
                      </Button>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textAlign: 'center', mt: 1 }}>
                        กดเพื่อแสดง QR Code สำหรับรับสินค้า
                      </Typography>
                    </Box>
                  )}

                  {/* Delivery Status - Show for delivery orders (not pickup) that haven't shipped yet */}
                  {['READY', 'PAID'].includes(statusKey) && !order.trackingNumber && 
                   ((order.shippingOption && order.shippingOption !== 'pickup' && !order.shippingOption.toLowerCase().includes('รับ')) || 
                    (!order.shippingOption && order.shippingFee && order.shippingFee > 0)) && (
                    <Box sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(30,64,175,0.1) 100%)',
                      border: '1px solid rgba(37,99,235,0.3)',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Truck size={18} color="#fff" />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>
                            เตรียมจัดส่ง
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                            รอทางร้านจัดส่งสินค้า
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: '10px', 
                        bgcolor: 'rgba(37,99,235,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}>
                        <Package size={16} color="#93c5fd" />
                        <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ออเดอร์ของคุณเข้าระบบแล้ว กำลังเตรียมของและจะจัดส่งเร็วๆนี้
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textAlign: 'center', mt: 1.5 }}>
                        เมื่อจัดส่งแล้วจะแจ้งเลขพัสดุให้ทราบ
                      </Typography>
                    </Box>
                  )}

                  {/* Tracking Info for Shipped Orders */}
                  {order.trackingNumber && order.shippingProvider && (
                    <Box sx={{ mt: 2 }}>
                      <TrackingTimeline
                        trackingNumber={order.trackingNumber}
                        shippingProvider={order.shippingProvider as ShippingProvider}
                        compact
                      />
                    </Box>
                  )}

                  {/* Order Total & Actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.2 }}>ยอดรวม</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                        ฿{order.total?.toLocaleString() || '0'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {canPay && (
                        <Button
                          size="small"
                          onClick={() => onOpenPayment(order.ref)}
                          sx={{
                            px: 2,
                            py: 0.8,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                              boxShadow: '0 6px 20px rgba(16,185,129,0.4)',
                            },
                          }}
                        >
                          ชำระเงิน
                        </Button>
                      )}
                      {!isShopOpen && PAYABLE_STATUSES.includes(statusKey) && (
                        <Typography sx={{ 
                          fontSize: '0.7rem', 
                          color: '#f59e0b',
                          bgcolor: 'rgba(245,158,11,0.1)',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}>
                          <Clock size={12} />
                          หมดเขตชำระเงิน
                        </Typography>
                      )}
                      {canCancel && (
                        <Button
                          size="small"
                          onClick={() => onCancelOrder(order.ref)}
                          disabled={cancellingRef === order.ref}
                          sx={{
                            px: 2,
                            py: 0.8,
                            borderRadius: '10px',
                            bgcolor: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': {
                              bgcolor: 'rgba(239,68,68,0.2)',
                              borderColor: 'rgba(239,68,68,0.5)',
                            },
                            '&:disabled': {
                              color: 'text.secondary',
                              borderColor: 'rgba(100,116,139,0.3)',
                            },
                          }}
                        >
                          {cancellingRef === order.ref ? 'กำลังยกเลิก...' : 'ยกเลิก'}
                        </Button>
                      )}
                    </Box>
                  </Box>
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
                    bgcolor: 'rgba(37,99,235,0.1)',
                    border: '1px solid rgba(37,99,235,0.3)',
                    color: 'var(--secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(37,99,235,0.2)' },
                    '&:disabled': { color: 'text.secondary' },
                  }}
                >
                  {loadingHistoryMore ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} sx={{ color: 'var(--secondary)' }} />
                      กำลังโหลด...
                    </Box>
                  ) : (
                    'โหลดเพิ่มเติม'
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
            color: 'text.secondary',
            fontSize: '0.9rem',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { bgcolor: 'var(--glass-bg)' },
          }}
        >
          ปิด
        </Button>
      </Box>
    </Drawer>
  );
}
