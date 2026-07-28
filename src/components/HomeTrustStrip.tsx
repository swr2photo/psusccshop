'use client';

import { Box, Typography } from '@mui/material';
import { MapPin, Package, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Light social-proof / trust strip under the hero — not part of the hero itself.
 */
export default function HomeTrustStrip() {
  const { t } = useTranslation();

  const items = [
    { icon: Package, label: t.home.trustOrders },
    { icon: ShieldCheck, label: t.home.trustPayment },
    { icon: MapPin, label: t.home.trustPickup },
  ] as const;

  return (
    <Box
      component="aside"
      aria-label={t.home.trustAria}
      sx={{
        width: '100%',
        borderBottom: '1px solid var(--glass-border)',
        bgcolor: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(8px)',
        animation: 'homeTrustFade 0.6s ease 0.2s both',
        '@keyframes homeTrustFade': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 1.35, sm: 1.5 },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 1.25, sm: 2.5, md: 3.5 },
        }}
      >
        {items.map(({ icon: Icon, label }, i) => (
          <Box
            key={label}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              ...(i > 0
                ? {
                    pl: { sm: 2.5, md: 3.5 },
                    borderLeft: { sm: '1px solid var(--glass-border)' },
                  }
                : {}),
            }}
          >
            <Icon size={14} color="var(--primary)" strokeWidth={2.25} aria-hidden />
            <Typography
              sx={{
                fontSize: { xs: '0.72rem', sm: '0.78rem' },
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
