// src/app/shop/ShopDirectory.tsx
// Client component: lists all active shops as cards
'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Avatar, Chip, CircularProgress, Skeleton,
} from '@mui/material';
import { Store, ArrowLeft, Package, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

interface ShopCard {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  isActive: boolean;
  productCount?: number;
}

const THEME = {
  gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  glass: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  muted: '#94a3b8',
  accent: '#8b5cf6',
};

export default function ShopDirectory() {
  const [shops, setShops] = useState<ShopCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/shops?public=1');
        const data = await res.json();
        if (data.status === 'success') {
          setShops(data.shops || []);
        }
      } catch {
        console.error('Failed to load shops');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a1a', color: 'white' }}>
      {/* Header */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(20px)',
        bgcolor: 'rgba(10,10,26,0.85)',
        borderBottom: `1px solid ${THEME.border}`,
      }}>
        <Box sx={{
          maxWidth: '1200px', mx: 'auto', px: 2, py: 2,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Link href="/" style={{ textDecoration: 'none', color: THEME.muted }}>
            <ArrowLeft size={20} />
          </Link>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>
            ร้านค้าทั้งหมด
          </Typography>
        </Box>
      </Box>

      {/* Banner */}
      <Box sx={{
        background: THEME.gradient,
        py: 6, px: 3,
        textAlign: 'center',
      }}>
        <ShoppingBag size={48} style={{ opacity: 0.8 }} />
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, mt: 1 }}>
          ร้านค้าในชุมนุม
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
          เลือกร้านค้าเพื่อดูสินค้าและสั่งซื้อ
        </Typography>
      </Box>

      {/* Shop Grid */}
      <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2, py: 4 }}>
        {loading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" sx={{ height: 180, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.05)' }} />
            ))}
          </Box>
        ) : shops.length === 0 ? (
          <Box sx={{
            py: 8, textAlign: 'center',
            borderRadius: '16px', bgcolor: THEME.glass,
            border: `1px solid ${THEME.border}`,
          }}>
            <Store size={48} color={THEME.muted} />
            <Typography sx={{ mt: 2, color: THEME.muted }}>
              ยังไม่มีร้านค้าในระบบ
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
          }}>
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Box sx={{
                  borderRadius: '16px',
                  bgcolor: THEME.glass,
                  border: `1px solid ${THEME.border}`,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(139,92,246,0.2)',
                    borderColor: 'rgba(139,92,246,0.3)',
                  },
                }}>
                  {/* Banner */}
                  <Box sx={{
                    height: 100,
                    background: shop.bannerUrl
                      ? `url(${shop.bannerUrl}) center/cover`
                      : THEME.gradient,
                    position: 'relative',
                  }}>
                    <Avatar
                      src={shop.logoUrl}
                      sx={{
                        width: 56, height: 56,
                        position: 'absolute', bottom: -28, left: 16,
                        border: '3px solid #1a1a2e',
                        bgcolor: 'rgba(139,92,246,0.3)',
                        fontSize: '1.3rem', fontWeight: 700,
                      }}
                    >
                      {shop.name[0]}
                    </Avatar>
                  </Box>

                  {/* Info */}
                  <Box sx={{ pt: 4, pb: 2, px: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      {shop.name}
                    </Typography>
                    {shop.nameEn && (
                      <Typography sx={{ fontSize: '0.8rem', color: THEME.muted }}>
                        {shop.nameEn}
                      </Typography>
                    )}
                    {shop.description && (
                      <Typography sx={{
                        fontSize: '0.8rem', color: THEME.muted, mt: 0.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {shop.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5 }}>
                      <Chip
                        icon={<Package size={12} />}
                        label={`${shop.productCount || 0} สินค้า`}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.7rem',
                          bgcolor: 'rgba(139,92,246,0.1)',
                          color: '#a78bfa',
                          '& .MuiChip-icon': { color: '#a78bfa' },
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Link>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
