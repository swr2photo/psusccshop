// store/languageStore.ts
// Language state management with Zustand + persistence

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'th' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LANGUAGE_STORAGE_KEY = 'language-storage';

/**
 * Map browser/system locale → shop language.
 * Thai (`th`, `th-TH`, …) → th; otherwise → en.
 */
function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'th';

  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean);

  for (const tag of candidates) {
    const primary = String(tag).toLowerCase().split('-')[0];
    if (primary === 'th') return 'th';
  }

  return 'en';
}

function hasSavedLanguagePreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      // Stable SSR / first-paint default (matches <html lang="th">).
      // System locale is applied after rehydrate when no preference is saved.
      language: 'th',
      setLanguage: (language) => set({ language }),
      toggleLanguage: () =>
        set((state) => ({ language: state.language === 'th' ? 'en' : 'th' })),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Respect an existing user (or prior) preference — do not override.
        if (hasSavedLanguagePreference()) return;

        const detected = detectBrowserLanguage();
        state.language = detected;
        // Persist via setState so the next visit keeps this choice.
        queueMicrotask(() => {
          useLanguageStore.setState({ language: detected });
        });
      },
    }
  )
);
