// src/app/shop/[slug]/ShopStorefront.tsx
// Client-side storefront for individual shops
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, Avatar, IconButton, Badge,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Snackbar, Alert, useMediaQuery, Divider, Tabs, Tab, Skeleton,
} from '@mui/material';
import {
  Store, ShoppingCart, Plus, Minus, X, ArrowLeft, Search,
  Share2, Heart, Star, ChevronLeft, ChevronRight, Filter,
  Package, CreditCard, MapPin, Phone, Mail, Clock,
} from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/store/cartStore';
import type { Product } from '@/lib/config';

// ==================== TYPES ====================
interface ShopInfo {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  isActive: boolean;
  settings?: {
    isOpen?: boolean;
    closedMessage?: string;
  };
  paymentInfo?: {
    promptPayId?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  productCount?: number;
}

interface ShopStorefrontProps {
  shopSlug: string;
  initialShop: ShopInfo;
}

// ==================== THEME ====================
const THEME = {
  gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  glass: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  muted: '#94a3b8',
  accent: '#8b5cf6',
  success: '#10b981',
};

// ==================== COMPONENT ====================
export default function ShopStorefront({ shopSlug, initialShop }: ShopStorefrontProps) {
  const { data: session } = useSession();
  const isMobile = useMediaQuery('(max-width:600px)');
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);

  const [shop, setShop] = useState<ShopInfo>(initialShop);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [toast, setToast] = useState<{ open: boolean; type: 'success' | 'error' | 'info'; message: string }>({
    open: false, type: 'info', message: '',
  });
  const [cartOpen, setCartOpen] = useState(false);

  // Product dialog state
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ open: true, type, message });
  };

  // Fetch products
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Find the shop ID from the initial data, or refetch
        let shopId = initialShop.id;
        if (!shopId) {
          const shopRes = await fetch(`/api/shops?public=1`);
          const shopData = await shopRes.json();
          const found = (shopData.shops || []).find((s: any) => s.slug === shopSlug);
          if (found) shopId = found.id;
        }
        if (!shopId) return;

        const res = await fetch(`/api/shops/${shopId}/products`);
        const data = await res.json();
        if (data.status === 'success') {
          setProducts(data.products || []);
        }
      } catch {
        console.error('Failed to load shop products');
      } finally {
        setLoading(false);
      }
    })();
  }, [shopSlug, initialShop.id]);

  // Categories from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q));
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart count for this shop
  const cartCount = cart.length;

  // Add to cart handler
  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const price = selectedVariant
      ? selectedVariant.price
      : selectedProduct.sizePricing?.[selectedSize] || selectedProduct.basePrice;

    const item = {
      id: selectedProduct.id,
      name: selectedProduct.name,
      type: selectedProduct.type || 'OTHER' as const,
      category: selectedProduct.category,
      subType: selectedProduct.subType,
      price,
      qty: quantity,
      size: selectedSize || '-',
      total: price * quantity,
      selectedVariant: selectedVariant || undefined,
    };

    addToCart(item);
    showToast('success', `เพิ่ม "${selectedProduct.name}" ลงตะกร้าแล้ว`);
    setSelectedProduct(null);
    setSelectedSize('');
    setSelectedVariant(null);
    setQuantity(1);
  };

  const isOpen = shop.settings?.isOpen !== false;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a1a', color: 'white' }}>
      {/* ==================== HEADER ==================== */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(20px)',
        bgcolor: 'rgba(10,10,26,0.85)',
        borderBottom: `1px solid ${THEME.border}`,
      }}>
        <Box sx={{
          maxWidth: '1200px', mx: 'auto', px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <IconButton sx={{ color: THEME.muted }}>
              <ArrowLeft size={20} />
            </IconButton>
          </Link>
          <Avatar
            src={shop.logoUrl}
            sx={{ width: 36, height: 36, bgcolor: 'rgba(139,92,246,0.2)' }}
          >
            {shop.name[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }} noWrap>
              {shop.name}
            </Typography>
            {!isOpen && (
              <Typography sx={{ fontSize: '0.7rem', color: '#ef4444' }}>
                ปิดรับออเดอร์
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setCartOpen(true)} sx={{ color: 'white' }}>
            <Badge badgeContent={cartCount} color="error">
              <ShoppingCart size={22} />
            </Badge>
          </IconButton>
        </Box>
      </Box>

      {/* ==================== BANNER ==================== */}
      <Box sx={{
        position: 'relative',
        height: isMobile ? 160 : 220,
        background: shop.bannerUrl
          ? `url(${shop.bannerUrl}) center/cover`
          : THEME.gradient,
        display: 'flex', alignItems: 'flex-end',
      }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(transparent 30%, rgba(10,10,26,0.9))',
        }} />
        <Box sx={{
          position: 'relative', px: 3, pb: 2.5, maxWidth: '1200px',
          mx: 'auto', width: '100%',
        }}>
          <Typography sx={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800 }}>
            {shop.name}
          </Typography>
          {shop.description && (
            <Typography sx={{ fontSize: '0.85rem', color: THEME.muted, mt: 0.5 }}>
              {shop.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              label={isOpen ? 'เปิดรับออเดอร์' : 'ปิดรับออเดอร์'}
              size="small"
              sx={{
                bgcolor: isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: isOpen ? '#10b981' : '#ef4444',
                fontWeight: 700, fontSize: '0.75rem',
              }}
            />
            <Chip
              label={`${products.filter(p => p.isActive).length} สินค้า`}
              size="small"
              sx={{
                bgcolor: 'rgba(139,92,246,0.15)',
                color: '#a78bfa',
                fontWeight: 700, fontSize: '0.75rem',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ==================== SEARCH & FILTERS ==================== */}
      <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2, pt: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            placeholder="ค้นหาสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <Search size={16} style={{ marginRight: 8, color: THEME.muted }} />,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: THEME.glass,
                '& fieldset': { borderColor: THEME.border },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: THEME.accent },
              },
              '& .MuiInputBase-input': { color: 'white', fontSize: '0.85rem' },
            }}
          />
        </Box>

        {/* Category Tabs */}
        {categories.length > 1 && (
          <Box sx={{ mb: 2, overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip
                label="ทั้งหมด"
                onClick={() => setSelectedCategory('all')}
                sx={{
                  bgcolor: selectedCategory === 'all' ? THEME.accent : THEME.glass,
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.8 },
                }}
              />
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  onClick={() => setSelectedCategory(cat)}
                  sx={{
                    bgcolor: selectedCategory === cat ? THEME.accent : THEME.glass,
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* ==================== PRODUCT GRID ==================== */}
        {loading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
                <Skeleton variant="rectangular" sx={{ height: 180, bgcolor: 'rgba(255,255,255,0.05)' }} />
                <Box sx={{ p: 1.5 }}>
                  <Skeleton sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                  <Skeleton width="60%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : filteredProducts.length === 0 ? (
          <Box sx={{
            py: 8, textAlign: 'center',
            borderRadius: '16px', bgcolor: THEME.glass,
            border: `1px solid ${THEME.border}`,
          }}>
            <Package size={48} color={THEME.muted} />
            <Typography sx={{ mt: 2, color: THEME.muted }}>
              {searchQuery ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในร้านนี้'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: '1fr 1fr 1fr 1fr' },
            gap: 2, pb: 6,
          }}>
            {filteredProducts.map((product) => (
              <Box
                key={product.id}
                onClick={() => isOpen ? setSelectedProduct(product) : showToast('info', shop.settings?.closedMessage || 'ร้านปิดรับออเดอร์แล้ว')}
                sx={{
                  borderRadius: '16px',
                  bgcolor: THEME.glass,
                  border: `1px solid ${THEME.border}`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(139,92,246,0.15)',
                  },
                }}
              >
                {/* Product Image */}
                <Box sx={{
                  position: 'relative',
                  height: isMobile ? 140 : 180,
                  bgcolor: 'rgba(255,255,255,0.02)',
                }}>
                  {(product.coverImage || product.images?.[0]) ? (
                    <img
                      src={product.coverImage || product.images?.[0]}
                      alt={product.name}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Package size={40} color={THEME.muted} />
                    </Box>
                  )}
                  {/* Tags */}
                  {product.customTags && product.customTags.length > 0 && (
                    <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.5 }}>
                      {product.customTags.slice(0, 2).map((tag, i) => (
                        <Chip
                          key={i}
                          label={tag.text}
                          size="small"
                          sx={{
                            height: 20, fontSize: '0.6rem', fontWeight: 700,
                            bgcolor: tag.bgColor || 'rgba(139,92,246,0.9)',
                            color: tag.color || 'white',
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Product Info */}
                <Box sx={{ p: 1.5 }}>
                  <Typography sx={{
                    fontSize: '0.85rem', fontWeight: 600,
                    color: 'white', lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {product.name}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.9rem', fontWeight: 800,
                    color: THEME.accent, mt: 0.5,
                  }}>
                    ฿{product.basePrice.toLocaleString()}
                    {product.sizePricing && Object.keys(product.sizePricing).length > 0 && (
                      <Typography component="span" sx={{ fontSize: '0.7rem', color: THEME.muted, ml: 0.5 }}>
                        ขึ้นไป
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* ==================== PRODUCT DETAIL DIALOG ==================== */}
      <Dialog
        open={!!selectedProduct}
        onClose={() => { setSelectedProduct(null); setSelectedSize(''); setSelectedVariant(null); setQuantity(1); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            color: 'white',
            borderRadius: '16px',
            border: `1px solid ${THEME.border}`,
            maxHeight: '90vh',
          },
        }}
      >
        {selectedProduct && (
          <>
            {/* Product Image */}
            {(selectedProduct.coverImage || selectedProduct.images?.[0]) && (
              <Box sx={{ position: 'relative', height: 260 }}>
                <img
                  src={selectedProduct.coverImage || selectedProduct.images?.[0]}
                  alt={selectedProduct.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <IconButton
                  onClick={() => { setSelectedProduct(null); setSelectedSize(''); setSelectedVariant(null); setQuantity(1); }}
                  sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
                >
                  <X size={18} />
                </IconButton>
              </Box>
            )}

            <DialogContent sx={{ px: 3, py: 2 }}>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 800 }}>
                {selectedProduct.name}
              </Typography>
              {selectedProduct.description && (
                <Typography sx={{ fontSize: '0.85rem', color: THEME.muted, mt: 1, whiteSpace: 'pre-line' }}>
                  {selectedProduct.description}
                </Typography>
              )}

              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: THEME.accent, mt: 2 }}>
                ฿{(selectedVariant?.price || selectedProduct.sizePricing?.[selectedSize] || selectedProduct.basePrice).toLocaleString()}
              </Typography>

              {/* Size Selection */}
              {selectedProduct.sizePricing && Object.keys(selectedProduct.sizePricing).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>
                    ขนาด
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {Object.entries(selectedProduct.sizePricing).map(([size, price]) => (
                      <Chip
                        key={size}
                        label={`${size} (฿${price})`}
                        onClick={() => setSelectedSize(size)}
                        sx={{
                          bgcolor: selectedSize === size ? THEME.accent : THEME.glass,
                          color: 'white',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1px solid ${selectedSize === size ? THEME.accent : THEME.border}`,
                          '&:hover': { opacity: 0.8 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Variant Selection */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1 }}>
                    ตัวเลือก
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedProduct.variants.filter(v => v.isActive).map((variant) => (
                      <Chip
                        key={variant.id}
                        label={`${variant.name} (฿${variant.price})`}
                        onClick={() => setSelectedVariant(variant)}
                        sx={{
                          bgcolor: selectedVariant?.id === variant.id ? THEME.accent : THEME.glass,
                          color: 'white',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1px solid ${selectedVariant?.id === variant.id ? THEME.accent : THEME.border}`,
                          '&:hover': { opacity: 0.8 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Quantity */}
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  จำนวน
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    sx={{ bgcolor: THEME.glass, color: 'white', border: `1px solid ${THEME.border}` }}
                  >
                    <Minus size={16} />
                  </IconButton>
                  <Typography sx={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>
                    {quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setQuantity(quantity + 1)}
                    sx={{ bgcolor: THEME.glass, color: 'white', border: `1px solid ${THEME.border}` }}
                  >
                    <Plus size={16} />
                  </IconButton>
                </Box>
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleAddToCart}
                disabled={
                  (selectedProduct.sizePricing && Object.keys(selectedProduct.sizePricing).length > 0 && !selectedSize) ||
                  (selectedProduct.variants && selectedProduct.variants.length > 0 && !selectedVariant)
                }
                startIcon={<ShoppingCart size={18} />}
                sx={{
                  background: THEME.gradient,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.2,
                  fontSize: '1rem',
                }}
              >
                เพิ่มลงตะกร้า — ฿{((selectedVariant?.price || selectedProduct.sizePricing?.[selectedSize] || selectedProduct.basePrice) * quantity).toLocaleString()}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ==================== SHOP INFO FOOTER ==================== */}
      <Box sx={{
        maxWidth: '1200px', mx: 'auto', px: 2, py: 4,
        borderTop: `1px solid ${THEME.border}`,
      }}>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Store size={16} /> ข้อมูลร้านค้า
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {shop.contactEmail && (
            <Typography sx={{ fontSize: '0.8rem', color: THEME.muted, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Mail size={14} /> {shop.contactEmail}
            </Typography>
          )}
          {shop.contactPhone && (
            <Typography sx={{ fontSize: '0.8rem', color: THEME.muted, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Phone size={14} /> {shop.contactPhone}
            </Typography>
          )}
          {shop.paymentInfo?.accountName && (
            <Typography sx={{ fontSize: '0.8rem', color: THEME.muted, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCard size={14} /> {shop.paymentInfo.accountName}
              {shop.paymentInfo.bankName ? ` (${shop.paymentInfo.bankName})` : ''}
            </Typography>
          )}
        </Box>

        {/* Back to main shop */}
        <Box sx={{ mt: 3 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowLeft size={16} />}
              sx={{
                color: THEME.muted,
                borderColor: THEME.border,
                borderRadius: '10px',
                textTransform: 'none',
                '&:hover': { borderColor: THEME.accent, color: THEME.accent },
              }}
            >
              กลับหน้าหลัก
            </Button>
          </Link>
        </Box>
      </Box>

      {/* ==================== TOAST ==================== */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: '12px' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
