'use client';

import { useState, useEffect, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { Clock, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

/** 24 hours in milliseconds */
const EXPIRY_MS = 24 * 60 * 60 * 1000;

interface OrderCountdownProps {
  /** Order creation date (ISO string or Date) */
  orderDate: string | Date;
  /** Compact mode - single line (default: false) */
  compact?: boolean;
  /** Called when the countdown reaches zero */
  onExpired?: () => void;
  /** Custom expiry duration in ms (default: 24h) */
  expiryMs?: number;
}

function formatTimeLeft(ms: number): { hours: string; minutes: string; seconds: string; totalMinutes: number } {
  if (ms <= 0) return { hours: '00', minutes: '00', seconds: '00', totalMinutes: 0 };
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    totalMinutes: Math.floor(ms / 60000),
  };
}

/**
 * Calculates time remaining until order payment deadline (24h from creation).
 */
export function getTimeRemaining(orderDate: string | Date, expiryMs = EXPIRY_MS): number {
  const created = new Date(orderDate).getTime();
  const deadline = created + expiryMs;
  return Math.max(0, deadline - Date.now());
}

/**
 * Returns true if the order has expired (past 24h deadline).
 */
export function isOrderExpired(orderDate: string | Date, expiryMs = EXPIRY_MS): boolean {
  return getTimeRemaining(orderDate, expiryMs) <= 0;
}

/**
 * Hook to get live countdown state for an order's payment deadline.
 */
export function useOrderCountdown(orderDate: string | Date | undefined, expiryMs = EXPIRY_MS) {
  const [remaining, setRemaining] = useState(() => 
    orderDate ? getTimeRemaining(orderDate, expiryMs) : 0
  );

  useEffect(() => {
    if (!orderDate) return;
    
    const update = () => {
      const r = getTimeRemaining(orderDate, expiryMs);
      setRemaining(r);
      if (r <= 0) clearInterval(timer);
    };
    
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [orderDate, expiryMs]);

  const time = useMemo(() => formatTimeLeft(remaining), [remaining]);
  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 60 * 60 * 1000; // < 1 hour
  const isWarning = remaining > 0 && remaining < 6 * 60 * 60 * 1000; // < 6 hours
  const progress = orderDate 
    ? Math.max(0, Math.min(100, (remaining / expiryMs) * 100))
    : 0;

  return { remaining, time, isExpired, isUrgent, isWarning, progress };
}

/**
 * Compact countdown badge for order cards.
 */
export function CountdownBadge({ orderDate, compact, onExpired, expiryMs }: OrderCountdownProps) {
  const { t } = useTranslation();
  const { time, isExpired, isUrgent, isWarning } = useOrderCountdown(orderDate, expiryMs);

  useEffect(() => {
    if (isExpired && onExpired) onExpired();
  }, [isExpired, onExpired]);

  if (isExpired) {
    return (
      <Box sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.3,
        borderRadius: '8px',
        bgcolor: 'rgba(239,68,68,0.15)',
        border: '1px solid rgba(239,68,68,0.3)',
      }}>
        <AlertTriangle size={12} style={{ color: '#ef4444' }} />
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#ef4444' }}>
          {t.countdown.expired}
        </Typography>
      </Box>
    );
  }

  const color = isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#0071e3';
  const bgColor = isUrgent ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(0,113,227,0.1)';
  const borderColor = isUrgent ? 'rgba(239,68,68,0.25)' : isWarning ? 'rgba(245,158,11,0.25)' : 'rgba(0,113,227,0.25)';

  if (compact) {
    return (
      <Box sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.3,
        borderRadius: '8px',
        bgcolor: bgColor,
        border: `1px solid ${borderColor}`,
      }}>
        <Clock size={11} style={{ color }} />
        <Typography sx={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color,
          fontFamily: 'monospace',
          letterSpacing: '0.5px',
        }}>
          {time.hours}:{time.minutes}:{time.seconds}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      p: 1.5,
      borderRadius: '12px',
      bgcolor: bgColor,
      border: `1px solid ${borderColor}`,
      animation: isUrgent ? 'countdownPulse 2s ease-in-out infinite' : 'none',
      '@keyframes countdownPulse': {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.7 },
      },
    }}>
      <Box sx={{
        width: 32,
        height: 32,
        borderRadius: '10px',
        bgcolor: `${color}20`,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <Clock size={16} style={{ color }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
          {t.countdown.timeLeft}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.3 }}>
          {[
            { value: time.hours, label: t.common.hours },
            { value: time.minutes, label: t.common.minutes },
            { value: time.seconds, label: t.common.seconds },
          ].map((segment, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
              <Typography sx={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color,
                fontFamily: 'monospace',
                lineHeight: 1,
              }}>
                {segment.value}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {segment.label}
              </Typography>
              {i < 2 && (
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color, mx: 0.2, opacity: 0.5 }}>:</Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Full countdown display for PaymentModal.
 */
export function PaymentCountdown({ orderDate, onExpired, expiryMs }: OrderCountdownProps) {
  const { t } = useTranslation();
  const { time, isExpired, isUrgent, isWarning, progress } = useOrderCountdown(orderDate, expiryMs);

  useEffect(() => {
    if (isExpired && onExpired) onExpired();
  }, [isExpired, onExpired]);

  if (isExpired) {
    return (
      <Box sx={{
        p: 2,
        borderRadius: '14px',
        bgcolor: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.25)',
        textAlign: 'center',
      }}>
        <AlertTriangle size={24} style={{ color: '#ef4444', marginBottom: 4 }} />
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444' }}>
          {t.countdown.expired}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 0.5 }}>
          {t.countdown.autoCancelled}
        </Typography>
      </Box>
    );
  }

  const color = isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#34c759';

  return (
    <Box sx={{
      p: 2,
      borderRadius: '14px',
      bgcolor: isUrgent ? 'rgba(239,68,68,0.08)' : isWarning ? 'rgba(245,158,11,0.08)' : 'rgba(52,199,89,0.08)',
      border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : isWarning ? 'rgba(245,158,11,0.2)' : 'rgba(52,199,89,0.2)'}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Clock size={16} style={{ color }} />
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color }}>
          {isUrgent ? t.countdown.urgentTime : t.countdown.payWithinTime}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 1.5 }}>
        {[
          { value: time.hours, label: t.common.hoursFull },
          { value: time.minutes, label: t.common.minutes },
          { value: time.seconds, label: t.common.seconds },
        ].map((segment, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              bgcolor: `${color}18`,
              border: `1px solid ${color}30`,
              display: 'grid',
              placeItems: 'center',
            }}>
              <Typography sx={{
                fontSize: '1.3rem',
                fontWeight: 900,
                color,
                fontFamily: 'monospace',
              }}>
                {segment.value}
              </Typography>
            </Box>
            {i < 2 && (
              <Typography sx={{ 
                fontSize: '1.2rem', 
                fontWeight: 700, 
                color, 
                opacity: 0.5,
                animation: 'blinkColon 1s ease-in-out infinite',
                '@keyframes blinkColon': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}>
                :
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Progress bar */}
      <Box sx={{ width: '100%', height: 4, bgcolor: `${color}15`, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{
          height: '100%',
          width: `${progress}%`,
          bgcolor: color,
          borderRadius: 2,
          transition: 'width 1s linear',
        }} />
      </Box>

      <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', mt: 1 }}>
        {t.countdown.payWithin24h}
      </Typography>
    </Box>
  );
}

export default CountdownBadge;
