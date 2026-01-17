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

// ============== TOAST TYPES ==============

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom' | 'top-center' | 'bottom-center';

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

// ============== CONTEXT TYPES ==============

interface NotificationContextValue {
  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  
  // Shorthand methods
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  
  // Cookie consent
  consent: CookieConsent | null;
  showConsentBanner: boolean;
  setShowConsentBanner: (show: boolean) => void;
  acceptAll: () => void;
  acceptEssential: () => void;
  updateConsent: (consent: Partial<Omit<CookieConsent, 'timestamp' | 'version'>>) => void;
  hasConsent: (category: CookieCategory) => boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ============== PROVIDER ==============

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const toastTimeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load consent on mount
  useEffect(() => {
    const savedConsent = getConsentState();
    setConsent(savedConsent);
    
    // Show banner if no consent set
    if (!hasConsentBeenSet()) {
      // Small delay to avoid showing immediately
      const timer = setTimeout(() => setShowConsentBanner(true), 1500);
      return () => clearTimeout(timer);
    }
    
    // Record visit if functional cookies allowed
    if (savedConsent?.functional) {
      recordLastVisit();
    }
  }, []);

  // Remove toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = toastTimeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeoutsRef.current.delete(id);
    }
  }, []);

  // Add toast
  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 4000,
      dismissible: toast.dismissible ?? true,
    };

    setToasts((prev) => {
      // Prevent duplicates with same title
      if (prev.some((t) => t.title === toast.title && t.type === toast.type)) {
        return prev;
      }
      // Keep max 5 toasts
      const updated = [...prev, newToast];
      return updated.slice(-5);
    });

    // Auto dismiss
    if (newToast.duration && newToast.duration > 0) {
      const timeout = setTimeout(() => removeToast(id), newToast.duration);
      toastTimeoutsRef.current.set(id, timeout);
    }

    return id;
  }, [removeToast]);

  // Clear all toasts
  const clearAllToasts = useCallback(() => {
    toastTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    toastTimeoutsRef.current.clear();
    setToasts([]);
  }, []);

  // Shorthand methods
  const success = useCallback((title: string, message?: string) => 
    addToast({ type: 'success', title, message }), [addToast]);
  
  const error = useCallback((title: string, message?: string) => 
    addToast({ type: 'error', title, message, duration: 6000 }), [addToast]);
  
  const warning = useCallback((title: string, message?: string) => 
    addToast({ type: 'warning', title, message }), [addToast]);
  
  const info = useCallback((title: string, message?: string) => 
    addToast({ type: 'info', title, message }), [addToast]);

  // Cookie consent handlers
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

  const updateConsent = useCallback((newConsent: Partial<Omit<CookieConsent, 'timestamp' | 'version'>>) => {
    const savedConsent = saveConsentState(newConsent);
    setConsent(savedConsent);
    setShowConsentBanner(false);
  }, []);

  const checkHasConsent = useCallback((category: CookieCategory): boolean => {
    if (category === 'essential') return true;
    return consent?.[category] ?? false;
  }, [consent]);

  const value: NotificationContextValue = {
    toasts,
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

// ============== HOOK ==============

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

// Re-export cookie categories for convenience
export { COOKIE_CATEGORIES };
export type { CookieConsent, CookieCategory };
