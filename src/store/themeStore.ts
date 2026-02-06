// store/themeStore.ts
// Theme state management with Zustand + persistence

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  /** Resolved mode (always 'light' or 'dark') */
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  /** Called internally to resolve 'system' → actual mode */
  _resolveSystemMode: () => void;
}

/**
 * Get system preferred color scheme
 */
function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Resolve theme mode to actual 'light' or 'dark'
 */
function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return getSystemPreference();
  return mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedMode: typeof window === 'undefined' ? 'dark' : resolveMode('system'),
      
      setMode: (mode: ThemeMode) => {
        const resolved = resolveMode(mode);
        set({ mode, resolvedMode: resolved });
        // Update data-theme attribute on HTML element
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', resolved);
          document.documentElement.style.colorScheme = resolved;
        }
      },
      
      toggleMode: () => {
        const current = get().resolvedMode;
        const next = current === 'dark' ? 'light' : 'dark';
        set({ mode: next, resolvedMode: next });
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', next);
          document.documentElement.style.colorScheme = next;
        }
      },
      
      _resolveSystemMode: () => {
        const { mode } = get();
        if (mode === 'system') {
          const resolved = getSystemPreference();
          set({ resolvedMode: resolved });
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', resolved);
            document.documentElement.style.colorScheme = resolved;
          }
        }
      },
    }),
    {
      name: 'psusccshop-theme',
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveMode(state.mode);
          state.resolvedMode = resolved;
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', resolved);
            document.documentElement.style.colorScheme = resolved;
          }
        }
      },
    }
  )
);

// Listen for system preference changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    useThemeStore.getState()._resolveSystemMode();
  });
}
