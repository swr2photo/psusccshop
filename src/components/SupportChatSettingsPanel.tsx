'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Image as ImageIcon,
  Mic,
  Palette,
  Rows3,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { VoiceMessage } from '@/components/ui/voice-message';
import { parseChatMessage } from '@/lib/chat-message';
import { cn } from '@/lib/utils';
import type { CustomerChatPrefs } from '@/lib/customer-chat-prefs';

type ChatMessageLike = {
  id: string;
  message: string;
  created_at: string;
  is_unsent?: boolean;
};

type MediaItem =
  | { kind: 'image'; id: string; url: string; at: string }
  | { kind: 'voice'; id: string; url: string; duration: number | null; at: string };

export type SupportChatSettingsLabels = {
  settingsTitle: string;
  sectionCustomize: string;
  sectionMedia: string;
  sectionPrivacy: string;
  sectionHelp: string;
  muteNotifications: string;
  muteNotificationsDesc: string;
  soundToggle: string;
  soundToggleDesc: string;
  compactDensity: string;
  compactDensityDesc: string;
  primaryBubbles: string;
  primaryBubblesDesc: string;
  changeTheme: string;
  changeThemeDesc: string;
  currentTheme: string;
  mediaGallery: string;
  mediaGalleryDesc: string;
  noMedia: string;
  images: string;
  voiceMessages: string;
  faqSupport: string;
  faqSupportDesc: string;
  back: string;
  on: string;
  off: string;
};

type SupportChatSettingsPanelProps = {
  prefs: CustomerChatPrefs;
  onPrefsChange: (next: CustomerChatPrefs) => void;
  messages: ChatMessageLike[];
  labels: SupportChatSettingsLabels;
  onBack: () => void;
  /** Open theme picker (Messenger-style preview modal) */
  onChangeTheme?: () => void;
  /** When mute turns on — optional side effect (e.g. unsubscribe push) */
  onMuteEnabled?: () => void;
  pushLoading?: boolean;
  /** Desktop sidebar: hide back chevron / use compact title */
  sidebar?: boolean;
  /** Optional profile header (name + avatar) for Messenger-style info pane */
  profile?: { name: string; avatarUrl?: string | null; status?: string };
};

function SettingsRow({
  icon,
  title,
  description,
  trailing,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-3 text-left transition',
        onClick && !disabled && 'hover:bg-[var(--surface-2)]',
        disabled && 'opacity-50'
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9rem] font-medium text-foreground">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-[0.75rem] leading-snug text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      {trailing}
    </Comp>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
          {title}
        </span>
        {open ? (
          <ChevronDown className="size-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="size-4 text-[var(--text-muted)]" />
        )}
      </button>
      {open ? <div className="divide-y divide-[var(--glass-border)] border-t border-[var(--glass-border)]">{children}</div> : null}
    </section>
  );
}

function collectMedia(messages: ChatMessageLike[]): MediaItem[] {
  const items: MediaItem[] = [];
  for (const msg of messages) {
    if (msg.is_unsent) continue;
    const parsed = parseChatMessage(msg.message);
    if (parsed.imageUrl) {
      items.push({ kind: 'image', id: msg.id, url: parsed.imageUrl, at: msg.created_at });
    }
    if (parsed.voiceUrl) {
      items.push({
        kind: 'voice',
        id: `${msg.id}-voice`,
        url: parsed.voiceUrl,
        duration: parsed.voiceDuration,
        at: msg.created_at,
      });
    }
  }
  return items.reverse();
}

export function SupportChatSettingsPanel({
  prefs,
  onPrefsChange,
  messages,
  labels,
  onBack,
  onChangeTheme,
  onMuteEnabled,
  pushLoading,
  sidebar = false,
  profile,
}: SupportChatSettingsPanelProps) {
  const [customizeOpen, setCustomizeOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(true);
  const [view, setView] = useState<'root' | 'media'>('root');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const media = useMemo(() => collectMedia(messages), [messages]);
  const images = media.filter((m): m is Extract<MediaItem, { kind: 'image' }> => m.kind === 'image');
  const voices = media.filter((m): m is Extract<MediaItem, { kind: 'voice' }> => m.kind === 'voice');

  if (view === 'media') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--surface-2)]">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--glass-border)] bg-[var(--surface)] px-3 py-2.5">
          <button
            type="button"
            aria-label={labels.back}
            onClick={() => setView('root')}
            className="flex size-9 items-center justify-center rounded-full text-foreground transition hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.95rem] font-semibold text-foreground">{labels.mediaGallery}</p>
            <p className="text-[0.72rem] text-[var(--text-muted)]">
              {images.length} {labels.images} · {voices.length} {labels.voiceMessages}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {media.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">{labels.noMedia}</p>
          ) : (
            <>
              {images.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {labels.images}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewUrl(item.url)}
                        className="aspect-square overflow-hidden rounded-lg bg-[var(--surface)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {voices.length > 0 && (
                <div>
                  <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {labels.voiceMessages}
                  </p>
                  <div className="space-y-2">
                    {voices.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface)] p-2"
                      >
                        <VoiceMessage src={item.url} duration={item.duration} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {previewUrl && (
          <button
            type="button"
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPreviewUrl(null)}
            aria-label={labels.back}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-2)]">
      {!sidebar ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--glass-border)] bg-[var(--surface)] px-3 py-2.5">
          <button
            type="button"
            aria-label={labels.back}
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-full text-foreground transition hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="size-5" />
          </button>
          <p className="truncate text-[0.95rem] font-semibold text-foreground">{labels.settingsTitle}</p>
        </div>
      ) : profile ? (
        <div className="flex shrink-0 flex-col items-center gap-2 border-b border-[var(--glass-border)] bg-[var(--surface)] px-4 py-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.avatarUrl || '/favicon.png'}
            alt=""
            className="size-16 rounded-full object-cover ring-1 ring-[var(--glass-border)]"
          />
          <div className="min-w-0">
            <p className="truncate text-[1rem] font-semibold text-foreground">{profile.name}</p>
            {profile.status ? (
              <p className="text-[0.75rem] text-[var(--text-muted)]">{profile.status}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center border-b border-[var(--glass-border)] bg-[var(--surface)] px-3 py-2.5">
          <p className="truncate text-[0.95rem] font-semibold text-foreground">{labels.settingsTitle}</p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Section
          title={labels.sectionCustomize}
          open={customizeOpen}
          onToggle={() => setCustomizeOpen((v) => !v)}
        >
          <SettingsRow
            icon={prefs.soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            title={labels.soundToggle}
            description={labels.soundToggleDesc}
            trailing={
              <Switch
                checked={prefs.soundEnabled}
                onCheckedChange={(checked) => onPrefsChange({ ...prefs, soundEnabled: checked })}
                size="sm"
              />
            }
          />
          <SettingsRow
            icon={<Rows3 className="size-4" />}
            title={labels.compactDensity}
            description={labels.compactDensityDesc}
            trailing={
              <Switch
                checked={prefs.compact}
                onCheckedChange={(checked) => onPrefsChange({ ...prefs, compact: checked })}
                size="sm"
              />
            }
          />
          {onChangeTheme ? (
            <SettingsRow
              icon={<Palette className="size-4" />}
              title={labels.changeTheme}
              description={
                labels.currentTheme
                  ? `${labels.changeThemeDesc} · ${labels.currentTheme}`
                  : labels.changeThemeDesc
              }
              trailing={<ChevronRight className="size-4 text-[var(--text-muted)]" />}
              onClick={onChangeTheme}
            />
          ) : (
            <SettingsRow
              icon={<Palette className="size-4" />}
              title={labels.primaryBubbles}
              description={labels.primaryBubblesDesc}
              trailing={
                <Switch
                  checked={prefs.primaryBubbles}
                  onCheckedChange={(checked) => onPrefsChange({ ...prefs, primaryBubbles: checked })}
                  size="sm"
                />
              }
            />
          )}
        </Section>

        <Section title={labels.sectionMedia} open={mediaOpen} onToggle={() => setMediaOpen((v) => !v)}>
          <SettingsRow
            icon={<ImageIcon className="size-4" />}
            title={labels.mediaGallery}
            description={
              media.length
                ? `${images.length} ${labels.images} · ${voices.length} ${labels.voiceMessages}`
                : labels.mediaGalleryDesc
            }
            trailing={<ChevronRight className="size-4 text-[var(--text-muted)]" />}
            onClick={() => setView('media')}
          />
          {voices.length > 0 && (
            <SettingsRow
              icon={<Mic className="size-4" />}
              title={labels.voiceMessages}
              description={`${voices.length}`}
              trailing={<ChevronRight className="size-4 text-[var(--text-muted)]" />}
              onClick={() => setView('media')}
            />
          )}
        </Section>

        <Section title={labels.sectionPrivacy} open={privacyOpen} onToggle={() => setPrivacyOpen((v) => !v)}>
          <SettingsRow
            icon={prefs.muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
            title={labels.muteNotifications}
            description={`${labels.muteNotificationsDesc} (${prefs.muted ? labels.on : labels.off})`}
            trailing={
              <Switch
                checked={prefs.muted}
                disabled={pushLoading}
                onCheckedChange={(checked) => {
                  onPrefsChange({ ...prefs, muted: checked });
                  if (checked) onMuteEnabled?.();
                }}
                size="sm"
              />
            }
          />
        </Section>

        <Section title={labels.sectionHelp} open={helpOpen} onToggle={() => setHelpOpen((v) => !v)}>
          <SettingsRow
            icon={<HelpCircle className="size-4" />}
            title={labels.faqSupport}
            description={labels.faqSupportDesc}
            trailing={<ChevronRight className="size-4 text-[var(--text-muted)]" />}
            onClick={() => {
              window.location.href = '/faq';
            }}
          />
        </Section>
      </div>
    </div>
  );
}
