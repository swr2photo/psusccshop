// hooks/useTranslation.ts
'use client';

import { useMemo } from 'react';
import { useLanguageStore } from '@/store/languageStore';
import { getTranslations, type Translations } from '@/lib/i18n/translations';

/**
 * Hook to get translations for the current language.
 * 
 * Usage:
 *   const { t, lang, toggleLanguage } = useTranslation();
 *   t.common.close  → 'ปิด' or 'Close'
 *   t.nav.home      → 'หน้าแรก' or 'Home'
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  const t: Translations = useMemo(() => getTranslations(language), [language]);

  return { t, lang: language, setLanguage, toggleLanguage };
}
