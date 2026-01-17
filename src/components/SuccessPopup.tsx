'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Grow } from '@mui/material';
import { CheckCircle2, PartyPopper, Sparkles, Heart, ShoppingBag, CreditCard } from 'lucide-react';

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

// ============== COMPONENT ==============

export default function SuccessPopup({
  show,
  type = 'general',
  title,
  subtitle,
  duration = 2500,
  onClose,
}: SuccessPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

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
        bgcolor: 'rgba(10, 15, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.3s ease',
        '@keyframes fadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      }}
      onClick={onClose}
    >
      <Grow in={visible} timeout={400}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            p: 4,
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          {/* Animated Icon Container */}
          <Box
            sx={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              boxShadow: '0 8px 40px rgba(16, 185, 129, 0.4)',
              animation: 'successPulse 1s ease-in-out infinite',
              '@keyframes successPulse': {
                '0%, 100%': { transform: 'scale(1)', boxShadow: '0 8px 40px rgba(16, 185, 129, 0.4)' },
                '50%': { transform: 'scale(1.05)', boxShadow: '0 12px 50px rgba(16, 185, 129, 0.5)' },
              },
            }}
          >
            {SUCCESS_ICONS[type]}
          </Box>

          {/* Sparkles Decoration */}
          <Box
            sx={{
              position: 'absolute',
              width: 160,
              height: 160,
              animation: 'sparkleRotate 8s linear infinite',
              '@keyframes sparkleRotate': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          >
            {[0, 72, 144, 216, 288].map((angle, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${angle}deg) translateY(-70px)`,
                  color: '#6ee7b7',
                  opacity: 0.7,
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
              color: '#f1f5f9',
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
                color: '#94a3b8',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </Typography>
          )}

          {/* Progress Bar */}
          <Box
            sx={{
              width: '80%',
              height: 4,
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              overflow: 'hidden',
              mt: 2,
            }}
          >
            <Box
              sx={{
                height: '100%',
                bgcolor: '#10b981',
                borderRadius: 2,
                animation: `progressShrink ${duration}ms linear`,
                '@keyframes progressShrink': {
                  '0%': { width: '100%' },
                  '100%': { width: '0%' },
                },
              }}
            />
          </Box>

          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>
            แตะเพื่อปิด
          </Typography>
        </Box>
      </Grow>
    </Box>
  );
}
