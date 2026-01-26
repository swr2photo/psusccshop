'use client';

import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Edit,
  Minus,
  Plus,
  ShoppingCart,
  X,
} from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import { 
  normalizeEngName, 
  normalizeDigits99,
  type CartItem,
} from '@/lib/shop-constants';
import { ShopConfig, Product } from '@/lib/config';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  config: ShopConfig | null;
  isShopOpen: boolean;
  onClearCart: () => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onEditItem: (item: CartItem) => void;
  onCheckout: () => void;
  onStartHold: (itemId: string, direction: number) => void;
  onStopHold: (itemId: string) => void;
  onGoHome: () => void;
  getTotalPrice: () => number;
  // Edit dialog props
  editingCartItem: CartItem | null;
  onSetEditingCartItem: (item: CartItem | null) => void;
  onUpdateCartItem: (itemId: string, item: CartItem) => void;
}

export default function CartDrawer(props: CartDrawerProps) {
  const {
    open,
    onClose,
    cart,
    config,
    isShopOpen,
    onClearCart,
    onUpdateQuantity,
    onRemoveItem,
    onEditItem,
    onCheckout,
    onStartHold,
    onStopHold,
    onGoHome,
    getTotalPrice,
    editingCartItem,
    onSetEditingCartItem,
    onUpdateCartItem,
  } = props;

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            height: { xs: '90vh', sm: '80vh' },
            maxHeight: '90vh',
            borderTopLeftRadius: { xs: 20, sm: 24 },
            borderTopRightRadius: { xs: 20, sm: 24 },
            bgcolor: '#0a0f1a',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto', mb: 2 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}>
                <ShoppingCart size={22} color="white" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9' }}>
                  ตะกร้าสินค้า
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {cart.length} รายการ · {cart.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {cart.length > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    if (confirm('ล้างตะกร้าทั้งหมด?')) {
                      onClearCart();
                    }
                  }}
                  sx={{ 
                    color: '#ef4444', 
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' },
                  }}
                >
                  ล้างทั้งหมด
                </Button>
              )}
              <IconButton onClick={onClose} sx={{ color: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                <X size={20} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {cart.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'rgba(100,116,139,0.1)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <ShoppingCart size={36} style={{ color: '#475569' }} />
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '1rem', fontWeight: 600 }}>ตะกร้าว่างเปล่า</Typography>
              <Typography sx={{ color: '#475569', fontSize: '0.85rem' }}>เลือกสินค้าที่ต้องการแล้วเพิ่มลงตะกร้า</Typography>
              <Button
                onClick={onGoHome}
                sx={{
                  mt: 1,
                  px: 3,
                  py: 1,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                เลือกซื้อสินค้า
              </Button>
            </Box>
          ) : (
            <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
              {cart.map((item) => {
                const product = config?.products?.find(p => p.id === item.productId);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'rgba(30,41,59,0.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: 'rgba(30,41,59,0.7)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {product?.images?.[0] && (
                        <Box sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                          <OptimizedImage
                            src={product.images[0]}
                            alt={item.productName}
                            width={60}
                            height={60}
                            objectFit="cover"
                            placeholder="skeleton"
                          />
                        </Box>
                      )}
                      
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
                          <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#a5b4fc' }}>{item.size}</Typography>
                          </Box>
                          {item.options.isLongSleeve && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#fbbf24' }}>แขนยาว</Typography>
                            </Box>
                          )}
                          {item.options.customName && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#6ee7b7' }}>{item.options.customName}</Typography>
                            </Box>
                          )}
                          {item.options.customNumber && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#67e8f9' }}>#{item.options.customNumber}</Typography>
                            </Box>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              bgcolor: 'rgba(255,255,255,0.05)',
                              borderRadius: '10px',
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}>
                              <IconButton
                                size="small"
                                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                onMouseDown={() => onStartHold(item.id, -1)}
                                onMouseUp={() => onStopHold(item.id)}
                                onMouseLeave={() => onStopHold(item.id)}
                                onTouchStart={() => onStartHold(item.id, -1)}
                                onTouchEnd={() => onStopHold(item.id)}
                                sx={{ color: '#94a3b8', p: 0.8, '&:hover': { color: '#f1f5f9' } }}
                              >
                                <Minus size={14} />
                              </IconButton>
                              <Typography sx={{ color: '#f1f5f9', minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                onMouseDown={() => onStartHold(item.id, 1)}
                                onMouseUp={() => onStopHold(item.id)}
                                onMouseLeave={() => onStopHold(item.id)}
                                onTouchStart={() => onStartHold(item.id, 1)}
                                onTouchEnd={() => onStopHold(item.id)}
                                sx={{ color: '#94a3b8', p: 0.8, '&:hover': { color: '#f1f5f9' } }}
                              >
                                <Plus size={14} />
                              </IconButton>
                            </Box>
                            <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>× ฿{item.unitPrice.toLocaleString()}</Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => onEditItem(item)}
                              sx={{ color: '#94a3b8', p: 0.6, '&:hover': { color: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' } }}
                            >
                              <Edit size={14} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => onRemoveItem(item.id)}
                              sx={{ color: '#94a3b8', p: 0.6, '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' } }}
                            >
                              <X size={14} />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', minWidth: 70 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>
                          ฿{(item.unitPrice * item.quantity).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Bottom */}
        {cart.length > 0 && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            <Box sx={{
              p: 2,
              mb: 2,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 0.3 }}>ยอดรวมทั้งหมด</Typography>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                    ฿{getTotalPrice().toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>{cart.length} รายการ</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Button
              fullWidth
              onClick={onCheckout}
              disabled={!isShopOpen}
              sx={{
                py: 1.8,
                borderRadius: '14px',
                background: isShopOpen 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(100,116,139,0.2)',
                color: isShopOpen ? 'white' : '#64748b',
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
                '&:hover': {
                  background: isShopOpen 
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'rgba(100,116,139,0.3)',
                },
                '&:disabled': {
                  background: 'rgba(100,116,139,0.2)',
                  color: '#64748b',
                },
              }}
            >
              {isShopOpen ? 'ยืนยันและดำเนินการสั่งซื้อ' : 'ร้านค้าปิดชั่วคราว'}
            </Button>

            <Button
              fullWidth
              onClick={onClose}
              startIcon={<X size={18} />}
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: '12px',
                bgcolor: 'rgba(100,116,139,0.15)',
                border: '1px solid rgba(100,116,139,0.3)',
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
              }}
            >
              ปิด
            </Button>
          </Box>
        )}

        {cart.length === 0 && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(10,15,26,0.98)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            <Button
              fullWidth
              onClick={onClose}
              startIcon={<X size={18} />}
              sx={{
                py: 1.2,
                borderRadius: '12px',
                bgcolor: 'rgba(100,116,139,0.15)',
                border: '1px solid rgba(100,116,139,0.3)',
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
              }}
            >
              ปิด
            </Button>
          </Box>
        )}
      </Drawer>

      {/* Edit Cart Item Dialog */}
      <Dialog
        open={!!editingCartItem}
        onClose={() => onSetEditingCartItem(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0a0f1a',
            color: '#f1f5f9',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            mx: 2,
          },
        }}
      >
        {editingCartItem && (() => {
          const product = config?.products?.find(p => p.id === editingCartItem.productId);
          const availableSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
          const displaySizes = product?.sizePricing ? Object.keys(product.sizePricing) : availableSizes;
          
          return (
            <>
              <DialogTitle sx={{ 
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Edit size={20} color="#6366f1" />
                  <Typography sx={{ fontWeight: 700 }}>แก้ไขสินค้า</Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ pt: 3 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', mb: 2 }}>
                  {editingCartItem.productName}
                </Typography>

                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', mb: 1 }}>ขนาด</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {displaySizes.map((size) => {
                    const basePrice = product?.sizePricing?.[size] ?? product?.basePrice ?? editingCartItem.unitPrice;
                    const longSleeveFee = product?.options?.hasLongSleeve && editingCartItem.options.isLongSleeve 
                      ? (product?.options?.longSleevePrice ?? 50) 
                      : 0;
                    const active = editingCartItem.size === size;
                    return (
                      <Box
                        key={size}
                        onClick={() => onSetEditingCartItem({ 
                          ...editingCartItem, 
                          size, 
                          unitPrice: basePrice + longSleeveFee 
                        })}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          border: active ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          bgcolor: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: '#6366f1' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: active ? '#a5b4fc' : '#e2e8f0' }}>
                          {size}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                {product?.options?.hasCustomName && (
                  <TextField
                    label="ชื่อติดเสื้อ"
                    fullWidth
                    value={editingCartItem.options.customName || ''}
                    onChange={(e) => onSetEditingCartItem({
                      ...editingCartItem,
                      options: { ...editingCartItem.options, customName: normalizeEngName(e.target.value) }
                    })}
                    inputProps={{ maxLength: 7 }}
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': { color: '#f1f5f9', borderRadius: '12px' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                      '& label': { color: '#64748b' },
                    }}
                  />
                )}

                {product?.options?.hasCustomNumber && (
                  <TextField
                    label="หมายเลขเสื้อ"
                    fullWidth
                    value={editingCartItem.options.customNumber || ''}
                    onChange={(e) => onSetEditingCartItem({
                      ...editingCartItem,
                      options: { ...editingCartItem.options, customNumber: normalizeDigits99(e.target.value) }
                    })}
                    inputProps={{ inputMode: 'numeric' }}
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': { color: '#f1f5f9', borderRadius: '12px' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                      '& label': { color: '#64748b' },
                    }}
                  />
                )}

                {product?.options?.hasLongSleeve && (
                  <Box 
                    onClick={() => {
                      const newIsLong = !editingCartItem.options.isLongSleeve;
                      const basePrice = product?.sizePricing?.[editingCartItem.size] ?? product?.basePrice ?? 0;
                      const sleeveFee = product?.options?.longSleevePrice ?? 50;
                      onSetEditingCartItem({
                        ...editingCartItem,
                        options: { ...editingCartItem.options, isLongSleeve: newIsLong },
                        unitPrice: basePrice + (newIsLong ? sleeveFee : 0)
                      });
                    }}
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: '12px',
                      border: editingCartItem.options.isLongSleeve ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: editingCartItem.options.isLongSleeve ? 'rgba(245,158,11,0.1)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>แขนยาว (+฿{product?.options?.longSleevePrice ?? 50})</Typography>
                    <Switch checked={editingCartItem.options.isLongSleeve} color="warning" sx={{ pointerEvents: 'none' }} />
                  </Box>
                )}

                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', mb: 1 }}>จำนวน</Typography>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  width: 'fit-content',
                }}>
                  <IconButton
                    onClick={() => onSetEditingCartItem({ ...editingCartItem, quantity: Math.max(1, editingCartItem.quantity - 1) })}
                    sx={{ color: '#94a3b8', p: 1.5 }}
                  >
                    <Minus size={18} />
                  </IconButton>
                  <Typography sx={{ color: '#f1f5f9', minWidth: 48, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                    {editingCartItem.quantity}
                  </Typography>
                  <IconButton
                    onClick={() => onSetEditingCartItem({ ...editingCartItem, quantity: Math.min(99, editingCartItem.quantity + 1) })}
                    sx={{ color: '#94a3b8', p: 1.5 }}
                  >
                    <Plus size={18} />
                  </IconButton>
                </Box>
              </DialogContent>
              <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Button onClick={() => onSetEditingCartItem(null)} sx={{ color: '#94a3b8' }}>
                  ยกเลิก
                </Button>
                <Button
                  variant="contained"
                  onClick={() => onUpdateCartItem(editingCartItem.id, editingCartItem)}
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    fontWeight: 700,
                    borderRadius: '12px',
                    px: 3,
                  }}
                >
                  บันทึกการแก้ไข
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </>
  );
}
