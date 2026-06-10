import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psuscc.club';

/**
 * Server-rendered app identity block for OAuth branding review and crawlers.
 * Visible with JavaScript enabled (unlike the layout noscript fallback).
 */
export default function AppPurposeSection() {
  return (
    <section
      id="app-about"
      aria-label="About SCC Shop"
      style={{
        maxWidth: '72rem',
        margin: '0 auto',
        padding: '1rem 1.5rem 0',
      }}
    >
      <details
        open
        style={{
          border: '1px solid var(--glass-border, rgba(0,0,0,0.08))',
          borderRadius: '16px',
          background: 'var(--surface, #fff)',
          padding: '1rem 1.25rem',
          color: 'var(--foreground, #111)',
          lineHeight: 1.65,
          fontSize: '0.92rem',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '1.05rem',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>SCC Shop</span>
          <span style={{ fontWeight: 500, color: 'var(--text-muted, #666)', fontSize: '0.82rem' }}>
            — About this application
          </span>
        </summary>

        <div style={{ marginTop: '0.85rem' }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
            SCC Shop — PSU Science Computer Club Online Store
          </h1>

          <p style={{ margin: '0 0 0.75rem' }}>
            <strong>SCC Shop</strong> is the official online store of the Science Computer Club (SCC),
            Faculty of Science, Prince of Songkla University. The app lets students and members browse
            club merchandise, place orders, pay via PromptPay, and track order status in real time.
          </p>

          <p style={{ margin: '0 0 0.75rem' }}>
            <strong>SCC Shop</strong> คือร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ (Science Computer Club)
            คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ สำหรับสั่งซื้อเสื้อและสินค้าชุมนุม
            ชำระเงินผ่าน PromptPay และติดตามสถานะคำสั่งซื้อ
          </p>

          <p style={{ margin: '0 0 0.75rem' }}>
            Google Sign-In is used only to authenticate your account, identify your orders, and save your
            delivery profile. We do not sell your data. See our{' '}
            <Link href="/privacy" style={{ color: '#0071e3', fontWeight: 600 }}>
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" style={{ color: '#0071e3', fontWeight: 600 }}>
              Terms of Service
            </Link>
            .
          </p>

          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Operated by Science Computer Club, Faculty of Science, Prince of Songkla University ·{' '}
            <a href="mailto:psuscc@psusci.club" style={{ color: '#0071e3' }}>
              psuscc@psusci.club
            </a>{' '}
            · {SITE_URL}
          </p>
        </div>
      </details>
    </section>
  );
}
