'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ============== TYPES ==============

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

// ============== TOAST HOOK ==============

/**
 * Hook สำหรับจัดการ Toast notifications
 * สามารถใช้ได้ทั้งใน Modal และ Component ทั่วไป
 */
export function useToast(options?: ToastOptions) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const defaultDuration = options?.duration ?? 4000;
  const preventDuplicate = options?.preventDuplicate ?? true;

  // ลบ toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  // เพิ่ม toast
  const addToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    customDuration?: number
  ): string => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    setToasts((prev) => {
      // ป้องกันการซ้ำ
      if (preventDuplicate && prev.some((t) => t.title === title && t.type === type)) {
        return prev;
      }
      // เก็บแค่ 5 toast
      const newToast: ToastMessage = { id, type, title, message };
      return [...prev, newToast].slice(-5);
    });

    // Auto dismiss
    const duration = customDuration ?? (type === 'error' ? 5000 : defaultDuration);
    if (duration > 0) {
      const timeout = setTimeout(() => removeToast(id), duration);
      timeoutsRef.current.set(id, timeout);
    }

    return id;
  }, [defaultDuration, preventDuplicate, removeToast]);

  // ล้าง toasts ทั้งหมด
  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setToasts([]);
  }, []);

  // Cleanup เมื่อ unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  // Shorthand methods
  const success = useCallback((title: string, message?: string) => 
    addToast('success', title, message), [addToast]);
  
  const error = useCallback((title: string, message?: string) => 
    addToast('error', title, message, 5000), [addToast]);
  
  const warning = useCallback((title: string, message?: string) => 
    addToast('warning', title, message), [addToast]);
  
  const info = useCallback((title: string, message?: string) => 
    addToast('info', title, message), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  };
}

// ============== TOAST STYLES ==============

export const TOAST_STYLES = {
  success: {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.98) 0%, rgba(5, 150, 105, 0.98) 100%)',
    border: 'rgba(16, 185, 129, 0.5)',
    shadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
    color: '#10b981',
  },
  error: {
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.98) 0%, rgba(220, 38, 38, 0.98) 100%)',
    border: 'rgba(239, 68, 68, 0.5)',
    shadow: '0 8px 32px rgba(239, 68, 68, 0.35)',
    color: '#ef4444',
  },
  warning: {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.98) 0%, rgba(234, 88, 12, 0.98) 100%)',
    border: 'rgba(245, 158, 11, 0.5)',
    shadow: '0 8px 32px rgba(245, 158, 11, 0.35)',
    color: '#f59e0b',
  },
  info: {
    bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%)',
    border: 'rgba(59, 130, 246, 0.5)',
    shadow: '0 8px 32px rgba(59, 130, 246, 0.35)',
    color: '#3b82f6',
  },
} as const;

// ============== TOAST ANIMATION STYLES ==============

export const TOAST_ANIMATION_CSS = `
@keyframes toastSlideIn {
  0% {
    opacity: 0;
    transform: translateY(-16px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toastSlideOut {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-16px) scale(0.95);
  }
}

@keyframes toastPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}
`;
