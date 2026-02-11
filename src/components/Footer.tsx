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
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand */}
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 bg-gradient-to-r from-indigo-500 dark:from-indigo-400 to-cyan-500 dark:to-cyan-400 bg-clip-text text-transparent w-fit">
            PSUSCCSHOP
          </h3>
          <p className="text-sm">
            {t.footer.description}
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-bold text-slate-800 dark:text-white mb-4">{t.footer.menuTitle}</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-indigo-400 transition flex items-center gap-2">
                {t.footer.home}
              </Link>
            </li>
            <li>
              <Link href="/#payment" className="hover:text-indigo-400 transition flex items-center gap-2">
                {t.footer.payment}
              </Link>
            </li>
            <li>
              <Link href="/#history" className="hover:text-indigo-400 transition flex items-center gap-2">
                {t.footer.checkStatus}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-indigo-400 transition flex items-center gap-2">
                <Shield size={14} />
                {t.footer.privacyPolicy}
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-bold text-slate-800 dark:text-white mb-4">{t.footer.contactUs}</h4>
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
            title={t.footer.versionInfo}
          >
            <Info size={12} />
            <span className="font-mono">v{APP_VERSION}</span>
          </button>
          
          {showBuildInfo && (
            <span className="text-slate-600 font-mono animate-fade-in">
              • build {BUILD_VERSION} • {formatBuildTime(BUILD_TIME)}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
