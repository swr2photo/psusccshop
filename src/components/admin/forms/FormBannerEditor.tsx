'use client';

// Header banner picker for the admin form editor:
// upload an image, upload a video clip (MP4 / WEBM / MOV), or paste a YouTube / Vimeo link.

import React, { useRef, useState } from 'react';
import { Film, ImagePlus, Link2, Loader2, RefreshCw, Trash2, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormBannerView } from '@/components/forms/FormBanner';
import { uploadImageApi, uploadVideoFileApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { getVideoEmbed, isAllowedBannerVideoUrl, type FormBanner } from '@/lib/forms';

type Toast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;

const MAX_IMAGE_UPLOAD = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD = 50 * 1024 * 1024;
const MAX_WIDTH = 2000;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function isSupportedImageFile(file: File): boolean {
  return /^image\/(png|jpe?g|gif|webp)$/i.test(file.type);
}

function isSupportedVideoFile(file: File): boolean {
  if (/^video\/(mp4|webm|quicktime)$/i.test(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ext === 'mp4' || ext === 'm4v' || ext === 'webm' || ext === 'mov';
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

/** Capture a lightweight WebP poster frame from a local video file (best-effort; returns null on unsupported codecs). */
async function captureVideoPoster(file: File): Promise<{ base64: string; mime: string } | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('poster timeout')), 5000);
      const done = () => {
        window.clearTimeout(timer);
        resolve();
      };
      const fail = () => {
        window.clearTimeout(timer);
        reject(new Error('poster decode failed'));
      };
      video.addEventListener('loadeddata', () => {
        if (video.duration > 0.25) {
          video.addEventListener('seeked', done, { once: true });
          try {
            video.currentTime = Math.min(0.5, video.duration * 0.1);
          } catch {
            done();
          }
        } else {
          done();
        }
      }, { once: true });
      video.addEventListener('error', fail, { once: true });
    });

    if (!video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', 0.8);
    const base64 = dataUrl.split(',')[1] || '';
    if (!base64) return null;
    return { base64, mime: 'image/webp' };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [uploadingKind, setUploadingKind] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [videoLinkMode, setVideoLinkMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const uploading = uploadingKind !== null;
  const videoLinkValid = Boolean(getVideoEmbed(videoUrl));

  const uploadImage = async (file?: File | null) => {
    if (!file) return;
    if (!isSupportedImageFile(file)) {
      showToast('error', 'รองรับเฉพาะไฟล์ PNG, JPG, WEBP หรือ GIF');
      return;
    }
    setUploadingKind('image');
    setUploadProgress(0);
    try {
      const { dataUrl, mime } = await prepareImage(file);
      const base64 = dataUrl.split(',')[1] || '';
      if (base64.length * 0.75 > MAX_IMAGE_UPLOAD) {
        showToast('error', 'ไฟล์รูปใหญ่เกิน 5MB');
        return;
      }
      const res = await uploadImageApi({ base64, filename: `form-banner-${Date.now()}`, mime });
      const json = await res.json().catch(() => ({}));
      const url = json?.data?.url || json?.url;
      if (json?.status === 'success' && url) {
        onChange({ type: 'image', url });
        setVideoLinkMode(false);
        showToast('success', 'อัปโหลดแบนเนอร์แล้ว');
      } else {
        showToast('error', json?.message || 'อัปโหลดไม่สำเร็จ');
      }
    } catch {
      showToast('error', 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploadingKind(null);
      setUploadProgress(0);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const uploadVideo = async (file?: File | null) => {
    if (!file) return;
    if (!isSupportedVideoFile(file)) {
      showToast('error', 'รองรับเฉพาะไฟล์วิดีโอ MP4, WEBM หรือ MOV');
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD) {
      showToast('error', 'ไฟล์วิดีโอใหญ่เกิน 50MB');
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadingKind('video');
    setUploadProgress(0);

    try {
      const posterPromise = captureVideoPoster(file).then(async (poster) => {
        if (!poster) return undefined;
        try {
          const res = await uploadImageApi({
            base64: poster.base64,
            filename: `form-banner-poster-${Date.now()}.webp`,
            mime: poster.mime,
          });
          const json = await res.json().catch(() => ({}));
          const url = json?.data?.url || json?.url;
          return json?.status === 'success' && typeof url === 'string' ? url : undefined;
        } catch {
          return undefined;
        }
      });

      const uploaded = await uploadVideoFileApi(file, {
        folder: 'form-banners',
        signal: controller.signal,
        onProgress: (pct) => setUploadProgress(pct),
      });
      const posterUrl = await posterPromise;

      onChange({
        type: 'video',
        url: uploaded.url,
        ...(posterUrl ? { posterUrl } : {}),
      });
      setVideoLinkMode(false);
      showToast('success', 'อัปโหลดคลิปปกแบนเนอร์แล้ว');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        showToast('info', 'ยกเลิกการอัปโหลดคลิปแล้ว');
      } else {
        const msg = err instanceof Error ? err.message : 'อัปโหลดคลิปไม่สำเร็จ กรุณาลองใหม่';
        showToast('error', msg);
      }
    } finally {
      uploadAbortRef.current = null;
      setUploadingKind(null);
      setUploadProgress(0);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDroppedFile = (file?: File | null) => {
    if (!file) return;
    if (isSupportedVideoFile(file)) {
      void uploadVideo(file);
    } else if (isSupportedImageFile(file)) {
      void uploadImage(file);
    } else {
      showToast('error', 'รองรับเฉพาะไฟล์รูป (PNG, JPG, WEBP, GIF) หรือคลิปวิดีโอ (MP4, WEBM, MOV)');
    }
  };

  const applyVideoLink = () => {
    if (!videoLinkValid) return;
    onChange({ type: 'video', url: videoUrl.trim() });
    setVideoLinkMode(false);
  };

  const fileInputs = (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void uploadImage(e.target.files?.[0])}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={(e) => void uploadVideo(e.target.files?.[0])}
      />
    </>
  );

  const videoLinkForm = (
    <div className="w-full max-w-md">
      <div className="flex gap-2">
        <Input
          autoFocus
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); applyVideoLink(); }
            if (e.key === 'Escape') setVideoLinkMode(false);
          }}
          placeholder="วางลิงก์ YouTube หรือ Vimeo"
          aria-label="ลิงก์วิดีโอพรีวิว"
          aria-invalid={videoUrl && !videoLinkValid ? true : undefined}
          className="h-10 bg-card"
        />
        <Button type="button" onClick={applyVideoLink} disabled={!videoLinkValid} className="h-10">ใช้วิดีโอนี้</Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.72rem]">
        <span className={cn(videoUrl && !videoLinkValid ? 'text-destructive' : 'text-muted-foreground')}>
          {videoUrl && !videoLinkValid ? 'ลิงก์นี้ไม่ใช่ YouTube หรือ Vimeo' : 'รองรับ youtube.com, youtu.be, Shorts และ vimeo.com'}
        </span>
        <button type="button" className="font-semibold text-muted-foreground hover:text-foreground" onClick={() => setVideoLinkMode(false)}>ยกเลิก</button>
      </div>
    </div>
  );

  // ── Has a banner ──
  if (banner?.url && !videoLinkMode) {
    const isUploadedVideo = banner.type === 'video' && isAllowedBannerVideoUrl(banner.url);
    return (
      <div className="relative">
        {fileInputs}
        <FormBannerView banner={banner} title={title || 'แบบฟอร์ม'} />
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 px-6 text-white backdrop-blur-xs">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Loader2 size={16} className="animate-spin" />
              {uploadingKind === 'video' ? `กำลังอัปโหลดคลิป... ${uploadProgress}%` : 'กำลังอัปโหลดรูปภาพ...'}
            </p>
            {uploadingKind === 'video' && (
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/25">
                <div className="h-full bg-white transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-wrap justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={uploading}
            className="h-8 bg-black/60 text-white backdrop-blur hover:bg-black/75"
            onClick={() => {
              if (banner.type === 'image') imageInputRef.current?.click();
              else if (isUploadedVideo) videoInputRef.current?.click();
              else { setVideoUrl(banner.url); setVideoLinkMode(true); }
            }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} เปลี่ยน
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={uploading}
            className="h-8 bg-black/60 text-white backdrop-blur hover:bg-destructive"
            onClick={() => onChange(null)}
          >
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
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleDroppedFile(e.dataTransfer.files?.[0]); }}
      className={cn(
        'flex min-h-[150px] flex-col items-center justify-center gap-3 border-b-2 border-dashed px-4 py-6 text-center transition-colors',
        dragOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/40',
      )}
    >
      {fileInputs}
      {videoLinkMode ? (
        videoLinkForm
      ) : uploading ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-2">
          <p className="flex items-center gap-2 text-[0.85rem] font-semibold text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            {uploadingKind === 'video' ? `กำลังอัปโหลดคลิป... ${uploadProgress}%` : 'กำลังอัปโหลดรูปภาพ...'}
          </p>
          {uploadingKind === 'video' && (
            <>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                onClick={() => uploadAbortRef.current?.abort()}
              >
                <X size={12} /> ยกเลิก
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-[0.85rem] font-semibold text-foreground">
            แบนเนอร์ส่วนหัว <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => imageInputRef.current?.click()}>
              <ImagePlus size={15} /> อัปโหลดรูปภาพ
            </Button>
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => videoInputRef.current?.click()}>
              <Film size={15} /> อัปโหลดคลิปวิดีโอ
            </Button>
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => { setVideoUrl(''); setVideoLinkMode(true); }}>
              <Video size={15} /> ลิงก์ YouTube / Vimeo
            </Button>
          </div>
          <p className="flex flex-wrap items-center justify-center gap-1 text-[0.72rem] text-muted-foreground">
            <Link2 size={11} /> ลากรูปหรือคลิปมาวางได้ · รูปไม่เกิน 5MB (แนะนำ 3:1) · คลิป MP4/WEBM/MOV ไม่เกิน 50MB
          </p>
        </>
      )}
    </div>
  );
}
