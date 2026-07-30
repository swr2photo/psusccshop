'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Smile,
  Image as ImageIcon,
  Sticker,
  Mic,
  Send,
  Loader2,
  Receipt,
  Upload,
  X,
  Square,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CHAT_STICKERS } from '@/lib/chat-stickers';
import { formatVoiceDuration } from '@/lib/chat-voice';
import {
  buildQuickReplySlashItems,
  filterSlashItems,
  getSlashQuery,
  type QuickReplySlashItem,
} from '@/lib/chat-slash-replies';
import { Progress } from '@/components/ui/progress';

export type ChatComposerUploadState = {
  /** 0–100; omit / null for indeterminate */
  progress?: number | null;
  /** Number of files being uploaded */
  fileCount?: number;
  /** Override label, e.g. "กำลังอัปโหลดเสียง..." */
  label?: string;
  onCancel?: () => void;
};

export type ChatComposerVoiceLabels = {
  recordVoice?: string;
  sendVoice?: string;
  cancelRecording?: string;
  stopRecording?: string;
  voiceTooShort?: string;
  micPermissionDenied?: string;
  micNotFound?: string;
  micInUse?: string;
  micUnsupported?: string;
  micRecordUnsupported?: string;
  micHttpsRequired?: string;
  micBlocked?: string;
  micFailed?: string;
  micRecordFailed?: string;
};

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😜',
  '🤔', '😎', '🤩', '🥳', '😤', '😢', '😭', '🥺',
  '👍', '👎', '👏', '🙏', '💪', '✌️', '🤞', '❤️',
  '🔥', '✨', '🎉', '💯', '✅', '⭐', '🌹', '☕',
];

const MAX_RECORD_SEC = 60;
const WAVE_BARS = 36;

function idleWaveBars(): number[] {
  return Array.from({ length: WAVE_BARS }, (_, i) => {
    const envelope = 0.22 + 0.2 * Math.sin((i / WAVE_BARS) * Math.PI);
    return envelope;
  });
}

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttachImage?: () => void;
  onAttachOrder?: () => void;
  /** Send a GIF sticker (URL or data URL) as an image message */
  onSendSticker?: (src: string) => void;
  /** Send recorded voice (base64 data URL + mime + duration) */
  onSendVoice?: (payload: { base64: string; mime: string; duration: number }) => void;
  /** Quick replies for `/` slash menu (admin) — strings or structured items */
  quickReplies?: Array<string | import('@/lib/support-chat-settings').QuickReplyItem>;
  /** Called when a slash command is chosen — parent should send the text */
  onSlashSend?: (text: string) => void;
  /** Prefer Ctrl/Cmd+Enter to send; plain Enter inserts newline */
  sendOnCtrlEnter?: boolean;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  hasAttachment?: boolean;
  isTouchDevice?: boolean;
  className?: string;
  showMic?: boolean;
  /** TH/EN (or custom) strings for mic / recording UI */
  voiceLabels?: ChatComposerVoiceLabels;
  /** Inline upload progress inside the composer shell (not a floating bubble) */
  upload?: ChatComposerUploadState | null;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  onAttachImage,
  onAttachOrder,
  onSendSticker,
  onSendVoice,
  quickReplies,
  onSlashSend,
  sendOnCtrlEnter = false,
  placeholder = 'ส่งข้อความ...',
  disabled = false,
  sending = false,
  hasAttachment = false,
  isTouchDevice = false,
  className,
  showMic = false,
  voiceLabels,
  upload = null,
}: ChatComposerProps) {
  const vl = voiceLabels || {};
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveRafRef = useRef<number | null>(null);
  const waveBarsRef = useRef<number[]>(idleWaveBars());
  const waveDomRef = useRef<HTMLDivElement>(null);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [waveBars, setWaveBars] = useState<number[]>(() => idleWaveBars());
  const [slashIndex, setSlashIndex] = useState(0);

  const slashItems: QuickReplySlashItem[] = quickReplies?.length
    ? buildQuickReplySlashItems(quickReplies)
    : [];
  const slashQuery = getSlashQuery(value);
  const slashMatches =
    slashQuery !== null && slashItems.length > 0
      ? filterSlashItems(slashItems, slashQuery)
      : [];
  const slashOpen = slashMatches.length > 0;

  const canSend = Boolean(value.trim() || hasAttachment) && !disabled && !sending;
  const showActions = !value.trim() && !hasAttachment;
  const inVoiceMode = recording || Boolean(pendingBlob);
  const uploadProgress =
    typeof upload?.progress === 'number' && Number.isFinite(upload.progress)
      ? Math.max(0, Math.min(100, Math.round(upload.progress)))
      : null;
  const uploadFileCount = Math.max(1, upload?.fileCount ?? 1);
  const uploadLabel =
    upload?.label ||
    (uploadFileCount > 1
      ? `กำลังอัปโหลดรูปภาพ (${uploadFileCount} ไฟล์)...`
      : 'กำลังอัปโหลดรูปภาพ...');

  const paintWaveBars = (next: number[]) => {
    waveBarsRef.current = next;
    const root = waveDomRef.current;
    if (root && root.children.length === next.length) {
      for (let i = 0; i < next.length; i++) {
        (root.children[i] as HTMLElement).style.height = `${Math.round(next[i] * 100)}%`;
      }
      return;
    }
    setWaveBars(next.slice());
  };

  const stopWaveMeter = () => {
    if (waveRafRef.current != null) {
      cancelAnimationFrame(waveRafRef.current);
      waveRafRef.current = null;
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      // ignore
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  };

  const startWaveMeter = (stream: MediaStream) => {
    stopWaveMeter();
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.62;
      source.connect(analyser);
      // Do not connect to destination — meter only, no echo
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      if (ctx.state === 'suspended') void ctx.resume();

      const data = new Uint8Array(analyser.fftSize);
      const history = idleWaveBars();

      const tick = () => {
        const node = analyserRef.current;
        if (!node) return;
        node.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] ?? 128) - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length) / 128;
        const level = Math.max(0.08, Math.min(1, rms * 3.4));

        // Scroll waveform left ← new amplitude on the right (live speech rhythm)
        history.shift();
        history.push(level);
        paintWaveBars(history.slice());
        waveRafRef.current = requestAnimationFrame(tick);
      };
      waveRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Analyser optional — keep recording without meter
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const resetVoice = () => {
    clearTimer();
    stopWaveMeter();
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    setRecording(false);
    setElapsed(0);
    setPendingBlob(null);
    setPendingDuration(0);
    paintWaveBars(idleWaveBars());
  };

  useEffect(() => {
    return () => {
      clearTimer();
      stopWaveMeter();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + emoji);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
      autoResize();
    });
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(Math.max(el.scrollHeight, 24), 160);
    el.style.height = `${next}px`;
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  const sendSticker = (src: string) => {
    if (!onSendSticker || disabled || sending) return;
    setStickerOpen(false);
    onSendSticker(src);
  };

  const handleGifFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onSendSticker) return;
    const ok =
      file.type === 'image/gif' ||
      file.type === 'image/webp' ||
      /\.gif$/i.test(file.name) ||
      /\.webp$/i.test(file.name);
    if (!ok) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') sendSticker(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    return '';
  };

  const startRecording = async () => {
    if (!onSendVoice || disabled || sending) return;
    setMicError(null);
    if (typeof window === 'undefined') return;

    const mediaDevices =
      navigator.mediaDevices ||
      // Legacy Safari / older browsers
      ((navigator as any).webkitGetUserMedia || (navigator as any).getUserMedia
        ? ({
            getUserMedia: (constraints: MediaStreamConstraints) =>
              new Promise<MediaStream>((resolve, reject) => {
                const legacy =
                  (navigator as any).mediaDevices?.getUserMedia ||
                  (navigator as any).webkitGetUserMedia ||
                  (navigator as any).mozGetUserMedia ||
                  (navigator as any).getUserMedia;
                if (!legacy) {
                  reject(new Error('unsupported'));
                  return;
                }
                if (legacy.bind) {
                  legacy.call(navigator, constraints, resolve, reject);
                }
              }),
          } as MediaDevices)
        : null);

    if (!mediaDevices?.getUserMedia) {
      setMicError(vl.micUnsupported || 'เบราว์เซอร์นี้ไม่รองรับไมโครโฟน');
      return;
    }

    if (!window.isSecureContext) {
      setMicError(vl.micHttpsRequired || 'ต้องใช้ HTTPS หรือ localhost ถึงจะเปิดไมค์ได้');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        // Fallback for devices that reject advanced constraints
        stream = await mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      if (typeof MediaRecorder === 'undefined') {
        stopStream();
        setMicError(vl.micRecordUnsupported || 'เบราว์เซอร์นี้ไม่รองรับการอัดเสียง');
        return;
      }

      const mime = pickMime();
      let recorder: MediaRecorder;
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onerror = () => {
        setMicError(vl.micRecordFailed || 'Recording failed — please try again');
        resetVoice();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const dur = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stopWaveMeter();
        stopStream();
        setRecording(false);
        clearTimer();
        if (blob.size < 200) {
          setPendingBlob(null);
          paintWaveBars(idleWaveBars());
          setMicError(vl.voiceTooShort || 'Recording too short');
          return;
        }
        // Freeze last live waveform for preview before send
        paintWaveBars(waveBarsRef.current.slice());
        setPendingBlob(blob);
        setPendingDuration(dur);
        setElapsed(dur);
      };
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPendingBlob(null);
      paintWaveBars(idleWaveBars());
      setRecording(true);
      startWaveMeter(stream);
      recorder.start(250);
      clearTimer();
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_RECORD_SEC) {
          stopRecording();
        }
      }, 200);
    } catch (err: any) {
      const name = String(err?.name || '');
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicError(vl.micPermissionDenied || 'Microphone permission denied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMicError(vl.micNotFound || 'No microphone found');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setMicError(vl.micInUse || 'Microphone is in use by another app');
      } else if (name === 'SecurityError') {
        setMicError(vl.micBlocked || 'Blocked by site security policy');
      } else {
        setMicError(vl.micFailed || 'Could not open the microphone');
      }
      resetVoice();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    try {
      recorder.stop();
    } catch {
      resetVoice();
    }
  };

  const cancelVoice = () => {
    resetVoice();
    setMicError(null);
  };

  const sendVoice = async () => {
    if (!onSendVoice || sending || disabled) return;

    const finishAndSend = async (blob: Blob, duration: number) => {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(blob);
      });
      resetVoice();
      onSendVoice({
        base64,
        mime: (blob.type || 'audio/webm').split(';')[0] || 'audio/webm',
        duration,
      });
    };

    if (recording) {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          stopWaveMeter();
          stopStream();
          setRecording(false);
          clearTimer();
          void finishAndSend(blob, duration).finally(resolve);
        };
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
      return;
    }

    if (pendingBlob) {
      await finishAndSend(pendingBlob, pendingDuration || elapsed || 1);
    }
  };

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery, slashMatches.length]);

  const applySlashItem = (item: QuickReplySlashItem) => {
    onChange('');
    if (onSlashSend) onSlashSend(item.text);
    else {
      onChange(item.text);
      requestAnimationFrame(() => onSend());
    }
  };

  if (inVoiceMode) {
    return (
      <div className={cn('px-3 py-2', className)}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={vl.cancelRecording || 'Cancel'}
            onClick={cancelVoice}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--surface-2)] text-foreground transition hover:bg-[var(--surface-3)]"
          >
            <X className="size-3.5" />
          </button>

          <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] px-1.5 text-foreground">
            <button
              type="button"
              aria-label={recording ? (vl.stopRecording || 'Stop') : (vl.recordVoice || 'Recorded')}
              onClick={recording ? stopRecording : undefined}
              disabled={!recording}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-90"
            >
              <Square className="size-2.5 fill-current" />
            </button>
            <div className="min-w-0 flex-1 px-0.5">
              <div
                ref={waveDomRef}
                className="flex h-5 items-center justify-between gap-[2px]"
                aria-hidden
              >
                {(waveBars.length === WAVE_BARS ? waveBars : idleWaveBars()).map((level, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-[2px] shrink-0 rounded-full',
                      recording
                        ? 'bg-[var(--primary)]'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)]'
                    )}
                    style={{
                      height: `${Math.round(Math.max(0.12, level) * 100)}%`,
                      transition: recording ? 'height 60ms linear' : 'height 180ms ease',
                    }}
                  />
                ))}
              </div>
            </div>
            <span className="shrink-0 px-1 text-[10px] tabular-nums text-[var(--text-muted)]">
              {formatVoiceDuration(elapsed)}
            </span>
          </div>

          <button
            type="button"
            aria-label={vl.sendVoice || 'Send voice'}
            disabled={sending || (!recording && !pendingBlob)}
            onClick={() => void sendVoice()}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5 fill-current" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative px-3 py-2', className)}>
      <input
        ref={gifInputRef}
        type="file"
        accept="image/gif,image/webp,.gif,.webp"
        className="hidden"
        onChange={handleGifFile}
      />

      {micError && (
        <p className="mb-1.5 px-1 text-[11px] text-red-500">{micError}</p>
      )}

      {slashOpen && (
        <div
          className="absolute inset-x-3 bottom-full z-30 mb-1 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg"
          role="listbox"
          aria-label="คำสั่งตอบด่วน"
        >
          <p className="border-b border-border/50 px-2.5 py-1.5 text-[0.65rem] text-muted-foreground">
            Slash commands · ↑↓ เลือก · Enter ส่ง · Esc ปิด
          </p>
          <ul className="max-h-48 overflow-y-auto py-1">
            {slashMatches.map((item, i) => (
              <li key={`${item.command}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === slashIndex}
                  className={cn(
                    'flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm transition',
                    i === slashIndex ? 'bg-muted' : 'hover:bg-muted/60'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySlashItem(item);
                  }}
                >
                  <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
                    {item.command}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.8rem]">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col rounded-2xl border border-border/40 bg-background/80 px-2.5 pt-2.5 pb-1.5',
          'transition-[box-shadow,border-color,min-height]',
          'focus-within:border-border/70',
          value.trim() || hasAttachment || upload ? 'min-h-[88px]' : 'min-h-[52px]'
        )}
      >
        {upload && (
          <div
            className="mb-2 rounded-xl border border-border/50 bg-muted/60 px-2.5 py-2 dark:bg-white/[0.04]"
            role="status"
            aria-live="polite"
            aria-label={uploadLabel}
          >
            <div className="flex items-start gap-2">
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[0.78rem] font-medium text-foreground/90">
                    {uploadLabel}
                  </p>
                  <span className="shrink-0 text-[0.7rem] tabular-nums text-muted-foreground">
                    {uploadProgress == null ? '…' : `${uploadProgress}%`}
                  </span>
                </div>
                <Progress
                  value={uploadProgress}
                  className="mt-1.5"
                />
              </div>
              {upload.onCancel && (
                <button
                  type="button"
                  aria-label="ยกเลิกการอัปโหลด"
                  onClick={upload.onCancel}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || sending}
          placeholder={
            upload
              ? 'พิมพ์ข้อความต่อได้ระหว่างอัปโหลด...'
              : quickReplies?.length
                ? `${placeholder} (พิมพ์ / สำหรับตอบด่วน)`
                : placeholder
          }
          aria-label={placeholder}
          className={cn(
            'w-full resize-none overflow-y-auto bg-transparent px-1 text-[15px] leading-5 text-foreground outline-none',
            'placeholder:text-muted-foreground/80',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'max-h-40 min-h-6'
          )}
          onChange={(e) => {
            onChange(e.target.value);
            requestAnimationFrame(autoResize);
          }}
          onKeyDown={(e) => {
            if (slashOpen) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashIndex((i) => Math.min(slashMatches.length - 1, i + 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashIndex((i) => Math.max(0, i - 1));
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const item = slashMatches[slashIndex] || slashMatches[0];
                if (item) applySlashItem(item);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onChange('');
                return;
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                const item = slashMatches[slashIndex] || slashMatches[0];
                if (item) {
                  onChange(item.text);
                  requestAnimationFrame(autoResize);
                }
                return;
              }
            }

            const isMod = e.ctrlKey || e.metaKey;
            if (sendOnCtrlEnter) {
              if (e.key === 'Enter' && isMod) {
                e.preventDefault();
                if (canSend) onSend();
              }
              return;
            }

            if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />

        <div className="mt-1 flex items-center justify-between gap-1">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label="อีโมจิ"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground/80 transition hover:bg-muted disabled:opacity-40"
              >
                <Smile className="size-[22px] stroke-[1.5]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-[280px] p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-lg transition hover:bg-muted"
                    onClick={() => {
                      insertEmoji(emoji);
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex shrink-0 items-center gap-0.5">
            {showActions ? (
              <>
                {showMic && onSendVoice && (
                  <button
                    type="button"
                    disabled={disabled || sending}
                    title={vl.recordVoice || 'Record voice message'}
                    aria-label={vl.recordVoice || 'Record voice message'}
                    onClick={() => void startRecording()}
                    className="flex size-9 items-center justify-center rounded-full text-foreground/80 transition hover:bg-muted disabled:opacity-40"
                  >
                    <Mic className="size-[22px] stroke-[1.5]" />
                  </button>
                )}
                {onAttachImage && (
                  <button
                    type="button"
                    disabled={disabled || sending}
                    aria-label="แนบรูป"
                    onClick={onAttachImage}
                    className="flex size-9 items-center justify-center rounded-full text-foreground/80 transition hover:bg-muted disabled:opacity-40"
                  >
                    <ImageIcon className="size-[22px] stroke-[1.5]" />
                  </button>
                )}
                {onAttachOrder && (
                  <button
                    type="button"
                    disabled={disabled || sending}
                    title="แนบออเดอร์"
                    aria-label="แนบออเดอร์"
                    onClick={onAttachOrder}
                    className="flex size-9 items-center justify-center rounded-full text-emerald-600 transition hover:bg-muted disabled:opacity-40"
                  >
                    <Receipt className="size-[22px] stroke-[1.5]" />
                  </button>
                )}
                {onSendSticker && (
                <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled || sending}
                      aria-label="สติกเกอร์ GIF"
                      className="flex size-9 items-center justify-center rounded-full text-foreground/80 transition hover:bg-muted disabled:opacity-40"
                    >
                      <Sticker className="size-[22px] stroke-[1.5]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="top"
                    className="w-[300px] p-2"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <p className="text-xs font-medium text-muted-foreground">สติกเกอร์ GIF</p>
                      <button
                        type="button"
                        disabled={disabled || sending}
                        onClick={() => gifInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-blue-600 transition hover:bg-blue-50"
                      >
                        <Upload className="size-3" />
                        อัปโหลด GIF
                      </button>
                    </div>

                    <div className="grid max-h-[220px] overflow-y-auto grid-cols-4 gap-1.5">
                      {CHAT_STICKERS.map((sticker) => (
                        <button
                          key={sticker.id}
                          type="button"
                          disabled={disabled || sending}
                          title={sticker.label}
                          onClick={() => sendSticker(sticker.src)}
                          className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-muted/40 transition hover:bg-muted disabled:opacity-40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={sticker.src}
                            alt={sticker.label}
                            className="size-[72%] object-contain"
                            draggable={false}
                          />
                          <span className="absolute right-1 bottom-1 text-[11px] opacity-80">
                            {sticker.emoji}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled={!canSend}
                aria-label="ส่งข้อความ"
                onClick={onSend}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full transition',
                  canSend
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'text-muted-foreground opacity-40'
                )}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4 fill-current" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
