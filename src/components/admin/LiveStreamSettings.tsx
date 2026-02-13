'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Switch,
  Card,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Video,
  Play,
  Square,
  Radio,
  Eye,
  Link,
  Clock,
  Settings,
  MonitorPlay,
  Sparkles,
} from 'lucide-react';
import type { ShopConfig } from '@/lib/config';

interface LiveStreamSettingsProps {
  config: ShopConfig;
  saveConfig: (config: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail?: string | null;
}

// ==================== STYLES ====================
const glassCardSx = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  p: 3,
  mb: 3,
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiInputBase-input': { color: '#f5f5f7' },
};

const selectSx = {
  borderRadius: '12px',
  backgroundColor: 'rgba(255,255,255,0.03)',
  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
  '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  color: '#f5f5f7',
};

// ==================== HELPER ====================
function getStreamEmbedUrl(url: string, type: string): string {
  if (type === 'youtube') {
    // Support various YouTube URL formats
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1`;
    return url;
  }
  if (type === 'facebook') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true&mute=true`;
  }
  return url;
}

function getStreamTypeLabel(type: string): { label: string; color: string; icon: React.ReactNode } {
  switch (type) {
    case 'youtube': return { label: 'YouTube Live', color: '#ff0000', icon: <Play size={14} /> };
    case 'facebook': return { label: 'Facebook Live', color: '#1877f2', icon: <Video size={14} /> };
    case 'hls': return { label: 'HLS (OBS)', color: '#10b981', icon: <MonitorPlay size={14} /> };
    case 'custom': return { label: 'Custom URL', color: '#8b5cf6', icon: <Link size={14} /> };
    default: return { label: 'Unknown', color: '#64748b', icon: <Settings size={14} /> };
  }
}

// ==================== COMPONENT ====================
export default function LiveStreamSettings({ config, saveConfig, showToast, userEmail }: LiveStreamSettingsProps) {
  const [live, setLive] = useState({
    enabled: false,
    title: 'ไลฟ์สดขายของ SCC SHOP',
    description: '',
    streamUrl: '',
    streamType: 'youtube' as 'hls' | 'youtube' | 'facebook' | 'custom',
    thumbnailUrl: '',
    autoPopup: true,
    featuredProducts: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load from config
  useEffect(() => {
    if (config.liveStream) {
      setLive({
        enabled: config.liveStream.enabled || false,
        title: config.liveStream.title || 'ไลฟ์สดขายของ SCC SHOP',
        description: config.liveStream.description || '',
        streamUrl: config.liveStream.streamUrl || '',
        streamType: config.liveStream.streamType || 'youtube',
        thumbnailUrl: config.liveStream.thumbnailUrl || '',
        autoPopup: config.liveStream.autoPopup ?? true,
        featuredProducts: config.liveStream.featuredProducts || [],
      });
    }
  }, [config.liveStream]);

  const handleSave = async () => {
    if (live.enabled && !live.streamUrl.trim()) {
      showToast('error', 'กรุณาใส่ URL ของไลฟ์สตรีม');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveStream: live }),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      showToast('success', live.enabled ? '🔴 เปิดไลฟ์สดแล้ว!' : 'ปิดไลฟ์สดแล้ว');
      
      // Also update the parent config
      await saveConfig({
        ...config,
        liveStream: {
          ...live,
          startedAt: live.enabled ? (config.liveStream?.startedAt || new Date().toISOString()) : undefined,
          updatedBy: userEmail || undefined,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Save live stream error:', error);
      showToast('error', 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleGoLive = async () => {
    const newState = { ...live, enabled: !live.enabled };
    setLive(newState);
    
    // Auto-save when toggling live
    setSaving(true);
    try {
      const res = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveStream: newState }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast(newState.enabled ? 'success' : 'info', newState.enabled ? '🔴 กำลังไลฟ์สด!' : '⏹ หยุดไลฟ์สดแล้ว');
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
      setLive(live); // rollback
    } finally {
      setSaving(false);
    }
  };

  const streamTypeInfo = getStreamTypeLabel(live.streamType);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '14px',
            background: live.enabled ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: live.enabled ? 'pulse 2s ease-in-out infinite' : 'none',
          }}>
            <Video size={24} color={live.enabled ? '#fff' : '#64748b'} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ color: '#f5f5f7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              ไลฟ์สด
              {live.enabled && (
                <Chip
                  label="LIVE"
                  size="small"
                  sx={{
                    bgcolor: '#ef4444',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 22,
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.6 },
                    },
                  }}
                />
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              จัดการไลฟ์สดขายของผ่าน OBS หรือ YouTube/Facebook Live
            </Typography>
          </Box>
        </Box>

        {/* GO LIVE button */}
        <Button
          variant="contained"
          onClick={handleGoLive}
          disabled={saving || (!live.enabled && !live.streamUrl.trim())}
          startIcon={live.enabled ? <Square size={16} /> : <Radio size={16} />}
          sx={{
            borderRadius: '14px',
            px: 3,
            py: 1.5,
            fontWeight: 700,
            fontSize: '0.9rem',
            background: live.enabled
              ? 'linear-gradient(135deg, #64748b, #475569)'
              : 'linear-gradient(135deg, #ef4444, #dc2626)',
            '&:hover': {
              background: live.enabled
                ? 'linear-gradient(135deg, #475569, #334155)'
                : 'linear-gradient(135deg, #dc2626, #b91c1c)',
            },
            textTransform: 'none',
          }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : live.enabled ? 'หยุดไลฟ์' : 'เริ่มไลฟ์สด'}
        </Button>
      </Box>

      {/* Stream Configuration */}
      <Card sx={glassCardSx}>
        <Typography variant="subtitle1" sx={{ color: '#f5f5f7', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings size={18} /> ตั้งค่าสตรีม
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Stream Type */}
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>ประเภทสตรีม</InputLabel>
            <Select
              value={live.streamType}
              onChange={(e) => setLive({ ...live, streamType: e.target.value as typeof live.streamType })}
              label="ประเภทสตรีม"
              sx={selectSx}
            >
              <MenuItem value="youtube">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Play size={16} color="#ff0000" /> YouTube Live
                </Box>
              </MenuItem>
              <MenuItem value="facebook">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Video size={16} color="#1877f2" /> Facebook Live
                </Box>
              </MenuItem>
              <MenuItem value="hls">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MonitorPlay size={16} color="#10b981" /> HLS Stream (OBS → RTMP Server)
                </Box>
              </MenuItem>
              <MenuItem value="custom">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Link size={16} color="#8b5cf6" /> Custom Embed URL
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          {/* Stream URL */}
          <TextField
            fullWidth
            size="small"
            label={
              live.streamType === 'youtube' ? 'YouTube Live URL' :
              live.streamType === 'facebook' ? 'Facebook Live URL' :
              live.streamType === 'hls' ? 'HLS Stream URL (.m3u8)' :
              'Embed URL'
            }
            placeholder={
              live.streamType === 'youtube' ? 'https://www.youtube.com/watch?v=... หรือ https://youtu.be/...' :
              live.streamType === 'facebook' ? 'https://www.facebook.com/.../videos/...' :
              live.streamType === 'hls' ? 'https://your-server.com/live/stream.m3u8' :
              'https://...'
            }
            value={live.streamUrl}
            onChange={(e) => setLive({ ...live, streamUrl: e.target.value })}
            sx={inputSx}
          />

          {/* OBS Instructions */}
          {live.streamType === 'hls' && (
            <Alert severity="info" sx={{ 
              borderRadius: '12px', 
              bgcolor: 'rgba(59,130,246,0.1)', 
              color: '#93c5fd',
              '& .MuiAlert-icon': { color: '#60a5fa' },
            }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>วิธีใช้ OBS → HLS:</Typography>
              <Typography variant="caption" component="div">
                1. ตั้ง RTMP Server (เช่น nginx-rtmp หรือ Cloudflare Stream)<br/>
                2. ใน OBS → Settings → Stream → Service: Custom → Server: rtmp://your-server/live<br/>
                3. ใส่ Stream Key<br/>
                4. ใส่ HLS URL ที่ได้จาก server ในช่องด้านบน
              </Typography>
            </Alert>
          )}

          {live.streamType === 'youtube' && (
            <Alert severity="info" sx={{ 
              borderRadius: '12px', 
              bgcolor: 'rgba(239,68,68,0.1)', 
              color: '#fca5a5',
              '& .MuiAlert-icon': { color: '#f87171' },
            }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>วิธีใช้ OBS → YouTube Live:</Typography>
              <Typography variant="caption" component="div">
                1. ไปที่ YouTube Studio → Go Live → Stream<br/>
                2. คัดลอก Stream Key ไปใส่ใน OBS → Settings → Stream → YouTube<br/>
                3. เริ่มสตรีมใน OBS แล้วคัดลอก Live URL มาใส่ในช่องด้านบน<br/>
                4. รองรับ: youtube.com/watch?v=xxx, youtu.be/xxx, youtube.com/live/xxx
              </Typography>
            </Alert>
          )}

          {/* Title & Description */}
          <TextField
            fullWidth
            size="small"
            label="ชื่อไลฟ์"
            placeholder="ไลฟ์สดขายของ SCC SHOP"
            value={live.title}
            onChange={(e) => setLive({ ...live, title: e.target.value })}
            sx={inputSx}
          />

          <TextField
            fullWidth
            size="small"
            label="คำอธิบาย (ไม่บังคับ)"
            placeholder="ไลฟ์สดขายเสื้อรุ่นใหม่ ลดราคาพิเศษ!"
            value={live.description}
            onChange={(e) => setLive({ ...live, description: e.target.value })}
            multiline
            rows={2}
            sx={inputSx}
          />

          <TextField
            fullWidth
            size="small"
            label="Thumbnail URL (ไม่บังคับ)"
            placeholder="https://..."
            value={live.thumbnailUrl}
            onChange={(e) => setLive({ ...live, thumbnailUrl: e.target.value })}
            sx={inputSx}
          />
        </Box>
      </Card>

      {/* Options */}
      <Card sx={glassCardSx}>
        <Typography variant="subtitle1" sx={{ color: '#f5f5f7', fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sparkles size={18} /> ตัวเลือก
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ color: '#f5f5f7', fontWeight: 500 }}>แสดง Popup อัตโนมัติ</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              แสดงหน้าต่างไลฟ์สดอัตโนมัติเมื่อผู้ใช้เข้าเว็บ
            </Typography>
          </Box>
          <Switch
            checked={live.autoPopup}
            onChange={(e) => setLive({ ...live, autoPopup: e.target.checked })}
            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366f1' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#6366f1' } }}
          />
        </Box>
      </Card>

      {/* Preview */}
      {live.streamUrl && (
        <Card sx={glassCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: '#f5f5f7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Eye size={18} /> ตัวอย่าง
            </Typography>
            <Button
              size="small"
              onClick={() => setShowPreview(!showPreview)}
              sx={{ color: '#6366f1', textTransform: 'none', borderRadius: '10px' }}
            >
              {showPreview ? 'ซ่อน' : 'แสดงตัวอย่าง'}
            </Button>
          </Box>

          {showPreview && (
            <Box sx={{ 
              borderRadius: '12px', 
              overflow: 'hidden', 
              bgcolor: '#000',
              aspectRatio: '16/9',
              position: 'relative',
            }}>
              {live.streamType === 'youtube' || live.streamType === 'facebook' ? (
                <iframe
                  src={getStreamEmbedUrl(live.streamUrl, live.streamType)}
                  style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : live.streamType === 'hls' ? (
                <Box sx={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  height: '100%', color: 'rgba(255,255,255,0.5)',
                  flexDirection: 'column', gap: 1,
                }}>
                  <MonitorPlay size={48} />
                  <Typography variant="body2">HLS Stream จะแสดงเมื่อเปิดไลฟ์จริง</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                    {live.streamUrl}
                  </Typography>
                </Box>
              ) : (
                <iframe
                  src={live.streamUrl}
                  style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              )}

              {/* Live badge overlay */}
              <Box sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Chip
                  icon={<Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>{streamTypeInfo.icon}</Box>}
                  label={streamTypeInfo.label}
                  size="small"
                  sx={{
                    bgcolor: `${streamTypeInfo.color}cc`,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 24,
                    '& .MuiChip-icon': { color: '#fff' },
                  }}
                />
              </Box>
            </Box>
          )}
        </Card>
      )}

      {/* Status Info */}
      {config.liveStream?.startedAt && config.liveStream?.enabled && (
        <Card sx={{ ...glassCardSx, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Radio size={18} color="#ef4444" />
            <Box>
              <Typography variant="body2" sx={{ color: '#fca5a5', fontWeight: 600 }}>
                กำลังไลฟ์สดอยู่
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Clock size={12} /> เริ่มเมื่อ {new Date(config.liveStream.startedAt).toLocaleString('th-TH')}
                {config.liveStream.updatedBy && ` • โดย ${config.liveStream.updatedBy}`}
              </Typography>
            </Box>
          </Box>
        </Card>
      )}

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{
            borderRadius: '14px',
            px: 4,
            py: 1.5,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
            textTransform: 'none',
          }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: '#fff', mr: 1 }} /> : null}
          บันทึกการตั้งค่า
        </Button>
      </Box>
    </Box>
  );
}
