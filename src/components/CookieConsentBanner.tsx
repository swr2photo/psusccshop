'use client';

import { useEffect, useState } from 'react';
import { Check, Cookie, Settings2, ChevronUp } from 'lucide-react';
import { Collapse, Switch } from '@mui/material';
import { useNotification, COOKIE_CATEGORIES, CookieCategory } from './NotificationContext';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

const OPT_IN_DEFAULT = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
} as const;

/**
 * Bottom floating cookie banner — non-blocking, PDPA opt-in defaults (OFF except essential).
 */
export default function CookieConsentBanner() {
  const { t } = useTranslation();
  const { showConsentBanner, acceptAll, acceptEssential, updateConsent, consent } =
    useNotification();
  const [showDetails, setShowDetails] = useState(false);
  const [customConsent, setCustomConsent] = useState({ ...OPT_IN_DEFAULT });

  useEffect(() => {
    if (!showConsentBanner) return;
    if (consent) {
      // Reopened from Privacy / settings — load saved prefs and expand panel
      setShowDetails(true);
      setCustomConsent({
        essential: true,
        functional: consent.functional === true,
        analytics: consent.analytics === true,
        marketing: consent.marketing === true,
      });
    } else {
      // First visit — compact banner, all non-essential OFF
      setShowDetails(false);
      setCustomConsent({ ...OPT_IN_DEFAULT });
    }
  }, [showConsentBanner, consent]);

  if (!showConsentBanner) return null;

  const handleSaveCustom = () => {
    updateConsent(customConsent);
  };

  const toggleCategory = (category: CookieCategory) => {
    if (category === 'essential') return;
    setCustomConsent((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-3 sm:p-4"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-label={t.cookie.title}
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--glass-border)]',
          'bg-[var(--background)]/95 text-[var(--foreground)] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl',
        )}
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0071e3] text-white shadow-sm">
            <Cookie size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] font-bold leading-snug">{t.cookie.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
              {t.cookie.description}{' '}
              <Link
                href="/privacy#s8"
                className="font-semibold text-[var(--foreground)] underline underline-offset-2"
              >
                {t.cookie.readMore}
              </Link>
            </p>
          </div>
        </div>

        {/* Compact actions (collapsed) */}
        {!showDetails && (
          <div className="flex flex-col gap-2 border-t border-[var(--glass-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:px-5">
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] sm:order-1 sm:mr-auto"
            >
              <Settings2 size={16} />
              {t.cookie.settings}
            </button>
            <button
              type="button"
              onClick={acceptEssential}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--glass-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)] sm:order-2"
            >
              {t.cookie.essentialOnly}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0071e3] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0060c2] sm:order-3"
            >
              <Check size={16} />
              {t.cookie.acceptAll}
            </button>
          </div>
        )}

        {/* Expanded settings */}
        <Collapse in={showDetails}>
          <div className="border-t border-[var(--glass-border)] px-4 pb-4 sm:px-5">
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="mb-3 mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)]"
            >
              <ChevronUp size={14} />
              {t.cookie.settings}
            </button>

            <div className="mb-3 space-y-2">
              {(Object.keys(COOKIE_CATEGORIES) as CookieCategory[]).map((category) => {
                const info = COOKIE_CATEGORIES[category];
                const isEnabled = customConsent[category];
                const isRequired = info.required;

                return (
                  <div
                    key={category}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                      isEnabled
                        ? 'border-[#0071e3]/25 bg-[#0071e3]/6'
                        : 'border-[var(--glass-border)] bg-[var(--surface)]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold">{info.name}</span>
                        {isRequired && (
                          <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--text-muted)]">
                            {t.cookie.essential}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-snug text-[var(--text-muted)]">{info.description}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      disabled={isRequired}
                      onChange={() => toggleCategory(category)}
                      size="small"
                      inputProps={{ 'aria-label': info.name }}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#0071e3' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          bgcolor: '#0071e3',
                          opacity: 0.5,
                        },
                        '& .MuiSwitch-switchBase.Mui-disabled': { color: '#34c759' },
                        '& .MuiSwitch-switchBase.Mui-disabled + .MuiSwitch-track': {
                          bgcolor: 'rgba(52,199,89,0.45)',
                          opacity: 1,
                        },
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={acceptEssential}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--glass-border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]"
              >
                {t.cookie.essentialOnly}
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0071e3] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0060c2]"
              >
                <Check size={16} />
                {t.cookie.saveSettings}
              </button>
            </div>
          </div>
        </Collapse>
      </div>
    </div>
  );
}
