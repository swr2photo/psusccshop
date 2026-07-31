/* eslint-disable */
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Grow } from '@mui/material';
import { CheckCircle2, PartyPopper, Sparkles, Heart, ShoppingBag, CreditCard } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { getNotificationPalette } from '@/components/notification-presets';

// ============== TYPES ==============

export type SuccessType = 'general' | 'order' | 'payment' | 'profile' | 'cart';

interface SuccessPopupProps {
  show: boolean;
  type?: SuccessType;
  title: string;
  subtitle?: string;
  duration?: number;
  onClose?: () => void;
}

// ============== ICON MAP ==============

const SUCCESS_ICONS = {
  general: <CheckCircle2 size={40} />,
  order: <ShoppingBag size={40} />,
  payment: <CreditCard size={40} />,
  profile: <Heart size={40} />,
  cart: <PartyPopper size={40} />,
};

const SUCCESS_TONES = {
  general: 'info',
  order: 'guide',
  payment: 'success',
  profile: 'neutral',
  cart: 'success',
} as const;

// ============== COMPONENT ==============

export default function SuccessPopup({
  show,
  type = 'general',
  title,
  subtitle,
  duration = 2500,
  onClose,
}: SuccessPopupProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const palette = getNotificationPalette(SUCCESS_TONES[type]);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setDragOffset(0);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startY.current;
    // Allow both up and down swipe
    const absDelta = Math.abs(delta);
    const dampened = absDelta > 60 ? 60 + (absDelta - 60) * 0.3 : absDelta;
    setDragOffset(delta > 0 ? dampened : -dampened);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragOffset) >= 60) {
      setDragOffset(dragOffset > 0 ? window.innerHeight : -window.innerHeight);
      setTimeout(() => {
        setVisible(false);
        onClose?.();
        setDragOffset(0);
      }, 200);
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, onClose]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        px: 2,
        pb: { xs: 3, sm: 4 },
        bgcolor: 'rgba(0,0,0, 0.34)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        animation: 'fadeIn 0.35s ease',
        opacity: isDragging ? Math.max(0.3, 1 - Math.abs(dragOffset) / 150) : 1,
        transition: isDragging ? 'none' : 'opacity 0.3s ease',
        '@keyframes fadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Grow in={visible} timeout={400}>
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            p: 4,
            width: 'min(100%, 360px)',
            textAlign: 'center',
            transform: dragOffset !== 0 ? `translateY(${dragOffset}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            borderRadius: 4,
            border: `1px solid ${palette.ring}`,
            background: palette.shell,
            boxShadow: palette.glow,
            overflow: 'hidden',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 100%)',
              pointerEvents: 'none',
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: palette.accent,
            }}
          />

          {/* Animated Icon Container */}
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accent} 100%)`,
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              boxShadow: `0 16px 40px ${palette.accentSoft}`,
              animation: 'successPulse 1.8s ease-in-out infinite',
              '@keyframes successPulse': {
                '0%, 100%': { transform: 'scale(1)', boxShadow: `0 16px 40px ${palette.accentSoft}` },
                '50%': { transform: 'scale(1.04)', boxShadow: `0 20px 52px ${palette.accentSoft}` },
              },
            }}
          >
            {SUCCESS_ICONS[type]}
          </Box>

          {/* Sparkles Decoration */}
          <Box
            sx={{
              position: 'absolute',
              width: 140,
              height: 140,
              animation: 'sparkleRotate 12s linear infinite',
              '@keyframes sparkleRotate': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          >
          {[0, 120, 240].map((angle, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                transform: `rotate(${angle}deg) translateY(-56px)`,
                color: palette.accent,
                opacity: 0.5,
                }}
              >
                <Sparkles size={14} />
              </Box>
            ))}
          </Box>

          {/* Title */}
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--foreground)',
              mt: 1,
            }}
          >
            {title}
          </Typography>

          {/* Subtitle */}
          {subtitle && (
            <Typography
              sx={{
                fontSize: '1rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </Typography>
          )}

          {/* Progress Bar */}
          <Box
            sx={{
              width: '84%',
              height: 4,
              bgcolor: 'rgba(255, 255, 255, 0.16)',
              borderRadius: 2,
              overflow: 'hidden',
              mt: 2,
            }}
          >
            <Box
              sx={{
                height: '100%',
                bgcolor: palette.accent,
                borderRadius: 2,
                animation: `progressShrink ${duration}ms linear`,
                '@keyframes progressShrink': {
                  '0%': { width: '100%' },
                  '100%': { width: '0%' },
                },
              }}
            />
          </Box>

          <Typography sx={{ fontSize: '0.75rem', color: '#86868b', mt: 0.5 }}>
            {t.successPopup.tapOrSwipe}
          </Typography>
        </Box>
      </Grow>
    </Box>
  );
}
