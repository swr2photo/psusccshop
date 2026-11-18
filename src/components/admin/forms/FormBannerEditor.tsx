'use client';

// Header banner picker for the admin form editor: upload an image or paste a YouTube / Vimeo link.

import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, RefreshCw, Trash2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormBannerView } from '@/components/forms/FormBanner';
import { uploadImageApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { getVideoEmbed, type FormBanner } from '@/lib/forms';

type Toast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;

const MAX_UPLOAD = 5 * 1024 * 1024;
const MAX_WIDTH = 2000;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Downscale very large photos so they fit the 5MB upload limit and load fast. GIFs are kept as-is. */
async function prepareImage(file: File): Promise<{ dataUrl: string; mime: string }> {
  if (file.type === 'image/gif') return { dataUrl: await readAsDataUrl(file), mime: file.type };
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    if (img.naturalWidth <= MAX_WIDTH && file.size <= 1.5 * 1024 * 1024) {
      return { dataUrl: await readAsDataUrl(file), mime: file.type };
    }
    const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const mime = 'image/webp';
    return { dataUrl: canvas.toDataURL(mime, 0.85), mime };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FormBannerEditor({
  banner, title, onChange, showToast,
}: {
  banner?: FormBanner | null;
  title: string;
  onChange: (banner: FormBanner | null) => void;
  showToast: Toast;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const videoValid = Boolean(getVideoEmbed(videoUrl));

  const upload = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
      showToast('error', 'รองรับเฉพาะไฟล์ PNG, JPG, WEBP หรือ GIF');
      return;
    }
    setUploading(true);
    try {
      const { dataUrl, mime } = await prepareImage(file);
      const base64 = dataUrl.split(',')[1] || '';
      if (base64.length * 0.75 > MAX_UPLOAD) {
        showToast('error', 'ไฟล์ใหญ่เกิน 5MB');
        return;
      }
      const res = await uploadImageApi({ base64, filename: `form-banner-${Date.now()}`, mime });
      const json = await res.json().catch(() => ({}));
      const url = json?.data?.url || json?.url;
      if (json?.status === 'success' && url) {
        onChange({ type: 'image', url });
        setVideoMode(false);
        showToast('success', 'อัปโหลดแบนเนอร์แล้ว');
      } else {
        showToast('error', json?.message || 'อัปโหลดไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyVideo = () => {
    if (!videoValid) return;
    onChange({ type: 'video', url: videoUrl.trim() });
    setVideoMode(false);
  };

  const fileInput = (
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
  );

  const videoForm = (
    <div className="w-full max-w-md">
      <div className="flex gap-2">
        <Input
          autoFocus
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyVideo(); } if (e.key === 'Escape') setVideoMode(false); }}
          placeholder="วางลิงก์ YouTube หรือ Vimeo"
          aria-label="ลิงก์วิดีโอพรีวิว"
          aria-invalid={videoUrl && !videoValid ? true : undefined}
          className="h-10 bg-card"
        />
        <Button type="button" onClick={applyVideo} disabled={!videoValid} className="h-10">ใช้วิดีโอนี้</Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.72rem]">
        <span className={cn(videoUrl && !videoValid ? 'text-destructive' : 'text-muted-foreground')}>
          {videoUrl && !videoValid ? 'ลิงก์นี้ไม่ใช่ YouTube หรือ Vimeo' : 'รองรับ youtube.com, youtu.be, Shorts และ vimeo.com'}
        </span>
        <button type="button" className="font-semibold text-muted-foreground hover:text-foreground" onClick={() => setVideoMode(false)}>ยกเลิก</button>
      </div>
    </div>
  );

  // ── Has a banner ──
  if (banner?.url && !videoMode) {
    return (
      <div className="relative">
        {fileInput}
        <FormBannerView banner={banner} title={title || 'แบบฟอร์ม'} />
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={uploading}
            className="h-8 bg-black/60 text-white backdrop-blur hover:bg-black/75"
            onClick={() => {
              if (banner.type === 'image') fileRef.current?.click();
              else { setVideoUrl(banner.url); setVideoMode(true); }
            }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} เปลี่ยน
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-8 bg-black/60 text-white backdrop-blur hover:bg-destructive" onClick={() => onChange(null)}>
            <Trash2 size={14} /> ลบ
          </Button>
        </div>
      </div>
    );
  }

  // ── Empty / choosing ──
  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer.files?.[0]); }}
      className={cn(
        'flex min-h-[150px] flex-col items-center justify-center gap-3 border-b-2 border-dashed px-4 py-6 text-center transition-colors',
        dragOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/40',
      )}
    >
      {fileInput}
      {videoMode ? (
        videoForm
      ) : uploading ? (
        <p className="flex items-center gap-2 text-[0.85rem] font-semibold text-muted-foreground"><Loader2 size={16} className="animate-spin" /> กำลังอัปโหลด...</p>
      ) : (
        <>
          <p className="text-[0.85rem] font-semibold text-foreground">แบนเนอร์ส่วนหัว <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span></p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} /> อัปโหลดรูปภาพ
            </Button>
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => { setVideoUrl(''); setVideoMode(true); }}>
              <Video size={15} /> วิดีโอพรีวิว
            </Button>
          </div>
          <p className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
            <Link2 size={11} /> ลากรูปมาวางได้ · แนะนำสัดส่วน 3:1 (เช่น 1500×500) · ไม่เกิน 5MB
          </p>
        </>
      )}
    </div>
  );
}
