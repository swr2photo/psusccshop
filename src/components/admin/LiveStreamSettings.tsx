'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useState, useEffect } from 'react';
import { invalidateLiveStreamCache } from '@/hooks/useLiveStream';
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
  Loader2,
  Info,
} from 'lucide-react';
import type { ShopConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface LiveStreamSettingsProps {
  config: ShopConfig;
  saveConfig: (config: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail?: string | null;
}

const glassCardClass =
  'mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--foreground)] backdrop-blur-xl';

function getStreamEmbedUrl(url: string, type: string): string {
  if (type === 'youtube') {
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
      const res = await apiFetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveStream: live }),
      });

      if (!res.ok) throw new Error('Failed to save');

      await invalidateLiveStreamCache();
      showToast('success', live.enabled ? '🔴 เปิดไลฟ์สดแล้ว!' : 'ปิดไลฟ์สดแล้ว');

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

    setSaving(true);
    try {
      const res = await apiFetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveStream: newState }),
      });
      if (!res.ok) throw new Error('Failed');
      await invalidateLiveStreamCache();
      showToast(newState.enabled ? 'success' : 'info', newState.enabled ? '🔴 กำลังไลฟ์สด!' : '⏹ หยุดไลฟ์สดแล้ว');
    } catch {
      showToast('error', 'เกิดข้อผิดพลาด');
      setLive(live);
    } finally {
      setSaving(false);
    }
  };

  const streamTypeInfo = getStreamTypeLabel(live.streamType);

  const streamUrlLabel =
    live.streamType === 'youtube' ? 'YouTube Live URL' :
    live.streamType === 'facebook' ? 'Facebook Live URL' :
    live.streamType === 'hls' ? 'HLS Stream URL (.m3u8)' :
    'Embed URL';

  const streamUrlPlaceholder =
    live.streamType === 'youtube' ? 'https://www.youtube.com/watch?v=... หรือ https://youtu.be/...' :
    live.streamType === 'facebook' ? 'https://www.facebook.com/.../videos/...' :
    live.streamType === 'hls' ? 'https://your-server.com/live/stream.m3u8' :
    'https://...';

  return (
    <div className="mx-auto max-w-[900px]">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex size-12 items-center justify-center rounded-[14px]',
              live.enabled && 'animate-pulse bg-gradient-to-br from-red-500 to-red-600',
              !live.enabled && 'bg-[var(--surface-2)]',
            )}
          >
            <Video size={24} className={live.enabled ? 'text-white' : 'text-muted-foreground'} />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--foreground)]">
              ไลฟ์สด
              {live.enabled && (
                <Badge className="h-[22px] animate-pulse border-0 bg-red-500 text-[0.7rem] font-bold text-white">
                  LIVE
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              จัดการไลฟ์สดขายของผ่าน OBS หรือ YouTube/Facebook Live
            </p>
          </div>
        </div>

        <Button
          onClick={handleGoLive}
          disabled={saving || (!live.enabled && !live.streamUrl.trim())}
          className={cn(
            'rounded-[14px] px-6 py-3 text-[0.9rem] font-bold',
            live.enabled
              ? 'bg-gradient-to-br from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700'
              : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
          )}
        >
          {saving ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <>
              {live.enabled ? <Square className="mr-2 size-4" /> : <Radio className="mr-2 size-4" />}
              {live.enabled ? 'หยุดไลฟ์' : 'เริ่มไลฟ์สด'}
            </>
          )}
        </Button>
      </div>

      {/* Stream Configuration */}
      <Card className={glassCardClass}>
        <CardHeader className="p-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Settings size={18} /> ตั้งค่าสตรีม
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-0">
          <div className="space-y-2">
            <Label>ประเภทสตรีม</Label>
            <Select
              value={live.streamType}
              onValueChange={(value) => setLive({ ...live, streamType: value as typeof live.streamType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">
                  <span className="flex items-center gap-2">
                    <Play size={16} color="#ff0000" /> YouTube Live
                  </span>
                </SelectItem>
                <SelectItem value="facebook">
                  <span className="flex items-center gap-2">
                    <Video size={16} color="#1877f2" /> Facebook Live
                  </span>
                </SelectItem>
                <SelectItem value="hls">
                  <span className="flex items-center gap-2">
                    <MonitorPlay size={16} color="#10b981" /> HLS Stream (OBS → RTMP Server)
                  </span>
                </SelectItem>
                <SelectItem value="custom">
                  <span className="flex items-center gap-2">
                    <Link size={16} color="#8b5cf6" /> Custom Embed URL
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stream-url">{streamUrlLabel}</Label>
            <Input
              id="stream-url"
              placeholder={streamUrlPlaceholder}
              value={live.streamUrl}
              onChange={(e) => setLive({ ...live, streamUrl: e.target.value })}
            />
          </div>

          {live.streamType === 'hls' && (
            <Alert className="rounded-xl border-blue-500/20 bg-blue-500/10 text-blue-300">
              <Info className="text-blue-400" />
              <AlertTitle className="font-semibold text-blue-300">วิธีใช้ OBS → HLS:</AlertTitle>
              <AlertDescription className="text-xs text-blue-300/90">
                1. ตั้ง RTMP Server (เช่น nginx-rtmp หรือ Cloudflare Stream)<br />
                2. ใน OBS → Settings → Stream → Service: Custom → Server: rtmp://your-server/live<br />
                3. ใส่ Stream Key<br />
                4. ใส่ HLS URL ที่ได้จาก server ในช่องด้านบน
              </AlertDescription>
            </Alert>
          )}

          {live.streamType === 'youtube' && (
            <Alert className="rounded-xl border-red-500/20 bg-red-500/10 text-red-300">
              <Info className="text-red-400" />
              <AlertTitle className="font-semibold text-red-300">วิธีใช้ OBS → YouTube Live:</AlertTitle>
              <AlertDescription className="text-xs text-red-300/90">
                1. ไปที่ YouTube Studio → Go Live → Stream<br />
                2. คัดลอก Stream Key ไปใส่ใน OBS → Settings → Stream → YouTube<br />
                3. เริ่มสตรีมใน OBS แล้วคัดลอก Live URL มาใส่ในช่องด้านบน<br />
                4. รองรับ: youtube.com/watch?v=xxx, youtu.be/xxx, youtube.com/live/xxx
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="live-title">ชื่อไลฟ์</Label>
            <Input
              id="live-title"
              placeholder="ไลฟ์สดขายของ SCC SHOP"
              value={live.title}
              onChange={(e) => setLive({ ...live, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="live-description">คำอธิบาย (ไม่บังคับ)</Label>
            <Textarea
              id="live-description"
              placeholder="ไลฟ์สดขายเสื้อรุ่นใหม่ ลดราคาพิเศษ!"
              value={live.description}
              onChange={(e) => setLive({ ...live, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail-url">Thumbnail URL (ไม่บังคับ)</Label>
            <Input
              id="thumbnail-url"
              placeholder="https://..."
              value={live.thumbnailUrl}
              onChange={(e) => setLive({ ...live, thumbnailUrl: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card className={glassCardClass}>
        <CardHeader className="p-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles size={18} /> ตัวเลือก
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between p-0">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">แสดง Popup อัตโนมัติ</p>
            <p className="text-xs text-muted-foreground">
              แสดงหน้าต่างไลฟ์สดอัตโนมัติเมื่อผู้ใช้เข้าเว็บ
            </p>
          </div>
          <Switch
            checked={live.autoPopup}
            onCheckedChange={(checked) => setLive({ ...live, autoPopup: checked })}
          />
        </CardContent>
      </Card>

      {/* Preview */}
      {live.streamUrl && (
        <Card className={glassCardClass}>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Eye size={18} /> ตัวอย่าง
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="rounded-[10px] text-indigo-500"
            >
              {showPreview ? 'ซ่อน' : 'แสดงตัวอย่าง'}
            </Button>
          </div>

          {showPreview && (
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              {live.streamType === 'youtube' || live.streamType === 'facebook' ? (
                <iframe
                  src={getStreamEmbedUrl(live.streamUrl, live.streamType)}
                  className="absolute inset-0 size-full border-0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : live.streamType === 'hls' ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <MonitorPlay size={48} />
                  <p className="text-sm">HLS Stream จะแสดงเมื่อเปิดไลฟ์จริง</p>
                  <p className="text-xs text-muted-foreground">{live.streamUrl}</p>
                </div>
              ) : (
                <iframe
                  src={live.streamUrl}
                  className="absolute inset-0 size-full border-0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              )}

              <div className="absolute left-3 top-3 flex items-center gap-2">
                <Badge
                  className="h-6 gap-1 border-0 text-[0.7rem] font-semibold text-white"
                  style={{ backgroundColor: `${streamTypeInfo.color}cc` }}
                >
                  {streamTypeInfo.icon}
                  {streamTypeInfo.label}
                </Badge>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Status Info */}
      {config.liveStream?.startedAt && config.liveStream?.enabled && (
        <Card className={cn(glassCardClass, 'border-red-500/30 bg-red-500/5')}>
          <div className="flex items-center gap-3">
            <Radio size={18} className="text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-300">กำลังไลฟ์สดอยู่</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                เริ่มเมื่อ {new Date(config.liveStream.startedAt)?.toLocaleString('th-TH')}
                {config.liveStream.updatedBy && ` • โดย ${config.liveStream.updatedBy}`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Save Button */}
      <div className="mt-2 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-500 px-8 py-3 font-semibold hover:from-indigo-600 hover:to-violet-600"
        >
          {saving && <Loader2 className="mr-2 size-[18px] animate-spin" />}
          บันทึกการตั้งค่า
        </Button>
      </div>
    </div>
  );
}
