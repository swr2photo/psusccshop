'use client';

import { Facebook, Instagram, Mail, Shield, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

// Build info from environment (set at build time)
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.1.0';

export default function Footer() {
  const { t } = useTranslation();
  const [showBuildInfo, setShowBuildInfo] = useState(false);
  
  // Format build time for display
  const formatBuildTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
      });
    } catch {
      return iso;
    }
  };
  return (
    <footer style={{
      background: 'var(--surface)',
      borderTop: '1px solid var(--glass-border)',
      color: 'var(--text-muted)',
      paddingTop: '2.5rem',
      paddingBottom: '2rem',
      marginTop: 'auto',
    }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          {/* Brand */}
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', display: 'inline-block' }}>
              SCC SHOP
            </h3>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              {t.footer.description}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {t.footer.menuTitle}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
              {[
                { href: '/', label: t.footer.home },
                { href: '/#payment', label: t.footer.payment },
                { href: '/#history', label: t.footer.checkStatus },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} style={{
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/privacy" style={{
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Shield size={13} />
                  {t.footer.privacyPolicy}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {t.footer.contactUs}
            </h4>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              <a href="https://facebook.com/psuscc" title="Facebook"
                style={{ color: 'var(--text-muted)', transition: 'color 0.2s ease, transform 0.2s ease', display: 'flex' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#1877f2'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
              >
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com/psuscc" title="Instagram"
                style={{ color: 'var(--text-muted)', transition: 'color 0.2s ease, transform 0.2s ease', display: 'flex' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#e1306c'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
              >
                <Instagram size={20} />
              </a>
              <a href="mailto:psuscc@psusci.club" title="Email"
                style={{ color: 'var(--text-muted)', transition: 'color 0.2s ease, transform 0.2s ease', display: 'flex' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--success)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
              >
                <Mail size={20} />
              </a>
            </div>
            <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>
              © {new Date().getFullYear()} PSUSCCSHOP. All rights reserved.
            </p>
          </div>
        </div>

        {/* Build Version */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => setShowBuildInfo(!showBuildInfo)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              transition: 'color 0.2s ease',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title={t.footer.versionInfo}
          >
            <Info size={12} />
            <span style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}>v{APP_VERSION}</span>
          </button>

          {showBuildInfo && (
            <span className="animate-fade-in" style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-geist-mono, monospace)',
              alignSelf: 'center',
              marginLeft: '0.5rem',
            }}>
              • build {BUILD_VERSION} • {formatBuildTime(BUILD_TIME)}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

