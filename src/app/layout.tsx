import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeRegistry from "../components/ThemeRegistry";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PSU SCC SHOP",
  description: "ร้านค้าในชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased relative min-h-screen overflow-x-hidden`}>
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-10 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(90,200,250,0.35),transparent_65%)] blur-3xl" />
          <div className="absolute right-[-12%] top-10 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_70%_30%,rgba(124,138,255,0.28),transparent_60%)] blur-3xl" />
          <div className="absolute left-1/2 bottom-[-18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(52,211,153,0.28),transparent_60%)] blur-3xl" />
        </div>
        <ThemeRegistry>
          <Providers>
            <div className="relative z-10 min-h-screen">
              {children}
            </div>
          </Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}