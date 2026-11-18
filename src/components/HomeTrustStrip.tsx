'use client';

import { Box } from '@mui/material';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Plain "how it works" line under the hero — set as a numbered list in mono,
 * the way a printed order sheet would put it. No icons, no blur.
 */
export default function HomeTrustStrip() {
  const { t, lang } = useTranslation();
  const en = lang === 'en';

  const items = [
    en ? 'Pick a size, add your name' : 'เลือกไซส์ ใส่ชื่อได้',
    `${en ? 'Pay with' : 'จ่ายด้วย'} ${t.home.trustPayment}`,
    t.home.trustPickup,
    t.home.trustOrders,
  ];

  return (
    <Box
      component="aside"
      aria-label={t.home.trustAria}
      sx={{ width: '100%', borderBottom: '1px solid var(--border)', bgcolor: 'var(--surface)' }}
    >
      <Box
        component="ol"
        className="store-mono"
        sx={{
          listStyle: 'none',
          m: 0,
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, auto)' },
          justifyContent: { md: 'space-between' },
          gap: { xs: 1, md: 3 },
          fontSize: { xs: '0.7rem', sm: '0.74rem' },
          color: 'var(--text-muted)',
        }}
      >
        {items.map((label, i) => (
          <Box component="li" key={label} sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
            <Box component="span" sx={{ color: 'var(--foreground)' }}>{String(i + 1).padStart(2, '0')}</Box>
            <Box component="span" sx={{ minWidth: 0 }}>{label}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
