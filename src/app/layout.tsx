import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeRegistry from "../components/ThemeRegistry";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// SEO & Open Graph Metadata
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://psusccshop.vercel.app'),
  title: {
    default: "SCC Shop - ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.",
    template: "%s | SCC Shop",
  },
  description: "ร้านค้าในชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ จำหน่ายเสื้อและสินค้าที่ระลึก",
  keywords: ["SCC Shop", "ชุมนุมคอมพิวเตอร์", "PSU", "มหาวิทยาลัยสงขลานครินทร์", "เสื้อชุมนุม", "คณะวิทยาศาสตร์"],
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
    title: "SCC Shop - ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.",
    description: "ร้านค้าในชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
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
    title: "SCC Shop - ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.",
    description: "ร้านค้าในชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
    images: ["/logo.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  category: "shopping",
};

// Viewport configuration (separated in Next.js 14+)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
        {/* Inline theme script — runs before React hydration to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('psusccshop-theme');if(s){var m=JSON.parse(s).state.mode;var r=m==='system'?window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark':m;document.documentElement.setAttribute('data-theme',r);document.documentElement.style.colorScheme=r}else{var r=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',r);document.documentElement.style.colorScheme=r}}catch(e){}})()`,
          }}
        />
        {/* Preconnect to external resources for faster loading */}
        <link rel="preconnect" href="https://ipfs.filebase.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://s3.filebase.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ipfs.filebase.io" />
        <link rel="dns-prefetch" href="https://s3.filebase.com" />
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SCC Shop" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased relative min-h-screen overflow-x-hidden`}>
        {/* Skip to main content link for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {/* Decorative gradient orbs - theme-aware via CSS vars */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-10 -top-24 h-80 w-80 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle at 30% 30%, var(--glow-1), transparent 65%)' }} />
          <div className="absolute right-[-12%] top-10 h-96 w-96 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle at 70% 30%, var(--glow-2), transparent 60%)' }} />
          <div className="absolute left-1/2 bottom-[-18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, var(--glow-3), transparent 60%)' }} />
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