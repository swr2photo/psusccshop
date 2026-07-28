'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Megaphone,
  X,
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Instagram,
  Facebook,
  Music,
  MessageCircle,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { useTranslation } from '@/hooks/useTranslation';

// ==================== Types ====================

interface Announcement {
  id: string;
  enabled: boolean;
  message: string;
  color: string;
  imageUrl?: string;
  postedBy?: string;
  displayName?: string;
  postedAt: string;
  type?: 'text' | 'image' | 'both';
  showLogo?: boolean;
  priority?: number;
  isSpecial?: boolean;
  specialIcon?: string;
  link?: string;
  linkText?: string;
  linkedProductId?: string;
}

interface AnnouncementHistoryItem {
  id: string;
  message: string;
  color: string;
  imageUrl?: string;
  postedBy?: string;
  displayName?: string;
  postedAt: string;
  type?: 'text' | 'image' | 'both';
  deletedAt?: string;
  deletedBy?: string;
}

interface SocialMediaNews {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'line';
  title: string;
  description?: string;
  postUrl: string;
  imageUrl?: string;
  postedAt: string;
  enabled: boolean;
}

interface AnnouncementBarProps {
  announcements: Announcement[];
  history?: AnnouncementHistoryItem[];
  socialMediaNews?: SocialMediaNews[];
  onProductClick?: (productId: string) => void;
}

// ==================== Helpers ====================

const COLOR_MAP: Record<string, string> = {
  blue: '#0071e3',
  red: '#ff453a',
  green: '#30d158',
  emerald: '#34c759',
  orange: '#ff9f0a',
  purple: '#bf5af2',
  pink: '#ff375f',
  teal: '#64d2ff',
  yellow: '#ffd60a',
  indigo: '#5e5ce6',
};

const getColor = (c: string) => COLOR_MAP[c] || (c?.startsWith('#') ? c : '#0071e3');

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  instagram: { label: 'Instagram', icon: <Instagram size={14} />, color: '#E4405F' },
  facebook: { label: 'Facebook', icon: <Facebook size={14} />, color: '#1877F2' },
  tiktok: { label: 'TikTok', icon: <Music size={14} />, color: '#111111' },
  line: { label: 'LINE', icon: <MessageCircle size={14} />, color: '#06C755' },
};

function SocialNewsStrip({ news }: { news: SocialMediaNews[] }) {
  if (news.length === 0) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        px: { xs: 1.5, sm: 2, md: 3 },
        py: 1,
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid var(--glass-border)',
        bgcolor: 'var(--background)',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {news.map((item) => {
        const platform = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.instagram;
        return (
          <Box
            key={item.id}
            component="a"
            href={item.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              flex: '0 0 auto',
              scrollSnapAlign: 'start',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              bgcolor: 'var(--surface-2)',
              textDecoration: 'none',
              maxWidth: { xs: '78vw', sm: 280 },
              transition: 'border-color 0.2s ease, transform 0.2s ease',
              '&:hover': {
                borderColor: platform.color,
                transform: 'translateY(-1px)',
              },
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                bgcolor: `${platform.color}18`,
                color: platform.color,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {platform.icon}
            </Box>
            <Typography
              sx={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.title}
            </Typography>
            <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </Box>
        );
      })}
    </Box>
  );
}

// ==================== Component ====================

export default function AnnouncementBar({
  announcements,
  history,
  socialMediaNews,
  onProductClick,
}: AnnouncementBarProps) {
  const { t, lang } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [slideKey, setSlideKey] = useState(0);
  const [paused, setPaused] = useState(false);

  const enabled = useMemo(
    () => announcements?.filter((a) => a.enabled) || [],
    [announcements]
  );
  const activeNews = useMemo(
    () => socialMediaNews?.filter((n) => n.enabled) || [],
    [socialMediaNews]
  );

  // Fingerprint so a new/edited announcement reappears even if the user dismissed earlier
  const contentFingerprint = useMemo(
    () =>
      enabled
        .map((a) => `${a.id}|${a.message}|${a.color}|${a.imageUrl || ''}|${a.postedAt || ''}|${a.link || ''}|${a.linkedProductId || ''}`)
        .join('::'),
    [enabled]
  );

  const goTo = useCallback(
    (next: number) => {
      setCurrentIndex(((next % enabled.length) + enabled.length) % enabled.length);
      setExpanded(false);
      setSlideKey((k) => k + 1);
    },
    [enabled.length]
  );

  useEffect(() => {
    if (enabled.length <= 1 || paused) return;
    const id = setInterval(() => goTo(currentIndex + 1), 7000);
    return () => clearInterval(id);
  }, [enabled.length, paused, currentIndex, goTo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Migrate legacy session dismiss that blocked all future announcements
    sessionStorage.removeItem('ann_dismissed');
    const dismissedFp = sessionStorage.getItem('ann_dismissed_fp');
    setDismissed(Boolean(contentFingerprint) && dismissedFp === contentFingerprint);
    setCurrentIndex(0);
    setExpanded(false);
  }, [contentFingerprint]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined' && contentFingerprint) {
      sessionStorage.setItem('ann_dismissed_fp', contentFingerprint);
    }
  };

  const locale = lang === 'en' ? 'en-US' : 'th-TH';

  if (enabled.length === 0 || dismissed) {
    if (activeNews.length === 0) return null;
    return <SocialNewsStrip news={activeNews} />;
  }

  const current = enabled[currentIndex % enabled.length];
  if (!current) return null;

  const color = getColor(current.color);
  const hasImage = !!current.imageUrl;
  const isLongMessage = (current.message?.length || 0) > 90;
  const isSpecial = !!current.isSpecial;
  const progress = ((currentIndex % enabled.length) + 1) / enabled.length;

  const openPrimary = () => {
    if (current.linkedProductId && onProductClick) {
      onProductClick(current.linkedProductId);
      return;
    }
    if (hasImage) setShowImage(true);
  };

  return (
    <>
      <Box
        component="section"
        aria-label={t.announcement.sectionTitle}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        sx={{
          position: 'relative',
          width: '100%',
          borderBottom: '1px solid var(--glass-border)',
          overflow: 'hidden',
          bgcolor: 'var(--surface-2)',
        }}
      >
        {/* Atmosphere wash from announcement color */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 70% 120% at 0% 50%, color-mix(in srgb, ${color} 18%, transparent) 0%, transparent 55%),
              linear-gradient(90deg, color-mix(in srgb, ${color} 8%, transparent) 0%, transparent 42%)
            `,
            pointerEvents: 'none',
          }}
        />

        {/* Top progress for multi-announcement */}
        {enabled.length > 1 && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              bgcolor: 'var(--glass-border)',
              zIndex: 2,
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${progress * 100}%`,
                bgcolor: color,
                transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </Box>
        )}

        <Box
          key={slideKey}
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1.25, sm: 2 },
            px: { xs: 1.5, sm: 2.5, md: 3 },
            py: { xs: 1.25, sm: 1.5 },
            maxWidth: 1200,
            mx: 'auto',
            animation: 'annSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
            '@keyframes annSlideIn': {
              from: { opacity: 0, transform: 'translateY(6px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          {/* Media / icon */}
          {hasImage ? (
            <Box
              onClick={() => setShowImage(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowImage(true);
                }
              }}
              sx={{
                width: { xs: 56, sm: 72 },
                height: { xs: 56, sm: 72 },
                flexShrink: 0,
                borderRadius: '14px',
                overflow: 'hidden',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                alignSelf: 'center',
                transition: 'transform 0.2s ease',
                '&:hover': { transform: 'scale(1.03)' },
              }}
            >
              <OptimizedImage
                src={current.imageUrl!}
                alt=""
                width={72}
                height={72}
                objectFit="cover"
              />
            </Box>
          ) : (
            <Box
              aria-hidden
              sx={{
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                flexShrink: 0,
                borderRadius: '12px',
                bgcolor: `color-mix(in srgb, ${color} 16%, transparent)`,
                color,
                display: 'grid',
                placeItems: 'center',
                alignSelf: 'center',
                animation: isSpecial ? 'annIconSoft 2.8s ease-in-out infinite' : 'none',
                '@keyframes annIconSoft': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.06)' },
                },
              }}
            >
              {isSpecial && current.specialIcon ? (
                <Typography sx={{ fontSize: '1.15rem', lineHeight: 1 }}>{current.specialIcon}</Typography>
              ) : isSpecial ? (
                <Sparkles size={18} />
              ) : (
                <Megaphone size={18} />
              )}
            </Box>
          )}

          {/* Copy */}
          <Box sx={{ flex: 1, minWidth: 0, py: 0.15 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.35, flexWrap: 'wrap' }}>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color,
                }}
              >
                {t.announcement.sectionTitle}
              </Typography>
              {isSpecial && (
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    px: 0.7,
                    py: 0.15,
                    borderRadius: '6px',
                    bgcolor: `color-mix(in srgb, ${color} 18%, transparent)`,
                    color,
                  }}
                >
                  {lang === 'en' ? 'Important' : 'สำคัญ'}
                </Box>
              )}
              {enabled.length > 1 && (
                <Typography
                  component="span"
                  sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}
                >
                  {(currentIndex % enabled.length) + 1}/{enabled.length}
                </Typography>
              )}
            </Box>

            <Typography
              onClick={() => {
                if (isLongMessage) setExpanded((v) => !v);
                else openPrimary();
              }}
              sx={{
                fontSize: { xs: '0.9rem', sm: '0.95rem' },
                fontWeight: isSpecial ? 700 : 600,
                color: 'var(--foreground)',
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                cursor: isLongMessage || onProductClick || hasImage ? 'pointer' : 'default',
                ...(expanded
                  ? {}
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }),
              }}
            >
              {current.message || t.announcement.defaultTitle}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.65, flexWrap: 'wrap' }}>
              {current.linkedProductId && onProductClick ? (
                <Button
                  size="small"
                  onClick={() => onProductClick(current.linkedProductId!)}
                  endIcon={<ArrowUpRight size={14} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    px: 1.25,
                    py: 0.35,
                    minHeight: 30,
                    borderRadius: '10px',
                    bgcolor: color,
                    color: '#fff',
                    '&:hover': { bgcolor: color, filter: 'brightness(0.92)' },
                  }}
                >
                  {current.linkText || t.announcement.viewProducts}
                </Button>
              ) : current.link ? (
                <Button
                  size="small"
                  component="a"
                  href={current.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<ExternalLink size={13} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    px: 1.25,
                    py: 0.35,
                    minHeight: 30,
                    borderRadius: '10px',
                    bgcolor: `color-mix(in srgb, ${color} 16%, transparent)`,
                    color,
                    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                    '&:hover': {
                      bgcolor: `color-mix(in srgb, ${color} 24%, transparent)`,
                    },
                  }}
                >
                  {current.linkText || t.announcement.viewMore}
                </Button>
              ) : null}

              {(current.displayName || current.postedAt) && (
                <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {current.displayName ? `${current.displayName}` : ''}
                  {current.displayName && current.postedAt ? ' · ' : ''}
                  {current.postedAt
                    ? new Date(current.postedAt).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'short',
                      })
                    : ''}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Controls */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              gap: 0.25,
              flexShrink: 0,
              alignSelf: { xs: 'flex-start', sm: 'center' },
            }}
          >
            {enabled.length > 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  aria-label="Previous announcement"
                  onClick={() => goTo(currentIndex - 1)}
                  sx={{ color: 'var(--text-muted)', width: 30, height: 30 }}
                >
                  <ChevronLeft size={16} />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Next announcement"
                  onClick={() => goTo(currentIndex + 1)}
                  sx={{ color: 'var(--text-muted)', width: 30, height: 30 }}
                >
                  <ChevronRight size={16} />
                </IconButton>
              </Box>
            )}
            {history && history.length > 0 && (
              <IconButton
                size="small"
                aria-label={t.announcement.history}
                onClick={() => setShowHistory(true)}
                sx={{ color: 'var(--text-muted)', width: 30, height: 30, '&:hover': { color } }}
              >
                <History size={15} />
              </IconButton>
            )}
            <IconButton
              size="small"
              aria-label={t.common.close}
              onClick={handleDismiss}
              sx={{ color: 'var(--text-muted)', width: 30, height: 30, '&:hover': { color: '#ff453a' } }}
            >
              <X size={15} />
            </IconButton>
          </Box>
        </Box>

        {/* Dot rail */}
        {enabled.length > 1 && (
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              justifyContent: 'center',
              pb: 1,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {enabled.map((_, i) => {
              const active = i === currentIndex % enabled.length;
              return (
                <Box
                  key={i}
                  onClick={() => goTo(i)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Announcement ${i + 1}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goTo(i);
                    }
                  }}
                  sx={{
                    width: active ? 16 : 6,
                    height: 6,
                    borderRadius: 999,
                    bgcolor: active ? color : 'var(--glass-border)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                />
              );
            })}
          </Box>
        )}
      </Box>

      {activeNews.length > 0 && <SocialNewsStrip news={activeNews} />}

      {/* Image Lightbox */}
      <Dialog
        open={showImage}
        onClose={() => setShowImage(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(24px)',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden',
            maxHeight: '90vh',
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid var(--glass-border)',
            background: `linear-gradient(135deg, color-mix(in srgb, ${color} 12%, transparent) 0%, transparent 100%)`,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: `color-mix(in srgb, ${color} 20%, transparent)`,
              display: 'grid',
              placeItems: 'center',
              color,
            }}
          >
            <Megaphone size={18} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
              {t.announcement.sectionTitle}
            </Typography>
            {current.postedAt && (
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {new Date(current.postedAt).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setShowImage(false)} sx={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          {current.imageUrl && (
            <Box sx={{ width: '100%', maxHeight: '60vh', overflow: 'hidden' }}>
              <OptimizedImage
                src={current.imageUrl}
                alt="Announcement"
                width="100%"
                height="auto"
                objectFit="contain"
                style={{ maxHeight: '60vh' }}
              />
            </Box>
          )}
          {current.message && (
            <Box sx={{ p: 2.5 }}>
              <Typography
                sx={{
                  fontSize: '1rem',
                  color: 'var(--foreground)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {current.message}
              </Typography>
            </Box>
          )}
          {enabled.length > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
                px: 2,
                pb: 2,
              }}
            >
              <IconButton
                onClick={() => goTo(currentIndex - 1)}
                sx={{ bgcolor: 'var(--glass-bg)', color: 'var(--foreground)' }}
              >
                <ChevronLeft size={20} />
              </IconButton>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {(currentIndex % enabled.length) + 1} / {enabled.length}
              </Typography>
              <IconButton
                onClick={() => goTo(currentIndex + 1)}
                sx={{ bgcolor: 'var(--glass-bg)', color: 'var(--foreground)' }}
              >
                <ChevronRight size={20} />
              </IconButton>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid var(--glass-border)', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                bgcolor: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <History size={20} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1.1rem' }}>
                {t.announcement.history}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {history?.length || 0} {lang === 'en' ? 'items' : 'รายการ'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {history && history.length > 0 ? (
            <Box sx={{ py: 2 }}>
              {history.map((item, index) => {
                const itemColor = getColor(item.color);
                return (
                  <Box
                    key={item.id || index}
                    sx={{
                      mx: 2,
                      mb: 1.5,
                      p: 2,
                      pl: 2.25,
                      borderRadius: '14px',
                      bgcolor: 'var(--surface-2)',
                      border: '1px solid var(--glass-border)',
                      borderLeft: `3px solid ${itemColor}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mb: 1,
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Clock size={11} />
                      {item.postedAt
                        ? new Date(item.postedAt).toLocaleDateString(locale, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : t.announcement.noDate}
                    </Box>

                    {item.imageUrl && (
                      <Box sx={{ mb: 1, borderRadius: '10px', overflow: 'hidden' }}>
                        <OptimizedImage
                          src={item.imageUrl}
                          alt=""
                          width="100%"
                          height={120}
                          objectFit="cover"
                          borderRadius="10px"
                        />
                      </Box>
                    )}

                    {item.message && (
                      <Typography
                        sx={{
                          color: 'var(--foreground)',
                          fontSize: '0.88rem',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {item.message}
                      </Typography>
                    )}

                    {(item.displayName || item.postedBy) && (
                      <Typography sx={{ mt: 0.75, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        — {item.displayName || item.postedBy}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center', color: 'var(--text-muted)' }}>
              <History size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Typography>{t.announcement.noHistory}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid var(--glass-border)', p: 2 }}>
          <Button
            onClick={() => setShowHistory(false)}
            sx={{ color: 'var(--text-muted)', '&:hover': { bgcolor: 'var(--glass-bg)' } }}
          >
            {t.common.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
