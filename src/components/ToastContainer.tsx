'use client';

import { useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { Box, Typography, IconButton, Slide } from '@mui/material';
import { useNotification, Toast } from './NotificationContext';

// ============== TOAST STYLES ==============

const TOAST_STYLES = {
  success: {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
    border: 'rgba(16, 185, 129, 0.5)',
    icon: <CheckCircle2 size={20} />,
    shadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
  },
  error: {
    bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
    border: 'rgba(239, 68, 68, 0.5)',
    icon: <AlertCircle size={20} />,
    shadow: '0 8px 32px rgba(239, 68, 68, 0.3)',
  },
  warning: {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(234, 88, 12, 0.95) 100%)',
    border: 'rgba(245, 158, 11, 0.5)',
    icon: <AlertTriangle size={20} />,
    shadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
  },
  info: {
    bg: 'linear-gradient(135deg, rgba(0,113,227, 0.95) 0%, rgba(0,113,227, 0.95) 100%)',
    border: 'rgba(0,113,227, 0.5)',
    icon: <Info size={20} />,
    shadow: '0 8px 32px rgba(0,113,227, 0.3)',
  },
};

// ============== SINGLE TOAST COMPONENT ==============

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const style = TOAST_STYLES[toast.type];

  return (
    <Slide direction="down" in={true} mountOnEnter unmountOnExit>
      <Box
        sx={{
          background: style.bg,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${style.border}`,
          borderRadius: '16px',
          boxShadow: style.shadow,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 2,
          pl: 2.5,
          minWidth: { xs: 280, sm: 320 },
          maxWidth: { xs: 'calc(100vw - 32px)', sm: 420 },
          pointerEvents: 'auto',
          animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          '@keyframes toastSlideIn': {
            '0%': {
              opacity: 0,
              transform: 'translateY(-16px) scale(0.95)',
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0) scale(1)',
            },
          },
          '&:hover': {
            transform: 'scale(1.02)',
            transition: 'transform 0.2s ease',
          },
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {toast.icon || style.icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.title}
          </Typography>
          {toast.message && (
            <Typography
              sx={{
                fontSize: '0.8rem',
                opacity: 0.9,
                lineHeight: 1.4,
                mt: 0.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {toast.message}
            </Typography>
          )}
        </Box>

        {/* Action Button */}
        {toast.action && (
          <Box
            onClick={toast.action.onClick}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: '8px',
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            {toast.action.label}
          </Box>
        )}

        {/* Close Button */}
        {toast.dismissible !== false && (
          <IconButton
            size="small"
            onClick={() => onRemove(toast.id)}
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              p: 0.5,
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.15)',
              },
            }}
          >
            <X size={16} />
          </IconButton>
        )}
      </Box>
    </Slide>
  );
}

// ============== TOAST CONTAINER ==============

export default function ToastContainer() {
  const { toasts, removeToast } = useNotification();

  if (toasts.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: { xs: 16, sm: 24 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        pointerEvents: 'none',
        width: '100%',
        px: 2,
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </Box>
  );
}

// ============== INLINE TOAST FOR MODALS ==============

interface InlineToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose?: () => void;
}

export function InlineToast({ type, title, message, onClose }: InlineToastProps) {
  const style = TOAST_STYLES[type];

  useEffect(() => {
    if (onClose) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [onClose]);

  return (
    <Box
      sx={{
        background: style.bg,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${style.border}`,
        borderRadius: '12px',
        boxShadow: style.shadow,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        px: 2,
        animation: 'inlineToastIn 0.3s ease',
        '@keyframes inlineToastIn': {
          '0%': {
            opacity: 0,
            transform: 'translateY(-8px)',
          },
          '100%': {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
      }}
    >
      <Box sx={{ flexShrink: 0 }}>{style.icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{title}</Typography>
        {message && (
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>{message}</Typography>
        )}
      </Box>
      {onClose && (
        <IconButton size="small" onClick={onClose} sx={{ color: 'white', opacity: 0.8 }}>
          <X size={14} />
        </IconButton>
      )}
    </Box>
  );
}

// ============== FLOATING ACTION TOAST ==============

interface FloatingToastProps {
  show: boolean;
  type?: 'success' | 'info';
  icon?: React.ReactNode;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function FloatingActionToast({ show, type = 'success', icon, message, action }: FloatingToastProps) {
  if (!show) return null;

  const bgColor = type === 'success' 
    ? 'linear-gradient(135deg, #34c759 0%, #34c759 100%)'
    : 'linear-gradient(135deg, #0071e3 0%, #0071e3 100%)';

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 80, sm: 24 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        animation: 'floatIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        '@keyframes floatIn': {
          '0%': {
            opacity: 0,
            transform: 'translateX(-50%) translateY(20px)',
          },
          '100%': {
            opacity: 1,
            transform: 'translateX(-50%) translateY(0)',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          borderRadius: '50px',
          background: bgColor,
          color: 'white',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        {icon || <Sparkles size={18} />}
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{message}</Typography>
        {action && (
          <Box
            onClick={action.onClick}
            sx={{
              ml: 1,
              px: 2,
              py: 0.5,
              borderRadius: '20px',
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
            }}
          >
            {action.label}
          </Box>
        )}
      </Box>
    </Box>
  );
}
