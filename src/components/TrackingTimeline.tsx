'use client';

import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import { Truck as ShippingIcon, CheckCircle2 as CheckCircle, Clock as Schedule, AlertCircle as ErrorIcon, Package as Inventory, Bike as DeliveryDining, Home, RotateCcw as Refresh, ChevronDown as ExpandMore, ChevronUp as ExpandLess, ExternalLink as OpenInNew } from 'lucide-react';
import { 
  TrackingInfo, 
  TrackingStatus, 
  TrackingEvent,
  TRACKING_STATUS_THAI,
  SHIPPING_PROVIDERS,
  ShippingProvider,
} from '@/lib/shipping';

interface TrackingTimelineProps {
  trackingNumber: string;
  shippingProvider: ShippingProvider;
  /** Pre-loaded tracking info (optional) */
  initialData?: TrackingInfo | null;
  /** Compact mode for inline display */
  compact?: boolean;
}

const STATUS_ICONS: Record<TrackingStatus, React.ReactNode> = {
  pending: <Schedule size={24} color="#f59e0b" />,
  picked_up: <Inventory size={24} color="#3b82f6" />,
  in_transit: <ShippingIcon size={24} color="#3b82f6" />,
  out_for_delivery: <DeliveryDining size={24} color="#1e40af" />,
  delivered: <Home size={24} color="#10b981" />,
  returned: <ErrorIcon size={24} color="#ef4444" />,
  failed: <ErrorIcon size={24} color="#ef4444" />,
  unknown: <Schedule size={24} color="#6b7280" />,
};

const STATUS_COLORS: Record<TrackingStatus, string> = {
  pending: '#f59e0b',
  picked_up: '#3b82f6',
  in_transit: '#3b82f6',
  out_for_delivery: '#1e40af',
  delivered: '#10b981',
  returned: '#ef4444',
  failed: '#ef4444',
  unknown: '#6b7280',
};

export default function TrackingTimeline({
  trackingNumber,
  shippingProvider,
  initialData,
  compact = false,
}: TrackingTimelineProps) {
  const [trackingInfo, setTrackingInfo] = React.useState<TrackingInfo | null>(initialData || null);
  const [loading, setLoading] = React.useState(!initialData);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(!compact);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchTracking = React.useCallback(async (showRefresh = false) => {
    if (!trackingNumber || shippingProvider === 'pickup') return;
    
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/shipping/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber,
          provider: shippingProvider,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'ไม่สามารถดึงข้อมูลติดตามได้');
      }

      const result = await res.json();
      
      // API returns { success: true, data: trackingInfo }
      if (result.success && result.data) {
        setTrackingInfo(result.data);
      } else if (result.error) {
        throw new Error(result.error);
      } else {
        // Fallback for direct response format
        setTrackingInfo(result);
      }
    } catch (err) {
      console.error('Fetch tracking error:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trackingNumber, shippingProvider]);

  React.useEffect(() => {
    if (!initialData && trackingNumber && shippingProvider !== 'pickup') {
      fetchTracking();
    }
  }, [initialData, trackingNumber, shippingProvider, fetchTracking]);

  const providerInfo = SHIPPING_PROVIDERS[shippingProvider];

  // Pickup mode - no tracking
  if (shippingProvider === 'pickup') {
    return (
      <Box sx={{ p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle size={24} color="#10b981" />
          <Typography sx={{ color: '#10b981', fontWeight: 600 }}>
            รับสินค้าหน้าร้าน
          </Typography>
        </Box>
      </Box>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
        <CircularProgress size={24} sx={{ color: '#3b82f6' }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          กำลังโหลดข้อมูลติดตาม...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    const trackingUrl = SHIPPING_PROVIDERS[shippingProvider]?.trackingUrlTemplate?.replace('{tracking}', trackingNumber) || '';
    return (
      <Box sx={{ p: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ErrorIcon size={20} color="#ef4444" />
            <Typography sx={{ color: '#ef4444', fontSize: 14 }}>
              {error}
            </Typography>
          </Box>
          <IconButton 
            size="small" 
            onClick={() => fetchTracking(true)}
            sx={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <Refresh size={20} />
          </IconButton>
        </Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, mt: 1 }}>
          หมายเลขพัสดุ: {trackingNumber}
        </Typography>
        
        {/* Fallback link to courier website */}
        {trackingUrl && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, mb: 1 }}>
              ไม่สามารถโหลดข้อมูลได้? ตรวจสอบสถานะโดยตรงที่เว็บขนส่ง:
            </Typography>
            <Box
              component="a"
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: '10px',
                bgcolor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#60a5fa',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(59, 130, 246, 0.25)',
                  borderColor: 'rgba(59, 130, 246, 0.5)',
                },
              }}
            >
              <ShippingIcon size={18} />
              ตรวจสอบที่ {SHIPPING_PROVIDERS[shippingProvider]?.nameThai || 'ขนส่ง'}
              <OpenInNew size={14} />
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  // No tracking info yet
  if (!trackingInfo) {
    return (
      <Box sx={{ p: 2, bgcolor: 'rgba(107, 114, 128, 0.1)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule size={24} color="#6b7280" />
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
            รอข้อมูลจากขนส่ง
          </Typography>
        </Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, mt: 1 }}>
          หมายเลขพัสดุ: {trackingNumber}
        </Typography>
      </Box>
    );
  }

  const currentStatus = trackingInfo.status;
  const events = trackingInfo.events || [];

  return (
    <Box sx={{ 
      bgcolor: 'rgba(30, 41, 59, 0.5)', 
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: compact ? 'pointer' : 'default',
          '&:hover': compact ? { bgcolor: 'rgba(255,255,255,0.03)' } : {},
        }}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
          {STATUS_ICONS[currentStatus]}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ 
                color: STATUS_COLORS[currentStatus], 
                fontWeight: 600,
                fontSize: 15,
              }}>
                {TRACKING_STATUS_THAI[currentStatus]}
              </Typography>
              <Chip
                label={providerInfo?.nameThai || shippingProvider}
                size="small"
                sx={{
                  bgcolor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  fontSize: 11,
                  height: 20,
                }}
              />
            </Box>
            <Typography sx={{ 
              color: 'rgba(255,255,255,0.5)', 
              fontSize: 12,
              mt: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {trackingNumber}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {refreshing ? (
            <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.4)' }} />
          ) : (
            <IconButton 
              size="small" 
              onClick={(e) => { e.stopPropagation(); fetchTracking(true); }}
              sx={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <Refresh size={20} />
            </IconButton>
          )}
          {compact && (
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              {expanded ? <ExpandLess size={24} /> : <ExpandMore size={24} />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Timeline */}
      <Collapse in={expanded}>
        {events.length > 0 ? (
          <Box sx={{ px: 2, pb: 2 }}>
            {/* Progress Steps */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              mb: 3,
              position: 'relative',
            }}>
              {/* Progress Line */}
              <Box sx={{
                position: 'absolute',
                top: 12,
                left: '10%',
                right: '10%',
                height: 2,
                bgcolor: 'rgba(255,255,255,0.1)',
                zIndex: 0,
              }}>
                <Box sx={{
                  width: getProgressWidth(currentStatus),
                  height: '100%',
                  bgcolor: STATUS_COLORS[currentStatus],
                  transition: 'width 0.3s ease',
                }} />
              </Box>
              
              {/* Steps */}
              {[
                { status: 'picked_up' as TrackingStatus, label: 'รับพัสดุ' },
                { status: 'in_transit' as TrackingStatus, label: 'กำลังส่ง' },
                { status: 'out_for_delivery' as TrackingStatus, label: 'นำส่ง' },
                { status: 'delivered' as TrackingStatus, label: 'สำเร็จ' },
              ].map((step, idx) => {
                const isCompleted = isStatusCompleted(currentStatus, step.status);
                const isCurrent = currentStatus === step.status;
                return (
                  <Box 
                    key={step.status} 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      zIndex: 1,
                    }}
                  >
                    <Box sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: isCompleted || isCurrent 
                        ? STATUS_COLORS[currentStatus] 
                        : 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isCurrent ? `2px solid ${STATUS_COLORS[currentStatus]}` : 'none',
                      boxShadow: isCurrent ? `0 0 8px ${STATUS_COLORS[currentStatus]}50` : 'none',
                    }}>
                      {isCompleted && (
                        <CheckCircle size={16} color="#fff" />
                      )}
                    </Box>
                    <Typography sx={{
                      fontSize: 10,
                      color: isCompleted || isCurrent 
                        ? STATUS_COLORS[currentStatus] 
                        : 'rgba(255,255,255,0.4)',
                      mt: 0.5,
                      fontWeight: isCurrent ? 600 : 400,
                    }}>
                      {step.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Event List */}
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {events.slice(0, 10).map((event, idx) => (
                <EventItem key={idx} event={event} isLatest={idx === 0} />
              ))}
              {events.length > 10 && (
                <Typography sx={{ 
                  color: 'rgba(255,255,255,0.4)', 
                  fontSize: 11, 
                  textAlign: 'center',
                  mt: 1,
                }}>
                  +{events.length - 10} รายการก่อนหน้า
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              ยังไม่มีข้อมูลการเคลื่อนไหวพัสดุ
            </Typography>
          </Box>
        )}
        
        {/* Last Update */}
        {trackingInfo.lastUpdate && (
          <Box sx={{ 
            px: 2, 
            py: 1, 
            bgcolor: 'rgba(0,0,0,0.2)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
              อัปเดตล่าสุด: {formatDate(trackingInfo.lastUpdate)}
            </Typography>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

// Helper Components
function EventItem({ event, isLatest }: { event: TrackingEvent; isLatest: boolean }) {
  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      py: 1,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      '&:last-child': { borderBottom: 'none' },
    }}>
      <Box sx={{ 
        width: 8, 
        height: 8, 
        borderRadius: '50%', 
        bgcolor: isLatest ? STATUS_COLORS[event.status] : 'rgba(255,255,255,0.3)',
        mt: 0.5,
        flexShrink: 0,
      }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ 
          color: isLatest ? '#fff' : 'rgba(255,255,255,0.7)', 
          fontSize: 13,
          fontWeight: isLatest ? 500 : 400,
          lineHeight: 1.4,
        }}>
          {event.descriptionThai || event.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            {formatDate(event.timestamp)}
          </Typography>
          {event.location && (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
              {event.location}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// Helper functions
function getProgressWidth(status: TrackingStatus): string {
  switch (status) {
    case 'pending': return '0%';
    case 'picked_up': return '25%';
    case 'in_transit': return '50%';
    case 'out_for_delivery': return '75%';
    case 'delivered': return '100%';
    case 'returned':
    case 'failed':
      return '100%';
    default: return '0%';
  }
}

function isStatusCompleted(current: TrackingStatus, target: TrackingStatus): boolean {
  const order: TrackingStatus[] = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  const currentIdx = order.indexOf(current);
  const targetIdx = order.indexOf(target);
  if (currentIdx === -1 || targetIdx === -1) return false;
  return currentIdx > targetIdx;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
