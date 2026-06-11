import type { Metadata, Viewport } from "next";
import * as Sentry from "@sentry/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeRegistry from "../components/ThemeRegistry";
import Script from "next/script";
import { SITE_URL } from "@/lib/site";
// Google Search Console — HTML tag (URL prefix). Override via GOOGLE_SITE_VERIFICATION in Vercel.
const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION?.trim() || '';

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// SEO & Open Graph Metadata
const siteMetadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "SCC Shop",
  title: {
    default: "SCC Shop - ร้านค้าออนไลน์ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    template: "%s | SCC Shop",
  },
  verification: GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : undefined,
  alternates: {
    canonical: SITE_URL,
  },
  description: "SCC Shop คือร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ (Science Computer Club) คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ จำหน่ายเสื้อชุมนุม เสื้อคณะ และสินค้าที่ระลึก สั่งซื้อง่าย ชำระเงินผ่าน PromptPay พร้อมระบบติดตามคำสั่งซื้อแบบเรียลไทม์ | The official online store of the PSU Science Computer Club for club shirts, faculty apparel, and souvenir merchandise.",
  keywords: ["SCC Shop", "ชุมนุมคอมพิวเตอร์", "PSU", "มหาวิทยาลัยสงขลานครินทร์", "เสื้อชุมนุม", "คณะวิทยาศาสตร์", "Prince of Songkla University", "online store", "ร้านค้าออนไลน์"],
  authors: [{ name: "PSU Science Computer Club" }],
  creator: "PSU Science Computer Club",
  publisher: "PSU Science Computer Club",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: "/",
    siteName: "SCC Shop",
    title: "SCC Shop - ร้านค้าออนไลน์ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    description: "SCC Shop คือร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ จำหน่ายเสื้อชุมนุม เสื้อคณะ และสินค้าที่ระลึก",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "SCC Shop Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SCC Shop - ร้านค้าออนไลน์ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    description: "SCC Shop คือร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ จำหน่ายเสื้อชุมนุม เสื้อคณะ และสินค้าที่ระลึก",
    images: ["/logo.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  category: "shopping",
} satisfies Metadata;

export function generateMetadata(): Metadata {
  return {
    ...siteMetadata,
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

// Viewport configuration (separated in Next.js 14+)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#040818" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" dir="ltr" suppressHydrationWarning>
      <head>
        {/* Preconnect to external resources for faster loading */}
        <link rel="preconnect" href="https://ipfs.filebase.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://s3.filebase.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ipfs.filebase.io" />
        <link rel="dns-prefetch" href="https://s3.filebase.com" />
        {/* Preconnect to Supabase for faster API/realtime */}
        {(process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL) && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/apple-icon-180.png" sizes="180x180" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SCC Shop" />
        <meta name="application-name" content="SCC Shop" />
        {GOOGLE_SITE_VERIFICATION ? (
          <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${SITE_URL}/#organization`,
                  name: 'SCC Shop',
                  alternateName: ['PSU SCC Shop', 'ชุมนุมคอมพิวเตอร์ ม.อ.'],
                  url: SITE_URL,
                  logo: `${SITE_URL}/logo.png`,
                  description:
                    'ร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
                },
                {
                  '@type': 'WebSite',
                  '@id': `${SITE_URL}/#website`,
                  name: 'SCC Shop',
                  url: SITE_URL,
                  publisher: { '@id': `${SITE_URL}/#organization` },
                  inLanguage: ['th-TH', 'en'],
                },
                {
                  '@type': 'OnlineStore',
                  '@id': `${SITE_URL}/#store`,
                  name: 'SCC Shop',
                  url: SITE_URL,
                  image: `${SITE_URL}/logo.png`,
                  description:
                    'Official online store of the Science Computer Club (SCC), Faculty of Science, Prince of Songkla University.',
                  publisher: { '@id': `${SITE_URL}/#organization` },
                  paymentAccepted: 'PromptPay',
                  currenciesAccepted: 'THB',
                },
              ],
            }),
          }}
        />
        {/* Workaround for React 19 script warnings */}
        <script
          id="console-filter"
          dangerouslySetInnerHTML={{
            __html: `(function(){
              if (window.console && window.console.error) {
                var orig = window.console.error;
                window.console.error = function() {
                  if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].indexOf('Encountered a script tag') !== -1) {
                    return;
                  }
                  orig.apply(window.console, arguments);
                };
              }
            })()`,
          }}
        />
        {/* Inline theme script — runs before React hydration to prevent FOUC */}
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('psusccshop-theme');if(s){var m=JSON.parse(s).state.mode;var r=m==='system'?window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark':m;document.documentElement.setAttribute('data-theme',r);document.documentElement.style.colorScheme=r}else{document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light'}}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light'}})()`,
          }}
        />
        {/* Force SW update + clear old caches on load */}
        <script
          id="sw-updater"
          dangerouslySetInnerHTML={{
            __html: `(function(){
              if('serviceWorker' in navigator){
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  regs.forEach(function(r){
                    ${process.env.NODE_ENV === 'development' ? 'r.unregister();' : 'r.update();'}
                  })
                });
                if (${process.env.NODE_ENV === 'development'}) {
                  caches.keys().then(function(names){
                    names.forEach(function(n){ caches.delete(n); })
                  });
                } else {
                  caches.keys().then(function(names){
                    names.forEach(function(n){if(n.indexOf('scc-shop-v2.3.0')===-1){caches.delete(n)}})
                  });
                }
              }
            })()`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased relative min-h-screen overflow-x-hidden`} suppressHydrationWarning={true}>
        {/* Skip to main content link for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-9999 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {/* Static fallback content for search engines and crawlers that don't execute JavaScript */}
        <noscript>
          <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.8 }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px' }}>SCC Shop — ร้านค้าออนไลน์ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์</h1>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>About This Application</h2>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>
              SCC Shop คือร้านค้าออนไลน์ของชุมนุมคอมพิวเตอร์ (Science Computer Club หรือ SCC) คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์
              จำหน่ายเสื้อชุมนุม เสื้อคณะ และสินค้าที่ระลึก สั่งซื้อง่าย ชำระเงินผ่าน PromptPay พร้อมระบบติดตามคำสั่งซื้อแบบเรียลไทม์
            </p>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>
              SCC Shop is the official online store of the Science Computer Club (SCC), Faculty of Science, Prince of Songkla University.
              We sell club shirts, faculty apparel, and souvenir merchandise. Order easily with PromptPay payment and real-time order tracking.
            </p>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Features</h2>
            <ul style={{ fontSize: '16px', marginBottom: '16px', paddingLeft: '24px' }}>
              <li>Browse and purchase club merchandise, faculty shirts, and souvenirs.</li>
              <li>Secure authentication via Google, Microsoft, Facebook, Apple, LINE, or Passkey.</li>
              <li>Pay easily via PromptPay QR code with automatic slip verification.</li>
              <li>Real-time order tracking and order history.</li>
              <li>The app uses your Google account name and email for login and order identification only.</li>
            </ul>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Legal &amp; Privacy</h2>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>
              <a href="/privacy" style={{ color: '#0071e3', textDecoration: 'underline', fontWeight: 600 }}>Privacy Policy (นโยบายความเป็นส่วนตัว)</a>
            </p>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>
              <a href="/terms" style={{ color: '#0071e3', textDecoration: 'underline', fontWeight: 600 }}>Terms of Service (ข้อกำหนดการใช้งาน)</a>
            </p>
            <p style={{ fontSize: '14px', color: '#666' }}>
              © {new Date().getFullYear()} Science Computer Club, Faculty of Science, Prince of Songkla University. All rights reserved.
            </p>
          </div>
        </noscript>
        {/* Decorative gradient orbs - theme-aware via CSS vars */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-10 -top-24 h-80 w-80 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle at 30% 30%, var(--glow-1), transparent 65%)' }} />
          <div className="absolute right-[-12%] top-10 h-96 w-96 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle at 70% 30%, var(--glow-2), transparent 60%)' }} />
          <div className="absolute left-1/2 bottom-[-18%] h-105 w-105 -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, var(--glow-3), transparent 60%)' }} />
        </div>
        <ThemeRegistry>
          <Providers>
            <div className="relative z-10 min-h-screen">
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
            </div>
          </Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}