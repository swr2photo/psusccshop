'use client';

import { Facebook, Instagram, Mail, Shield, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Build info from environment (set at build time)
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

export default function Footer() {
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
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand */}
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 bg-gradient-to-r from-indigo-500 dark:from-indigo-400 to-cyan-500 dark:to-cyan-400 bg-clip-text text-transparent w-fit">
            PSUSCCSHOP
          </h3>
          <p className="text-sm">
            ร้านค้าในชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-bold text-slate-800 dark:text-white mb-4">เมนู</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-indigo-400 transition flex items-center gap-2">
                หน้าแรก
              </Link>
            </li>
            <li>
              <Link href="/#payment" className="hover:text-indigo-400 transition flex items-center gap-2">
                แจ้งชำระเงิน
              </Link>
            </li>
            <li>
              <Link href="/#history" className="hover:text-indigo-400 transition flex items-center gap-2">
                ตรวจสอบสถานะ
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-indigo-400 transition flex items-center gap-2">
                <Shield size={14} />
                นโยบายความเป็นส่วนตัว
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-bold text-slate-800 dark:text-white mb-4">ติดต่อเรา</h4>
          <div className="flex gap-4 mb-4">
            <a href="https://facebook.com/psuscc" className="hover:text-indigo-500 transition" title="Facebook">
              <Facebook size={20} />
            </a>
            <a href="https://instagram.com/psuscc" className="hover:text-pink-500 transition" title="Instagram">
              <Instagram size={20} />
            </a>
            <a href="mailto:psuscc@psusci.club" className="hover:text-emerald-500 transition" title="Email">
              <Mail size={20} />
            </a>
          </div>
          <p className="text-xs opacity-50">
            © {new Date().getFullYear()} PSUSCCSHOP. All rights reserved.
          </p>
        </div>
      </div>
      
      {/* Build Version */}
      <div className="max-w-6xl mx-auto px-6 mt-6 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            onClick={() => setShowBuildInfo(!showBuildInfo)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-400 transition-colors"
            title="ข้อมูลเวอร์ชัน"
          >
            <Info size={12} />
            <span className="font-mono">{BUILD_VERSION}</span>
          </button>
          
          {showBuildInfo && (
            <span className="text-slate-600 font-mono animate-fade-in">
              • อัปเดต: {formatBuildTime(BUILD_TIME)}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
