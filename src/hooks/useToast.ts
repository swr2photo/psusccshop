'use client';

import { toast } from '@/components/ui/toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastOptions {
  duration?: number;
  preventDuplicate?: boolean;
}

/**
 * Thin wrapper around the shared Base UI toast manager.
 * Prefer importing `toast` from `@/components/ui/toast` for new code.
 */
export function useToast(options?: ToastOptions) {
  const defaultDuration = options?.duration ?? 4000;

  const addToast = (
    type: ToastType,
    title: string,
    message?: string,
    customDuration?: number,
  ): string =>
    toast.add({
      type,
      title,
      description: message,
      timeout: customDuration ?? (type === 'error' ? 5000 : defaultDuration),
      priority: type === 'error' ? 'high' : 'low',
    });

  const removeToast = (id: string) => toast.close(id);
  const clearAll = () => toast.close();

  return {
    toasts: [] as never[],
    addToast,
    removeToast,
    clearAll,
    success: (title: string, message?: string) => addToast('success', title, message),
    error: (title: string, message?: string) => addToast('error', title, message, 5000),
    warning: (title: string, message?: string) => addToast('warning', title, message),
    info: (title: string, message?: string) => addToast('info', title, message),
  };
}

export const TOAST_STYLES = {
  success: { color: '#10b981' },
  error: { color: '#ef4444' },
  warning: { color: '#f59e0b' },
  info: { color: '#3b82f6' },
} as const;

export const TOAST_ANIMATION_CSS = '';
