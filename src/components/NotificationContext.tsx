'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  CookieConsent,
  CookieCategory,
  COOKIE_CATEGORIES,
  getConsentState,
  saveConsentState,
  acceptAllCookies,
  acceptEssentialOnly,
  hasConsentBeenSet,
  recordLastVisit,
} from '@/lib/cookies';

import { formatFriendlyError as formatError } from '@/utils/error';
import { toast, useToastManager } from '@/components/ui/toast';

function formatFriendlyError(title: string, message?: string): { title: string; message?: string } {
  return {
    title: formatError(title),
    message: message ? formatError(message) : undefined,
  };
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  dismissible?: boolean;
}

interface NotificationContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  consent: CookieConsent | null;
  showConsentBanner: boolean;
  setShowConsentBanner: (show: boolean) => void;
  reopenConsentSettings: () => void;
  acceptAll: () => void;
  acceptEssential: () => void;
  updateConsent: (consent: Partial<Omit<CookieConsent, 'timestamp' | 'version'>>) => void;
  hasConsent: (category: CookieCategory) => boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function mapManagerToasts(
  items: ReturnType<typeof useToastManager>['toasts'],
): Toast[] {
  return items.map((item) => ({
    id: item.id,
    type: (item.type as ToastType) || 'info',
    title: typeof item.title === 'string' ? item.title : String(item.title ?? ''),
    message:
      typeof item.description === 'string'
        ? item.description
        : item.description != null
          ? String(item.description)
          : undefined,
    duration: item.timeout,
  }));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const manager = useToastManager();

  useEffect(() => {
    const savedConsent = getConsentState();
    setConsent(savedConsent);

    if (!hasConsentBeenSet()) {
      const timer = setTimeout(() => setShowConsentBanner(true), 1500);
      return () => clearTimeout(timer);
    }

    if (savedConsent?.functional) {
      recordLastVisit();
    }
  }, []);

  const addToast = useCallback((payload: Omit<Toast, 'id'>): string => {
    return toast.add({
      type: payload.type,
      title: payload.title,
      description: payload.message,
      timeout: payload.duration ?? (payload.type === 'error' ? 6000 : 4000),
      priority: payload.type === 'error' ? 'high' : 'low',
      actionProps: payload.action
        ? {
            children: payload.action.label,
            onClick: payload.action.onClick,
          }
        : undefined,
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    toast.close(id);
  }, []);

  const clearAllToasts = useCallback(() => {
    for (const item of manager.toasts) {
      toast.close(item.id);
    }
  }, [manager.toasts]);

  const success = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'success', title, message }),
    [addToast],
  );

  const error = useCallback(
    (title: string, message?: string) => {
      const formatted = formatFriendlyError(title, message);
      return addToast({
        type: 'error',
        title: formatted.title,
        message: formatted.message,
        duration: 6000,
      });
    },
    [addToast],
  );

  const warning = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'warning', title, message }),
    [addToast],
  );

  const info = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'info', title, message }),
    [addToast],
  );

  const acceptAll = useCallback(() => {
    const newConsent = acceptAllCookies();
    setConsent(newConsent);
    setShowConsentBanner(false);
    recordLastVisit();
  }, []);

  const acceptEssential = useCallback(() => {
    const newConsent = acceptEssentialOnly();
    setConsent(newConsent);
    setShowConsentBanner(false);
  }, []);

  const updateConsent = useCallback(
    (newConsent: Partial<Omit<CookieConsent, 'timestamp' | 'version'>>) => {
      const savedConsent = saveConsentState(newConsent);
      setConsent(savedConsent);
      setShowConsentBanner(false);
    },
    [],
  );

  const checkHasConsent = useCallback(
    (category: CookieCategory): boolean => {
      if (category === 'essential') return true;
      return consent?.[category] ?? false;
    },
    [consent],
  );

  const reopenConsentSettings = useCallback(() => {
    setShowConsentBanner(true);
  }, []);

  const value: NotificationContextValue = {
    toasts: mapManagerToasts(manager.toasts),
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
    consent,
    showConsentBanner,
    setShowConsentBanner,
    reopenConsentSettings,
    acceptAll,
    acceptEssential,
    updateConsent,
    hasConsent: checkHasConsent,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export { COOKIE_CATEGORIES };
export type { CookieConsent, CookieCategory };
