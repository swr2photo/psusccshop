'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Typography, Button, IconButton, Chip } from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Tag,
  Calendar,
  PartyPopper,
  Megaphone,
  Zap,
  ExternalLink,
} from 'lucide-react';
import OptimizedImage from './OptimizedImage';

// ==================== Types ====================

export interface ShopEvent {
  id: string;
  enabled: boolean;
  title: string;
  description?: string;
  imageUrl?: string;
  color: string;
  type: 'event' | 'promotion' | 'sale' | 'announcement';
  startDate?: string;
  endDate?: string;
  ctaText?: string;
  ctaLink?: string;
  badge?: string;
  priority?: number;
  linkedProducts?: string[];
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface EventBannerProps {
  events: ShopEvent[];
  onEventClick?: (event: ShopEvent) => void;
  compact?: boolean;
}

// ==================== Helpers ====================

const EVENT_COLORS: Record<string, string> = {
  blue: '#0071e3',
  red: '#ff453a',
  green: '#30d158',
  orange: '#ff9f0a',
  purple: '#bf5af2',
  pink: '#ff375f',
  teal: '#64d2ff',
  yellow: '#ffd60a',
  indigo: '#5e5ce6',
};

const getColor = (c: string) => EVENT_COLORS[c] || c || '#0071e3';

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; gradient: string }> = {
  event: {
    icon: <PartyPopper size={14} />,
    label: 'อีเวนท์',
    gradient: 'linear-gradient(135deg, #bf5af2 0%, #5e5ce6 100%)',
  },
  promotion: {
    icon: <Sparkles size={14} />,
    label: 'โปรโมชั่น',
    gradient: 'linear-gradient(135deg, #ff9f0a 0%, #ff375f 100%)',
  },
  sale: {
    icon: <Tag size={14} />,
    label: 'ลดราคา',
    gradient: 'linear-gradient(135deg, #ff453a 0%, #ff375f 100%)',
  },
  announcement: {
    icon: <Megaphone size={14} />,
    label: 'ประกาศ',
    gradient: 'linear-gradient(135deg, #0071e3 0%, #5e5ce6 100%)',
  },
};

function useCountdown(targetDate?: string) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    if (isNaN(target)) return;

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return { timeLeft, isExpired };
}

/** Re-renders every 30s so date-based conditions (active, expired, countdown phase) stay current */
function useTimeTick(intervalMs = 30000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

// ==================== Sub-components ====================

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: { xs: 28, sm: 40 } }}>
      <Box sx={{
        fontSize: { xs: '0.9rem', sm: '1.2rem' },
        fontWeight: 800,
        lineHeight: 1,
        color: '#fff',
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {String(value).padStart(2, '0')}
      </Box>
      <Typography sx={{ fontSize: { xs: '0.45rem', sm: '0.55rem' }, color: 'rgba(255,255,255,0.7)', mt: 0.25, fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const { timeLeft, isExpired } = useCountdown(targetDate);

  if (isExpired) {
    return (
      <Chip
        icon={<Zap size={12} />}
        label="กำลังดำเนินการ"
        size="small"
        sx={{
          bgcolor: 'rgba(48,209,88,0.2)',
          color: '#30d158',
          fontWeight: 700,
          fontSize: '0.7rem',
          border: '1px solid rgba(48,209,88,0.3)',
          '& .MuiChip-icon': { color: '#30d158' },
        }}
      />
    );
  }

  if (!timeLeft) return null;

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: { xs: 0.25, sm: 0.5 },
      px: { xs: 1, sm: 1.5 },
      py: 0.75,
      borderRadius: '12px',
      bgcolor: 'rgba(0,0,0,0.25)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <Clock size={12} color="rgba(255,255,255,0.7)" />
      <CountdownUnit value={timeLeft.days} label="วัน" />
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: { xs: '0.8rem', sm: '1rem' }, mx: -0.3 }}>:</Typography>
      <CountdownUnit value={timeLeft.hours} label="ชม." />
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: { xs: '0.8rem', sm: '1rem' }, mx: -0.3 }}>:</Typography>
      <CountdownUnit value={timeLeft.minutes} label="นาที" />
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: { xs: '0.8rem', sm: '1rem' }, mx: -0.3 }}>:</Typography>
      <CountdownUnit value={timeLeft.seconds} label="วินาที" />
    </Box>
  );
}

// ==================== Main Component ====================

export default function EventBanner({ events, onEventClick, compact = false }: EventBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-evaluate every 30s so expired events drop out & countdown phase transitions update
  const tick = useTimeTick(30000);

  // Filter enabled & not-expired events, sorted by priority
  const activeEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter(e => {
        if (!e.enabled) return false;
        if (e.endDate && new Date(e.endDate).getTime() < now) return false;
        return true;
      })
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tick]);

  const currentEvent = activeEvents[currentIndex % activeEvents.length];

  // Auto-cycle
  useEffect(() => {
    if (activeEvents.length <= 1 || isPaused) return;
    timerRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % activeEvents.length);
        setIsTransitioning(false);
      }, 300);
    }, 6000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeEvents.length, isPaused]);

  const goTo = useCallback((dir: 'prev' | 'next') => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => {
        if (dir === 'next') return (prev + 1) % activeEvents.length;
        return (prev - 1 + activeEvents.length) % activeEvents.length;
      });
      setIsTransitioning(false);
    }, 300);
  }, [activeEvents.length]);

  if (activeEvents.length === 0 || !currentEvent) return null;

  const color = getColor(currentEvent.color);
  const typeConfig = EVENT_TYPE_CONFIG[currentEvent.type] || EVENT_TYPE_CONFIG.announcement;

  // Has both image and text content?
  const hasImage = !!currentEvent.imageUrl;
  const now = Date.now();
  const startMs = currentEvent.startDate ? new Date(currentEvent.startDate).getTime() : NaN;
  const endMs = currentEvent.endDate ? new Date(currentEvent.endDate).getTime() : NaN;
  const hasCountdown = !isNaN(startMs) && startMs > now;
  const hasEndCountdown = !isNaN(endMs) && endMs > now && (isNaN(startMs) || startMs <= now);

  if (compact) {
    // Compact mode — single-line strip
    return (
      <Box
        onClick={() => onEventClick?.(currentEvent)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          cursor: onEventClick ? 'pointer' : 'default',
          borderRadius: '14px',
          mx: { xs: 1.5, sm: 2 },
          mb: 1.5,
        }}
      >
        {/* Background */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
          border: `1px solid ${color}25`,
          borderRadius: '14px',
        }} />

        <Box sx={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, py: 1.25,
        }}>
          {/* Type badge */}
          <Chip
            icon={typeConfig.icon as React.ReactElement}
            label={typeConfig.label}
            size="small"
            sx={{
              background: typeConfig.gradient,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.65rem',
              height: 22,
              '& .MuiChip-icon': { color: '#fff' },
            }}
          />

          {/* Badge */}
          {currentEvent.badge && (
            <Chip
              label={currentEvent.badge}
              size="small"
              sx={{
                bgcolor: `${color}20`,
                color: color,
                fontWeight: 800,
                fontSize: '0.7rem',
                height: 22,
                border: `1px solid ${color}40`,
              }}
            />
          )}

          {/* Title */}
          <Typography sx={{
            flex: 1, fontSize: '0.85rem', fontWeight: 700,
            color: 'var(--foreground)', lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentEvent.title}
          </Typography>

          {/* Navigation */}
          {activeEvents.length > 1 && (
            <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center' }}>
              {activeEvents.map((_, i) => (
                <Box key={i} onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }} sx={{
                  width: i === currentIndex % activeEvents.length ? 12 : 5,
                  height: 5, borderRadius: '3px',
                  bgcolor: i === currentIndex % activeEvents.length ? color : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.3s ease',
                }} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Full banner mode
  return (
    <Box
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '20px',
        mx: { xs: 1.5, sm: 2 },
        mb: 2,
        minHeight: hasImage ? { xs: 200, sm: 220 } : { xs: 120, sm: 140 },
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Background layer */}
      {hasImage ? (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <OptimizedImage
            src={currentEvent.imageUrl!}
            alt={currentEvent.title}
            width="100%"
            height="100%"
            objectFit="cover"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
          />
          {/* Gradient overlay */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.8) 100%)`,
          }} />
        </Box>
      ) : (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 50%, ${color}99 100%)`,
        }}>
          {/* Decorative pattern */}
          <Box sx={{
            position: 'absolute', inset: 0, opacity: 0.08,
            backgroundImage: `radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px),
                              radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px),
                              radial-gradient(circle at 60% 80%, #fff 1px, transparent 1px)`,
            backgroundSize: '60px 60px, 80px 80px, 50px 50px',
          }} />
        </Box>
      )}

      {/* Content */}
      <Box sx={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        p: { xs: 2, sm: 2.5 },
        minHeight: hasImage ? { xs: 200, sm: 220 } : { xs: 120, sm: 140 },
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'translateY(8px)' : 'translateY(0)',
        transition: 'all 0.3s ease',
      }}>
        {/* Top-right badges */}
        <Box sx={{
          position: 'absolute', top: { xs: 12, sm: 16 }, right: { xs: 12, sm: 16 },
          display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end',
        }}>
          {currentEvent.badge && (
            <Chip
              label={currentEvent.badge}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(12px)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.8rem',
                height: 28,
                border: '1px solid rgba(255,255,255,0.3)',
                px: 0.5,
              }}
            />
          )}
        </Box>

        {/* Type chip */}
        <Box sx={{ position: 'absolute', top: { xs: 12, sm: 16 }, left: { xs: 12, sm: 16 } }}>
          <Chip
            icon={typeConfig.icon as React.ReactElement}
            label={typeConfig.label}
            size="small"
            sx={{
              background: typeConfig.gradient,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 24,
              backdropFilter: 'blur(12px)',
              '& .MuiChip-icon': { color: '#fff' },
            }}
          />
        </Box>

        {/* Title */}
        <Typography sx={{
          fontSize: { xs: '1.1rem', sm: '1.5rem' },
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1.2,
          mb: 0.5,
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          maxWidth: { xs: '90%', sm: '80%' },
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {currentEvent.title}
        </Typography>

        {/* Description */}
        {currentEvent.description && (
          <Typography sx={{
            fontSize: { xs: '0.8rem', sm: '0.9rem' },
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.5,
            mb: 1.5,
            maxWidth: '75%',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}>
            {currentEvent.description}
          </Typography>
        )}

        {/* Bottom row: countdown + CTA */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Countdown */}
          {(hasCountdown || hasEndCountdown) && (
            <CountdownTimer targetDate={(hasCountdown ? currentEvent.startDate : currentEvent.endDate)!} />
          )}

          {/* CTA Button */}
          {currentEvent.ctaText && (
            <Button
              onClick={(e) => { e.stopPropagation(); onEventClick?.(currentEvent); }}
              endIcon={<ExternalLink size={14} />}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(12px)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                px: 2,
                py: 0.75,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.3)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                },
              }}
            >
              {currentEvent.ctaText}
            </Button>
          )}

          {/* Date info */}
          {currentEvent.startDate && !hasCountdown && !hasEndCountdown && (
            <Chip
              icon={<Calendar size={12} />}
              label={new Date(currentEvent.startDate).toLocaleDateString('th-TH', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.7rem',
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
                '& .MuiChip-icon': { color: 'rgba(255,255,255,0.7)' },
              }}
            />
          )}
        </Box>
      </Box>

      {/* Navigation arrows — hidden on xs to avoid overlapping content */}
      {activeEvents.length > 1 && (
        <>
          <IconButton
            onClick={(e) => { e.stopPropagation(); goTo('prev'); }}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.3)', color: '#fff',
              backdropFilter: 'blur(8px)',
              width: 32, height: 32,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); goTo('next'); }}
            sx={{
              display: { xs: 'none', sm: 'flex' },
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.3)', color: '#fff',
              backdropFilter: 'blur(8px)',
              width: 32, height: 32,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <ChevronRight size={18} />
          </IconButton>
        </>
      )}

      {/* Dots indicator */}
      {activeEvents.length > 1 && (
        <Box sx={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
          display: 'flex', gap: 0.5,
          px: 1, py: 0.5,
          borderRadius: '10px',
          bgcolor: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
        }}>
          {activeEvents.map((_, i) => (
            <Box
              key={i}
              onClick={() => setCurrentIndex(i)}
              sx={{
                width: i === currentIndex % activeEvents.length ? 16 : 6,
                height: 6,
                borderRadius: '3px',
                bgcolor: i === currentIndex % activeEvents.length ? '#fff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
