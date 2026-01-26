'use client';

import React from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import Image from 'next/image';

// Animations
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.85; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const fadeInUp = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const wave = keyframes`
  0% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
`;

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
  variant?: 'fullscreen' | 'inline' | 'overlay';
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingScreen(props: LoadingScreenProps) {
  const message = props.message ?? 'กำลังโหลด...';
  const showLogo = props.showLogo ?? true;
  const variant = props.variant ?? 'fullscreen';
  const size = props.size ?? 'md';

  const logoSize = { sm: 48, md: 64, lg: 80 }[size];
  const textSize = { sm: '0.85rem', md: '1rem', lg: '1.1rem' }[size];

  const content = (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      animation: `${fadeInUp} 0.6s ease-out`,
    }}>
      {/* Logo with Pulse Animation */}
      {showLogo && (
        <Box sx={{
          position: 'relative',
          width: logoSize + 24,
          height: logoSize + 24,
          animation: `${pulse} 2s ease-in-out infinite`,
        }}>
          {/* Glow Effect */}
          <Box sx={{
            position: 'absolute',
            inset: -8,
            borderRadius: '20px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
            filter: 'blur(16px)',
            animation: `${pulse} 2s ease-in-out infinite`,
          }} />
          
          {/* Logo Container */}
          <Box sx={{
            width: logoSize + 24,
            height: logoSize + 24,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)',
            border: '2px solid rgba(99,102,241,0.3)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <Image
              src="/logo.png"
              alt="SCC Shop"
              width={logoSize}
              height={logoSize}
              style={{ objectFit: 'contain' }}
              priority
            />
            
            {/* Shimmer Overlay */}
            <Box sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              backgroundSize: '200% 100%',
              animation: `${shimmer} 2s infinite`,
            }} />
          </Box>
        </Box>
      )}

      {/* Brand Name */}
      <Typography sx={{
        fontWeight: 800,
        fontSize: textSize,
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #6366f1 100%)',
        backgroundSize: '200% auto',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: `${shimmer} 3s linear infinite`,
        letterSpacing: '0.05em',
      }}>
        SCC SHOP
      </Typography>

      {/* Loading Bars */}
      <Box sx={{
        display: 'flex',
        gap: 0.8,
        height: 24,
        alignItems: 'center',
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            sx={{
              width: 4,
              height: '100%',
              borderRadius: 2,
              bgcolor: '#6366f1',
              animation: `${wave} 1s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
              boxShadow: '0 0 8px rgba(99,102,241,0.5)',
            }}
          />
        ))}
      </Box>

      {/* Loading Message */}
      <Typography sx={{
        color: '#94a3b8',
        fontSize: '0.85rem',
        fontWeight: 500,
        animation: `${pulse} 2s ease-in-out infinite`,
      }}>
        {message}
      </Typography>
    </Box>
  );

  if (variant === 'inline') {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        py: 6,
      }}>
        {content}
      </Box>
    );
  }

  if (variant === 'overlay') {
    return (
      <Box sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'rgba(10,15,26,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
      }}>
        {content}
      </Box>
    );
  }

  // Fullscreen
  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      bgcolor: '#0a0f1a',
      zIndex: 9999,
      backgroundImage: `
        radial-gradient(circle at 20% 30%, rgba(99,102,241,0.08) 0%, transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(139,92,246,0.08) 0%, transparent 40%)
      `,
    }}>
      {content}
    </Box>
  );
}

// Enhanced Skeleton Components
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: 'rectangular' | 'circular' | 'text' | 'rounded';
  animation?: 'shimmer' | 'pulse' | 'wave';
}

export function ModernSkeleton(props: SkeletonProps) {
  const width = props.width ?? '100%';
  const height = props.height ?? 20;
  const variant = props.variant ?? 'rectangular';
  const animation = props.animation ?? 'shimmer';

  const borderRadius = {
    rectangular: '4px',
    circular: '50%',
    text: '4px',
    rounded: '12px',
  }[variant];

  const animationKeyframes = {
    shimmer: keyframes`
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    `,
    pulse: keyframes`
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    `,
    wave: keyframes`
      0% { transform: translateX(-100%); }
      50% { transform: translateX(100%); }
      100% { transform: translateX(100%); }
    `,
  }[animation];

  return (
    <Box sx={{
      width,
      height,
      borderRadius,
      position: 'relative',
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,0.06)',
      ...(animation === 'shimmer' && {
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        animation: `${animationKeyframes} 1.5s ease-in-out infinite`,
      }),
      ...(animation === 'pulse' && {
        animation: `${animationKeyframes} 1.5s ease-in-out infinite`,
      }),
    }}>
      {animation === 'wave' && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
          animation: `${animationKeyframes} 1.5s ease-in-out infinite`,
        }} />
      )}
    </Box>
  );
}

// Product Card Skeleton
export function ProductCardSkeleton() {
  return (
    <Box sx={{
      borderRadius: '16px',
      bgcolor: 'rgba(30,41,59,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <ModernSkeleton width="100%" height={180} variant="rectangular" />
      <Box sx={{ p: 2 }}>
        <ModernSkeleton width="70%" height={20} variant="rounded" />
        <Box sx={{ mt: 1.5 }} />
        <ModernSkeleton width="40%" height={16} variant="rounded" />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <ModernSkeleton width={60} height={28} variant="rounded" />
          <ModernSkeleton width={80} height={36} variant="rounded" />
        </Box>
      </Box>
    </Box>
  );
}

// Order Card Skeleton
export function OrderCardSkeleton() {
  return (
    <Box sx={{
      p: 2,
      borderRadius: '18px',
      bgcolor: 'rgba(30,41,59,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <ModernSkeleton width={100} height={18} variant="rounded" />
          <Box sx={{ mt: 1 }} />
          <ModernSkeleton width={140} height={14} variant="rounded" />
        </Box>
        <ModernSkeleton width={70} height={24} variant="rounded" />
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <ModernSkeleton width={56} height={56} variant="rounded" />
        <Box sx={{ flex: 1 }}>
          <ModernSkeleton width="80%" height={16} variant="rounded" />
          <Box sx={{ mt: 1 }} />
          <ModernSkeleton width="40%" height={14} variant="rounded" />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <ModernSkeleton width={80} height={24} variant="rounded" />
        <ModernSkeleton width={100} height={36} variant="rounded" />
      </Box>
    </Box>
  );
}

// Cart Item Skeleton
export function CartItemSkeleton() {
  return (
    <Box sx={{
      p: 2,
      borderRadius: '16px',
      bgcolor: 'rgba(30,41,59,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      gap: 2,
    }}>
      <ModernSkeleton width={60} height={60} variant="rounded" />
      <Box sx={{ flex: 1 }}>
        <ModernSkeleton width="70%" height={18} variant="rounded" />
        <Box sx={{ mt: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <ModernSkeleton width={40} height={20} variant="rounded" />
          <ModernSkeleton width={50} height={20} variant="rounded" />
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <ModernSkeleton width={100} height={28} variant="rounded" />
          <ModernSkeleton width={60} height={20} variant="rounded" />
        </Box>
      </Box>
    </Box>
  );
}
