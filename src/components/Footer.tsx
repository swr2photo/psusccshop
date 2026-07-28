'use client';

import {
  Facebook,
  Instagram,
  Mail,
  Shield,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

type TrustBadge =
  | { kind: 'logo'; src: string; label: string; alt: string }
  | { kind: 'icon'; icon: typeof Lock; label: string };

const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.1.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const OPEN_SUPPORT_CHAT_EVENT = 'psuscc:open-support-chat';

const FOOTER_BODY: CSSProperties = {
  color: 'color-mix(in oklab, var(--foreground) 72%, var(--text-muted))',
};

const FOOTER_LINK: CSSProperties = {
  ...FOOTER_BODY,
  textDecoration: 'none',
  transition: 'color 0.2s ease',
  fontSize: '0.875rem',
  lineHeight: 1.5,
};

const SECTION_TITLE: CSSProperties = {
  fontWeight: 800,
  color: 'var(--foreground)',
  marginBottom: '1rem',
  fontSize: '0.8125rem',
  letterSpacing: '0.04em',
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
    el.style.color = FOOTER_BODY.color as string;
  };

  if (external) {
    return (
      <a
        href={href}
        style={FOOTER_LINK}
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
      style={FOOTER_LINK}
      onMouseEnter={(e) => hoverIn(e.currentTarget)}
      onMouseLeave={(e) => hoverOut(e.currentTarget)}
    >
      {children}
    </Link>
  );
}

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

  const navLinks = [
    { href: '/', label: t.footer.home },
    { href: '/#product-grid', label: t.footer.allProducts },
    { href: '/#shop-section', label: t.footer.apparel },
    { href: '/#shop-section', label: t.footer.merchandise },
    { href: '/#events-section', label: t.footer.eventsCamps },
  ];

  const serviceLinks = [
    { href: '/#history', label: t.footer.checkStatus },
    { href: '/#payment', label: t.footer.payment },
    { href: '/terms', label: t.footer.refund },
    { href: '/privacy', label: t.footer.privacyPolicy, icon: true },
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

  return (
    <footer
      className="mt-auto border-t py-12"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 4-column grid: 1 col mobile → 2 sm → 4 md+ */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-10">
          {/* Brand */}
          <div>
            <h3
              style={{
                fontSize: '0.8125rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--foreground)',
                marginBottom: '0.85rem',
              }}
            >
              {t.footer.brandTitle}
            </h3>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                textDecoration: 'none',
                marginBottom: '0.75rem',
              }}
            >
              <Image
                src="/logo.png"
                alt="SCC Shop"
                width={40}
                height={40}
                className="theme-logo"
                style={{ borderRadius: 10 }}
              />
              <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                SCC SHOP
              </span>
            </Link>
            <p style={{ ...FOOTER_BODY, fontSize: '0.875rem', lineHeight: 1.65, margin: '0 0 0.75rem' }}>
              {t.footer.description}
            </p>
            <p
              style={{
                ...FOOTER_BODY,
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
          </div>

          {/* Navigation */}
          <div>
            <h4 style={SECTION_TITLE}>{t.footer.menuTitle}</h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {navLinks.map(({ href, label }) => (
                <li key={`${href}-${label}`}>
                  <FooterLink href={href}>{label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer service */}
          <div>
            <h4 style={SECTION_TITLE}>{t.footer.serviceTitle}</h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {serviceLinks.map(({ href, label, icon }) => (
                <li key={href}>
                  <FooterLink href={href}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      {icon ? <Shield size={13} /> : null}
                      {label}
                    </span>
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={SECTION_TITLE}>{t.footer.contactUs}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <FooterLink href="mailto:psuscc@psusci.club" external>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} />
                  psuscc@psusci.club
                </span>
              </FooterLink>
              <p
                style={{
                  ...FOOTER_BODY,
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
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                <a
                  href="https://facebook.com/psuscc"
                  title="Facebook"
                  aria-label="Facebook"
                  style={{ color: FOOTER_BODY.color as string, display: 'flex', transition: 'color 0.2s ease, transform 0.2s ease' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#1877f2';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = FOOTER_BODY.color as string;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Facebook size={20} />
                </a>
                <a
                  href="https://instagram.com/psuscc"
                  title="Instagram"
                  aria-label="Instagram"
                  style={{ color: FOOTER_BODY.color as string, display: 'flex', transition: 'color 0.2s ease, transform 0.2s ease' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#e1306c';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = FOOTER_BODY.color as string;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Instagram size={20} />
                </a>
                <a
                  href="mailto:psuscc@psusci.club"
                  title="Email"
                  aria-label="Email"
                  style={{ color: FOOTER_BODY.color as string, display: 'flex', transition: 'color 0.2s ease, transform 0.2s ease' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--success)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = FOOTER_BODY.color as string;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Mail size={20} />
                </a>
              </div>
              <button
                type="button"
                onClick={openSupportChat}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginTop: '0.15rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 10,
                  border: '1px solid var(--glass-border)',
                  background: 'var(--surface-2)',
                  color: 'var(--foreground)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-3)';
                  e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--primary) 35%, var(--glass-border))';
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

        {/* Trust capsules — Style A: original-color marks in muted pills */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
          role="list"
          aria-label="Trust badges"
        >
          {trustItems.map((item) => (
            <span
              key={item.label}
              role="listitem"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--glass-border)',
                color: 'var(--foreground)',
              }}
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

        {/* Copyright + version */}
        <div
          className="mt-8 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <p style={{ ...FOOTER_BODY, fontSize: '0.8125rem', margin: 0 }}>{copyright}</p>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowBuildInfo(!showBuildInfo)}
              title={t.footer.versionInfo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: FOOTER_BODY.color as string,
                background: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'color 0.2s ease, border-color 0.2s ease',
                padding: '4px 10px',
                borderRadius: 8,
                fontFamily: 'var(--font-geist-mono, monospace)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--primary) 30%, var(--glass-border))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = FOOTER_BODY.color as string;
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
                  color: FOOTER_BODY.color as string,
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
