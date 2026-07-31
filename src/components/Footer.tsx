'use client';

import {
  Facebook,
  Instagram,
  Mail,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

type TrustBadge =
  | { kind: 'logo'; src: string; label: string; alt: string }
  | { kind: 'icon'; icon: typeof Lock; label: string };

const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.1.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const OPEN_SUPPORT_CHAT_EVENT = 'psuscc:open-support-chat';

const MUTED: CSSProperties = {
  color: 'color-mix(in oklab, var(--foreground) 68%, var(--text-muted))',
};

const LINK: CSSProperties = {
  ...MUTED,
  textDecoration: 'none',
  transition: 'color 0.18s ease',
  fontSize: '0.875rem',
  lineHeight: 1.45,
  fontWeight: 500,
};

const SECTION_LABEL: CSSProperties = {
  fontWeight: 800,
  color: 'var(--foreground)',
  marginBottom: '1.1rem',
  fontSize: '0.68rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const hoverIn = (el: HTMLElement) => {
    el.style.color = 'var(--primary)';
  };
  const hoverOut = (el: HTMLElement) => {
    el.style.color = MUTED.color as string;
  };

  if (external) {
    return (
      <a
        href={href}
        style={LINK}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        onMouseEnter={(e) => hoverIn(e.currentTarget)}
        onMouseLeave={(e) => hoverOut(e.currentTarget)}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      style={LINK}
      onMouseEnter={(e) => hoverIn(e.currentTarget)}
      onMouseLeave={(e) => hoverOut(e.currentTarget)}
    >
      {children}
    </Link>
  );
}

function LinkList({ items }: { items: Array<{ href: string; label: string }> }) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
      }}
    >
      {items.map(({ href, label }) => (
        <li key={`${href}-${label}`}>
          <FooterLink href={href}>{label}</FooterLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Storefront footer inspired by Pop Culture Depot:
 * brand strip, uppercase columns, hairline dividers, solid links.
 */
export default function Footer() {
  const { t } = useTranslation();
  const [showBuildInfo, setShowBuildInfo] = useState(false);

  const formatBuildTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
      });
    } catch {
      return iso;
    }
  };

  const openSupportChat = () => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_CHAT_EVENT));
  };

  const shopLinks = [
    { href: '/', label: t.footer.home },
    { href: '/#product-grid', label: t.footer.allProducts },
    { href: '/#shop-section', label: t.footer.apparel },
    { href: '/#shop-section', label: t.footer.merchandise },
    { href: '/#events-section', label: t.footer.eventsCamps },
  ];

  const helpLinks = [
    { href: '/faq', label: t.footer.faq },
    { href: '/#history', label: t.footer.checkStatus },
    { href: '/#payment', label: t.footer.payment },
    { href: '/terms', label: t.footer.refund },
  ];

  const legalLinks = [
    { href: '/privacy', label: t.footer.privacyPolicy },
    { href: '/terms', label: t.footer.termsOfService },
  ];

  const trustItems: TrustBadge[] = [
    {
      kind: 'logo',
      src: '/trust/promptpay.svg',
      label: t.footer.trustPromptPay,
      alt: t.footer.trustPromptPay,
    },
    {
      kind: 'logo',
      src: '/trust/slipok.svg',
      label: t.footer.trustSlipOk,
      alt: t.footer.trustSlipOk,
    },
    { kind: 'icon', icon: Lock, label: t.footer.trustSsl },
    { kind: 'icon', icon: ShieldCheck, label: t.footer.trustPdpa },
  ];

  const year = new Date().getFullYear();
  const copyright = t.footer.copyright.replace('{year}', String(year));
  const envLabel = IS_PRODUCTION ? t.footer.production : t.footer.development;

  const socialHover = (color: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = color;
    },
    onMouseLeave: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = MUTED.color as string;
    },
  });

  return (
    <footer
      className="mt-auto"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--glass-border)',
        color: 'var(--foreground)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Brand strip */}
        <div
          className="flex flex-col gap-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <div className="min-w-0">
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-3 no-underline"
            >
              <Image
                src="/logo.png"
                alt="SCC Shop"
                width={40}
                height={40}
                className="theme-logo"
                style={{ borderRadius: 10 }}
              />
              <span className="flex flex-col leading-none">
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--foreground)',
                  }}
                >
                  SCC
                </span>
                <span
                  style={{
                    marginTop: 4,
                    alignSelf: 'flex-start',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.62rem',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Shop
                </span>
              </span>
            </Link>
            <p
              style={{
                ...MUTED,
                fontSize: '0.875rem',
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 420,
              }}
            >
              {t.footer.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <span style={SECTION_LABEL}>{t.footer.followUs}</span>
            <div className="flex items-center gap-4">
              <a
                href="https://facebook.com/psuscc"
                title="Facebook"
                aria-label="Facebook"
                style={{ color: MUTED.color as string, display: 'flex', transition: 'color 0.18s ease' }}
                {...socialHover('#1877f2')}
              >
                <Facebook size={20} />
              </a>
              <a
                href="https://instagram.com/psuscc"
                title="Instagram"
                aria-label="Instagram"
                style={{ color: MUTED.color as string, display: 'flex', transition: 'color 0.18s ease' }}
                {...socialHover('#e1306c')}
              >
                <Instagram size={20} />
              </a>
              <a
                href="mailto:psuscc@psuscc.club"
                title="Email"
                aria-label="Email"
                style={{ color: MUTED.color as string, display: 'flex', transition: 'color 0.18s ease' }}
                {...socialHover('var(--success)')}
              >
                <Mail size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Columns — Shop / Help / Legal / Contact */}
        <div className="grid grid-cols-1 gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <h4 style={SECTION_LABEL}>{t.footer.menuTitle}</h4>
            <LinkList items={shopLinks} />
          </div>

          <div>
            <h4 style={SECTION_LABEL}>{t.footer.serviceTitle}</h4>
            <LinkList items={helpLinks} />
          </div>

          <div>
            <h4 style={SECTION_LABEL}>{t.footer.brandTitle}</h4>
            <LinkList items={legalLinks} />
            <p
              style={{
                ...MUTED,
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                margin: '1.25rem 0 0',
              }}
            >
              {t.footer.description}
            </p>
          </div>

          <div>
            <h4 style={SECTION_LABEL}>{t.footer.contactUs}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <FooterLink href="mailto:psuscc@psuscc.club" external>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Mail size={14} />
                  psuscc@psuscc.club
                </span>
              </FooterLink>
              <p
                style={{
                  ...MUTED,
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.4rem',
                }}
              >
                <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, opacity: 0.85 }} />
                <span>{t.footer.location}</span>
              </p>
              <button
                type="button"
                onClick={openSupportChat}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginTop: '0.15rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border)',
                  background: 'var(--surface-2)',
                  color: 'var(--foreground)',
                  fontSize: '0.8125rem',
                  fontWeight: 650,
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, border-color 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-3)';
                  e.currentTarget.style.borderColor =
                    'color-mix(in oklab, var(--primary) 35%, var(--glass-border))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                <MessageCircle size={15} />
                {t.footer.supportChat}
              </button>
            </div>
          </div>
        </div>

        {/* Trust / payment marks */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-6"
          style={{ borderTop: '1px solid var(--glass-border)' }}
          role="list"
          aria-label="Trust badges"
        >
          {trustItems.map((item) => (
            <span
              key={item.label}
              role="listitem"
              className="inline-flex items-center gap-2 text-xs font-semibold"
              style={{ color: MUTED.color as string }}
              aria-label={item.label}
            >
              {item.kind === 'logo' ? (
                <img
                  src={item.src}
                  alt={item.alt}
                  width={22}
                  height={22}
                  className="shrink-0"
                  style={{ width: 22, height: 22, objectFit: 'contain' }}
                />
              ) : (
                <item.icon
                  size={15}
                  aria-hidden
                  style={{ color: 'var(--primary)', flexShrink: 0 }}
                />
              )}
              <span>{item.label}</span>
            </span>
          ))}
        </div>

        {/* Copyright */}
        <div
          className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          <p style={{ ...MUTED, fontSize: '0.8125rem', margin: 0 }}>{copyright}</p>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowBuildInfo(!showBuildInfo)}
              title={t.footer.versionInfo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: MUTED.color as string,
                background: 'transparent',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'color 0.18s ease, border-color 0.18s ease',
                padding: '4px 10px',
                borderRadius: 6,
                fontFamily: 'var(--font-geist-mono, monospace)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.borderColor =
                  'color-mix(in oklab, var(--primary) 30%, var(--glass-border))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = MUTED.color as string;
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <Info size={12} />
              <span>
                v{APP_VERSION} ({envLabel})
              </span>
            </button>

            {showBuildInfo && (
              <span
                className="animate-fade-in"
                style={{
                  fontSize: '0.7rem',
                  color: MUTED.color as string,
                  fontFamily: 'var(--font-geist-mono, monospace)',
                }}
              >
                build {BUILD_VERSION} · {formatBuildTime(BUILD_TIME)}
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
