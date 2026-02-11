'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Collapse,
} from '@mui/material';
import {
  Megaphone,
  X,
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Sparkles,
  Instagram,
  Facebook,
  Music,
  MessageCircle,
  ExternalLink,
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
  /** ข้อความพิเศษ (ตัวหนา/ขีดเส้นใต้/สำคัญ) */
  isSpecial?: boolean;
  /** ไอคอน emoji */
  specialIcon?: string;
  /** ลิงก์แนบ */
  link?: string;
  /** ข้อความปุ่มลิงก์ */
  linkText?: string;
  /** สินค้าที่เชื่อมโยง */
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

// ==================== Component ====================

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; gradient: string }> = {
  instagram: { label: 'Instagram', icon: <Instagram size={14} />, color: '#E4405F', gradient: 'linear-gradient(135deg, #833AB4 0%, #E4405F 50%, #FCAF45 100%)' },
  facebook: { label: 'Facebook', icon: <Facebook size={14} />, color: '#1877F2', gradient: 'linear-gradient(135deg, #1877F2 0%, #42A5F5 100%)' },
  tiktok: { label: 'TikTok', icon: <Music size={14} />, color: '#ff0050', gradient: 'linear-gradient(135deg, #010101 0%, #ff0050 100%)' },
  line: { label: 'LINE', icon: <MessageCircle size={14} />, color: '#06C755', gradient: 'linear-gradient(135deg, #06C755 0%, #4CAF50 100%)' },
};

export default function AnnouncementBar({ announcements, history, socialMediaNews, onProductClick }: AnnouncementBarProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const enabled = useMemo(
    () => announcements?.filter(a => a.enabled) || [],
    [announcements]
  );

  // Auto-cycle every 6s
  useEffect(() => {
    if (enabled.length <= 1) return;
    const id = setInterval(
      () => setCurrentIndex(prev => (prev + 1) % enabled.length),
      6000
    );
    return () => clearInterval(id);
  }, [enabled.length]);

  // Session-based dismiss
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('ann_dismissed')) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') sessionStorage.setItem('ann_dismissed', '1');
  };

  if (enabled.length === 0 || dismissed) {
    // Still show social media news even when no announcements
    const activeNews = socialMediaNews?.filter(n => n.enabled) || [];
    if (activeNews.length === 0) return null;
    return (
      <Box sx={{
        mx: { xs: 1.5, sm: 2 },
        mb: 1.5,
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
        pb: 0.5,
      }}>
        {activeNews.map((news) => {
          const platform = PLATFORM_CONFIG[news.platform] || PLATFORM_CONFIG.instagram;
          return (
            <Box
              key={news.id}
              component="a"
              href={news.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                flex: '0 0 auto',
                scrollSnapAlign: 'start',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 1,
                borderRadius: '14px',
                bgcolor: 'var(--glass-bg)',
                border: `1px solid ${platform.color}20`,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                minWidth: 0,
                maxWidth: { xs: '85vw', sm: 320 },
                '&:hover': { borderColor: `${platform.color}40`, transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${platform.color}15` },
              }}
            >
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: '10px',
                background: platform.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}>
                {platform.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.15 }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: platform.color }}>{platform.label}</Typography>
                  <Typography sx={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                    · {new Date(news.postedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {news.title}
                </Typography>
              </Box>
              <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </Box>
          );
        })}
      </Box>
    );
  }

  const current = enabled[currentIndex % enabled.length];
  if (!current) return null;
  const color = getColor(current.color);
  const hasImage = !!current.imageUrl;
  const isLongMessage = (current.message?.length || 0) > 80;
  const isSpecial = !!current.isSpecial;

  return (
    <>
      {/* Modern floating announcement bar */}
      <Box
        sx={{
        mx: { xs: 1.5, sm: 2 },
        mb: 1.5,
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        border: `1px solid ${isSpecial ? color + '50' : color + '30'}`,
        transition: 'all 0.3s ease',
        ...(isSpecial && {
          boxShadow: `0 0 20px ${color}20, 0 0 40px ${color}10`,
          animation: 'special-ann-glow 3s ease-in-out infinite',
          '@keyframes special-ann-glow': {
            '0%, 100%': { boxShadow: `0 0 20px ${color}20` },
            '50%': { boxShadow: `0 0 30px ${color}35` },
          },
        }),
      }}>
        {/* Subtle gradient background */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: isSpecial
            ? `linear-gradient(135deg, ${color}20 0%, ${color}10 50%, ${color}05 100%)`
            : `linear-gradient(135deg, ${color}12 0%, ${color}06 50%, transparent 100%)`,
        }} />

        {/* Left accent line */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: isSpecial ? 5 : 4,
          background: `linear-gradient(180deg, ${color}, ${color}88)`,
          borderRadius: '4px 0 0 4px',
          ...(isSpecial && {
            animation: 'special-line-pulse 2s ease-in-out infinite',
            '@keyframes special-line-pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.7 },
            },
          }),
        }} />

        {/* Content row */}
        <Box sx={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center',
          pl: 2, pr: 1, py: 1,
          gap: 1,
        }}>
          {/* Animated icon */}
          <Box sx={{
            width: 30, height: 30, flexShrink: 0,
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${color}25 0%, ${color}15 100%)`,
            display: 'grid', placeItems: 'center',
            animation: 'ann-pulse 3s ease-in-out infinite',
            '@keyframes ann-pulse': {
              '0%, 100%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.08)' },
            },
          }}>
            {isSpecial && current.specialIcon ? (
              <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{current.specialIcon}</Typography>
            ) : isSpecial ? (
              <Sparkles size={14} style={{ color }} />
            ) : (
              <Megaphone size={14} style={{ color }} />
            )}
          </Box>

          {/* Thumbnail */}
          {hasImage && (
            <Box
              onClick={() => setShowImage(true)}
              sx={{
                width: 36, height: 36, flexShrink: 0,
                borderRadius: '10px',
                overflow: 'hidden',
                border: `2px solid ${color}30`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'scale(1.08)', borderColor: color },
              }}
            >
              <OptimizedImage src={current.imageUrl!} alt="" width={36} height={36} objectFit="cover" />
            </Box>
          )}

          {/* Message */}
          <Box
            onClick={() => {
              if (onProductClick) {
                onProductClick(current.linkedProductId || '__default__');
              }
            }}
            sx={{
              flex: 1, minWidth: 0,
              cursor: onProductClick ? 'pointer' : 'default',
              '&:active': onProductClick ? { opacity: 0.7 } : {},
            }}
          >
            <Typography
              onClick={isLongMessage ? (e: React.MouseEvent) => { e.stopPropagation(); setExpanded(!expanded); } : hasImage ? (e: React.MouseEvent) => { e.stopPropagation(); setShowImage(true); } : undefined}
              sx={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--foreground)',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...(expanded ? {} : {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }),
                cursor: 'pointer',
              }}
            >
              {current.message || t.announcement.defaultTitle}
            </Typography>
            {/* Link / Product button */}
            {current.linkedProductId && onProductClick ? (
              <Box
                component="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onProductClick(current.linkedProductId!); }}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: color,
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.5,
                  mt: 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  minHeight: 28,
                  fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': { background: `${color}25`, borderColor: `${color}50` },
                  '&:active': { transform: 'scale(0.96)' },
                }}
              >
                {current.linkText || t.announcement.viewProducts}
              </Box>
            ) : current.link && (
              <Typography
                component="a"
                href={current.link}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: color,
                  textDecoration: 'none',
                  mt: 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {current.linkText || t.announcement.viewMore}
              </Typography>
            )}
            {current.displayName && (
              <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', mt: 0.15 }}>
                — {current.displayName}
                {current.postedAt && ` · ${new Date(current.postedAt).toLocaleDateString('th-TH', {
                  day: 'numeric', month: 'short',
                })}`}
              </Typography>
            )}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            {/* Navigation */}
            {enabled.length > 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton size="small" onClick={() => setCurrentIndex(p => (p - 1 + enabled.length) % enabled.length)}
                  sx={{ color: 'var(--text-muted)', width: 24, height: 24 }}>
                  <ChevronLeft size={14} />
                </IconButton>
                <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 24, textAlign: 'center' }}>
                  {(currentIndex % enabled.length) + 1}/{enabled.length}
                </Typography>
                <IconButton size="small" onClick={() => setCurrentIndex(p => (p + 1) % enabled.length)}
                  sx={{ color: 'var(--text-muted)', width: 24, height: 24 }}>
                  <ChevronRight size={14} />
                </IconButton>
              </Box>
            )}

            {/* History */}
            {history && history.length > 0 && (
              <IconButton size="small" onClick={() => setShowHistory(true)}
                sx={{ color: 'var(--text-muted)', width: 26, height: 26, '&:hover': { color } }}>
                <History size={13} />
              </IconButton>
            )}

            {/* Dismiss */}
            <IconButton size="small" onClick={handleDismiss}
              sx={{ color: 'var(--text-muted)', width: 26, height: 26, '&:hover': { color: '#ff453a' } }}>
              <X size={13} />
            </IconButton>
          </Box>
        </Box>

        {/* Dots indicator (bottom) */}
        {enabled.length > 1 && (
          <Box sx={{
            display: 'flex', gap: 0.4, justifyContent: 'center',
            pb: 0.75, pt: 0,
          }}>
            {enabled.map((_, i) => (
              <Box key={i} onClick={() => setCurrentIndex(i)} sx={{
                width: i === currentIndex % enabled.length ? 14 : 5,
                height: 4,
                borderRadius: '2px',
                bgcolor: i === currentIndex % enabled.length ? color : `${color}40`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </Box>
        )}
      </Box>

      {/* Social Media News Feed */}
      {socialMediaNews && socialMediaNews.filter(n => n.enabled).length > 0 && (
        <Box sx={{
          mx: { xs: 1.5, sm: 2 },
          mb: 1.5,
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          pb: 0.5,
        }}>
          {socialMediaNews.filter(n => n.enabled).map((news) => {
            const platform = PLATFORM_CONFIG[news.platform] || PLATFORM_CONFIG.instagram;
            return (
              <Box
                key={news.id}
                component="a"
                href={news.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  flex: '0 0 auto',
                  scrollSnapAlign: 'start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.5,
                  py: 1,
                  borderRadius: '14px',
                  bgcolor: 'var(--glass-bg)',
                  border: `1px solid ${platform.color}20`,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  minWidth: 0,
                  maxWidth: { xs: '85vw', sm: 320 },
                  '&:hover': { borderColor: `${platform.color}40`, transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${platform.color}15` },
                }}
              >
                <Box sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: platform.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {platform.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.15 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: platform.color }}>
                      {platform.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                      · {new Date(news.postedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </Typography>
                  </Box>
                  <Typography sx={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {news.title}
                  </Typography>
                  {news.description && (
                    <Typography sx={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {news.description}
                    </Typography>
                  )}
                </Box>
                <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </Box>
            );
          })}
        </Box>
      )}

      {/* Image Lightbox */}
      <Dialog
        open={showImage} onClose={() => setShowImage(false)}
        maxWidth="md" fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(24px)',
            borderRadius: '24px',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden',
            maxHeight: '90vh',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid var(--glass-border)',
          background: `linear-gradient(135deg, ${color}12 0%, transparent 100%)`,
        }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            background: `linear-gradient(135deg, ${color}30, ${color}15)`,
            display: 'grid', placeItems: 'center',
          }}>
            <Megaphone size={18} style={{ color }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
              {t.announcement.sectionTitle}
            </Typography>
            {current.postedAt && (
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {new Date(current.postedAt).toLocaleDateString('th-TH', {
                  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setShowImage(false)} sx={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          {/* Image */}
          {current.imageUrl && (
            <Box sx={{ width: '100%', maxHeight: '60vh', overflow: 'hidden' }}>
              <OptimizedImage
                src={current.imageUrl} alt="Announcement"
                width="100%" height="auto" objectFit="contain"
                style={{ maxHeight: '60vh' }}
              />
            </Box>
          )}
          {/* Message */}
          {current.message && (
            <Box sx={{ p: 2.5 }}>
              <Typography sx={{
                fontSize: '1rem', color: 'var(--foreground)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>
                {current.message}
              </Typography>
            </Box>
          )}
          {/* Navigation */}
          {enabled.length > 1 && (
            <Box sx={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 2, px: 2, pb: 2,
            }}>
              <IconButton onClick={() => setCurrentIndex(p => (p - 1 + enabled.length) % enabled.length)}
                sx={{ bgcolor: 'var(--glass-bg)', color: 'var(--foreground)' }}>
                <ChevronLeft size={20} />
              </IconButton>
              <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {(currentIndex % enabled.length) + 1} / {enabled.length}
              </Typography>
              <IconButton onClick={() => setCurrentIndex(p => (p + 1) % enabled.length)}
                sx={{ bgcolor: 'var(--glass-bg)', color: 'var(--foreground)' }}>
                <ChevronRight size={20} />
              </IconButton>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={showHistory} onClose={() => setShowHistory(false)}
        maxWidth="sm" fullWidth
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
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px',
              background: 'linear-gradient(135deg, #0077ED, #0071e3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <History size={20} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1.1rem' }}>
                {t.announcement.history}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {history?.length || 0} รายการ
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
                  <Box key={item.id || index} sx={{
                    mx: 2, mb: 1.5, p: 2,
                    borderRadius: '14px',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Color accent */}
                    <Box sx={{
                      position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
                      bgcolor: itemColor, borderRadius: '4px 0 0 4px',
                    }} />

                    {/* Date */}
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      px: 1, py: 0.25, mb: 1, borderRadius: '6px',
                      bgcolor: 'var(--glass-bg)', fontSize: '0.7rem', color: 'var(--text-muted)',
                    }}>
                      <Clock size={11} />
                      {item.postedAt
                        ? new Date(item.postedAt).toLocaleDateString('th-TH', {
                            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })
                        : t.announcement.noDate}
                    </Box>

                    {/* Image */}
                    {item.imageUrl && (
                      <Box sx={{ mb: 1, borderRadius: '10px', overflow: 'hidden' }}>
                        <OptimizedImage src={item.imageUrl} alt="" width="100%" height={120} objectFit="cover" borderRadius="10px" />
                      </Box>
                    )}

                    {/* Message */}
                    {item.message && (
                      <Typography sx={{ color: 'var(--foreground)', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
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
          <Button onClick={() => setShowHistory(false)} sx={{ color: 'var(--text-muted)', '&:hover': { bgcolor: 'var(--glass-bg)' } }}>
            {t.common.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
