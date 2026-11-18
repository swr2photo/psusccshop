'use client';

import { useEffect } from 'react';
import { findFormFont, formFontStack, googleFontCssUrl } from '@/lib/form-fonts';

/** Inject the Google Fonts stylesheet once per URL (shared across components). */
export function useStylesheet(href: string | null) {
  useEffect(() => {
    if (!href || typeof document === 'undefined') return;
    if (document.querySelector(`link[data-form-font="${CSS.escape(href)}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.formFont = href;
    document.head.appendChild(link);
  }, [href]);
}

/** Loads the form's font and returns the `font-family` value to put on the form wrapper. */
export function useFormFont(family?: string | null): string | undefined {
  const font = findFormFont(family);
  useStylesheet(font ? googleFontCssUrl(font) : null);
  return formFontStack(family);
}
