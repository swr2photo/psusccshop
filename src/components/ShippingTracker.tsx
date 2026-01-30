'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Link,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  LocalShipping,
  Search,
  OpenInNew,
  ContentCopy,
  CheckCircle,
  Schedule,
  Flight,
  Home,
  Error,
  Refresh,
} from '@mui/icons-material';
import {
  TrackingInfo,
  TrackingStatus,
  SHIPPING_PROVIDERS,
  TRACKING_STATUS_THAI,
  ShippingProvider,
} from '@/lib/shipping';

interface ShippingTrackerProps {
  initialProvider?: ShippingProvider;
  initialTrackingNumber?: string;
  compact?: boolean;
}

const STATUS_ICONS: Record<TrackingStatus, React.ReactNode> = {
  pending: <Schedule sx={{ fontSize: 18 }} />,
  picked_up: <Flight sx={{ fontSize: 18 }} />,
  in_transit: <LocalShipping sx={{ fontSize: 18 }} />,
  out_for_delivery: <LocalShipping sx={{ fontSize: 18, color: '#22d3ee' }} />,
  delivered: <CheckCircle sx={{ fontSize: 18, color: '#22c55e' }} />,
  returned: <Error sx={{ fontSize: 18, color: '#f59e0b' }} />,
  failed: <Error sx={{ fontSize: 18, color: '#ef4444' }} />,
  unknown: <Schedule sx={{ fontSize: 18 }} />,
};

const STATUS_COLORS: Record<TrackingStatus, string> = {
  pending: '#94a3b8',
  picked_up: '#a78bfa',
  in_transit: '#60a5fa',
  out_for_delivery: '#22d3ee',
  delivered: '#22c55e',
  returned: '#f59e0b',
  failed: '#ef4444',
  unknown: '#94a3b8',
};

export default function ShippingTracker({
  initialProvider,
  initialTrackingNumber,
  compact = false,
}: ShippingTrackerProps) {
  const [provider, setProvider] = useState<ShippingProvider>(initialProvider || 'thailand_post');
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber || '');
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTrack = async () => {
    if (!trackingNumber.trim()) {
      setError('กรุณาใส่เลขพัสดุ');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/shipping/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          trackingNumber: trackingNumber.trim(),
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setTrackingInfo(data.data);
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูลได้');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openExternalTracking = () => {
    if (trackingInfo?.trackingUrl) {
      window.open(trackingInfo.trackingUrl, '_blank');
    }
  };

  return (
    <Card sx={{
      bgcolor: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
    }}>
      <CardContent sx={{ p: compact ? 2 : 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <LocalShipping sx={{ fontSize: 28, color: '#8b5cf6' }} />
          <Typography variant="h6" fontWeight="bold">
            ติดตามพัสดุ
          </Typography>
        </Box>

        {/* Search Form */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              flexWrap: 'wrap',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              p: 1,
            }}>
              {Object.entries(SHIPPING_PROVIDERS)
                .filter(([key]) => key !== 'pickup' && key !== 'custom')
                .map(([key, info]) => (
                <Chip
                  key={key}
                  label={info.nameThai}
                  onClick={() => setProvider(key as ShippingProvider)}
                  sx={{
                    bgcolor: provider === key ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${provider === key ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: provider === key ? '#a78bfa' : '#94a3b8',
                    '&:hover': {
                      bgcolor: 'rgba(139, 92, 246, 0.2)',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              placeholder="ใส่เลขพัสดุ"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                },
                '& .MuiInputBase-input': { color: '#fff' },
              }}
              InputProps={{
                endAdornment: trackingNumber && (
                  <Tooltip title={copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}>
                    <IconButton size="small" onClick={handleCopyTracking}>
                      <ContentCopy sx={{ fontSize: 18, color: copied ? '#22c55e' : '#94a3b8' }} />
                    </IconButton>
                  </Tooltip>
                ),
              }}
            />
            <Button
              variant="contained"
              onClick={handleTrack}
              disabled={loading || !trackingNumber.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Search />}
              sx={{
                minWidth: '120px',
                borderRadius: '12px',
                bgcolor: '#8b5cf6',
                '&:hover': { bgcolor: '#7c3aed' },
              }}
            >
              {loading ? 'กำลังค้นหา' : 'ค้นหา'}
            </Button>
          </Box>
        </Stack>

        {/* Error */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              bgcolor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            {error}
          </Alert>
        )}

        {/* Tracking Result */}
        {trackingInfo && (
          <Box>
            {/* Status Summary */}
            <Card sx={{
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${STATUS_COLORS[trackingInfo.status]}33`,
              borderRadius: '12px',
              mb: 3,
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {STATUS_ICONS[trackingInfo.status]}
                      <Typography variant="h6" fontWeight="bold" sx={{ color: STATUS_COLORS[trackingInfo.status] }}>
                        {trackingInfo.statusTextThai || TRACKING_STATUS_THAI[trackingInfo.status]}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      อัปเดตล่าสุด: {new Date(trackingInfo.lastUpdate).toLocaleString('th-TH')}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Tooltip title="รีเฟรช">
                      <IconButton onClick={handleTrack} disabled={loading}>
                        <Refresh sx={{ color: '#94a3b8' }} />
                      </IconButton>
                    </Tooltip>
                    {trackingInfo.track123Url && (
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                        onClick={() => window.open(trackingInfo.track123Url, '_blank')}
                        sx={{
                          borderColor: 'rgba(139, 92, 246, 0.3)',
                          color: '#a78bfa',
                          '&:hover': {
                            borderColor: '#8b5cf6',
                            color: '#8b5cf6',
                            bgcolor: 'rgba(139, 92, 246, 0.1)',
                          },
                        }}
                      >
                        Track123
                      </Button>
                    )}
                    {trackingInfo.trackingUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                        onClick={openExternalTracking}
                        sx={{
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                          color: '#94a3b8',
                          '&:hover': {
                            borderColor: '#8b5cf6',
                            color: '#8b5cf6',
                          },
                        }}
                      >
                        เว็บไซต์ขนส่ง
                      </Button>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            {trackingInfo.events.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, color: '#94a3b8' }}>
                  ประวัติการเคลื่อนไหว
                </Typography>
                <Stepper orientation="vertical" sx={{ ml: 1 }}>
                  {trackingInfo.events.map((event, index) => (
                    <Step key={index} active completed={index > 0}>
                      <StepLabel
                        StepIconComponent={() => (
                          <Box sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: index === 0 ? `${STATUS_COLORS[event.status]}33` : 'rgba(255, 255, 255, 0.05)',
                            border: `2px solid ${index === 0 ? STATUS_COLORS[event.status] : 'rgba(255, 255, 255, 0.1)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Box sx={{ color: index === 0 ? STATUS_COLORS[event.status] : '#94a3b8' }}>
                              {STATUS_ICONS[event.status]}
                            </Box>
                          </Box>
                        )}
                      >
                        <Box>
                          <Typography fontWeight={index === 0 ? 'bold' : 'normal'}>
                            {event.descriptionThai || event.description}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {new Date(event.timestamp).toLocaleString('th-TH')}
                            {event.location && ` • ${event.location}`}
                          </Typography>
                        </Box>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            ) : (
              <Alert 
                severity="info" 
                sx={{ 
                  bgcolor: 'rgba(59, 130, 246, 0.1)', 
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                <Typography variant="body2">
                  ยังไม่มีข้อมูลการเคลื่อนไหว กรุณาลองตรวจสอบที่เว็บไซต์ขนส่งโดยตรง
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  {trackingInfo.track123Url && (
                    <Button
                      size="small"
                      onClick={() => window.open(trackingInfo.track123Url, '_blank')}
                      sx={{ color: '#a78bfa' }}
                    >
                      ดูที่ Track123 →
                    </Button>
                  )}
                  {trackingInfo.trackingUrl && (
                    <Button
                      size="small"
                      onClick={openExternalTracking}
                      sx={{ color: '#60a5fa' }}
                    >
                      ไปที่เว็บไซต์ขนส่ง →
                    </Button>
                  )}
                </Box>
              </Alert>
            )}
          </Box>
        )}

        {/* Quick Links */}
        {!trackingInfo && !loading && (
          <Box sx={{ 
            mt: 3, 
            pt: 3, 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
              ลิงก์ติดตามพัสดุโดยตรง:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(SHIPPING_PROVIDERS)
                .filter(([key, info]) => info.trackingUrlTemplate)
                .map(([key, info]) => (
                <Link
                  key={key}
                  href={info.trackingUrlTemplate.replace('{tracking}', '')}
                  target="_blank"
                  sx={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    '&:hover': { color: '#8b5cf6' },
                  }}
                >
                  {info.nameThai} ↗
                </Link>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
