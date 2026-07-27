// src/hooks/useConfirmDialog.tsx
// Modern confirm dialog hook using MUI Dialog — replaces sweetalert2
// Zero additional dependencies, native dark mode & theme support

'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Slide,
  IconButton,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import {
  AlertTriangle,
  HelpCircle,
  AlertCircle,
  Info,
  X as CloseIcon,
  CheckCircle2,
} from 'lucide-react';

// Slide-up transition for mobile-friendly feel
const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

type DialogVariant = 'warning' | 'error' | 'question' | 'info' | 'success';

interface ConfirmDialogOptions {
  title: string;
  message?: string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  /** If true, shows a more destructive style */
  destructive?: boolean;
}

interface DialogState extends ConfirmDialogOptions {
  open: boolean;
}

const VARIANT_CONFIG: Record<DialogVariant, { icon: React.ReactNode; color: string }> = {
  warning: {
    icon: <AlertTriangle size={28} />,
    color: '#f59e0b',
  },
  error: {
    icon: <AlertCircle size={28} />,
    color: '#ef4444',
  },
  question: {
    icon: <HelpCircle size={28} />,
    color: '#6366f1',
  },
  info: {
    icon: <Info size={28} />,
    color: '#3b82f6',
  },
  success: {
    icon: <CheckCircle2 size={28} />,
    color: '#10b981',
  },
};

// Stable View Component for Confirm Dialog
function ConfirmDialogView({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: (confirmed: boolean) => void;
}) {
  const variantCfg = VARIANT_CONFIG[state.variant || 'warning'];
  const confirmBtnColor =
    state.confirmColor || (state.destructive ? '#ef4444' : variantCfg.color);

  return (
    <Dialog
      open={state.open}
      onClose={() => onClose(false)}
      TransitionComponent={SlideTransition}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: 'var(--surface, #fff)',
            color: 'var(--foreground, #1e293b)',
            border: '1px solid var(--glass-border, rgba(148,163,184,0.15))',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            zIndex: 99999,
          },
        },
        backdrop: {
          sx: {
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 99998,
          },
        },
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={() => onClose(false)}
        size="small"
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'var(--text-muted, #94a3b8)',
          zIndex: 1,
        }}
      >
        <CloseIcon size={16} />
      </IconButton>

      {/* Icon + Title */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pt: 3,
          pb: 1,
          px: 3,
          fontWeight: 700,
          fontSize: '1.1rem',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${variantCfg.color}15`,
            color: variantCfg.color,
            flexShrink: 0,
          }}
        >
          {variantCfg.icon}
        </Box>
        {state.title}
      </DialogTitle>

      {/* Message */}
      {state.message && (
        <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
          <DialogContentText
            sx={{
              color: 'var(--text-muted, #64748b)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              pl: 7.5,
            }}
          >
            {state.message}
          </DialogContentText>
        </DialogContent>
      )}

      {/* Actions */}
      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 2,
          gap: 1,
        }}
      >
        <Button
          onClick={() => onClose(false)}
          sx={{
            color: 'var(--text-muted, #64748b)',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderRadius: 2,
            px: 2.5,
            '&:hover': {
              bgcolor: 'var(--surface-2, rgba(148,163,184,0.1))',
            },
          }}
        >
          {state.cancelText}
        </Button>
        <Button
          onClick={() => onClose(true)}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: confirmBtnColor,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderRadius: 2,
            px: 2.5,
            '&:hover': {
              bgcolor: confirmBtnColor,
              filter: 'brightness(0.9)',
            },
          }}
        >
          {state.confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Stable View Component for Alert Dialog
function AlertDialogView({
  state,
  onClose,
}: {
  state: DialogState & { onClose?: () => void };
  onClose: () => void;
}) {
  const variantCfg = VARIANT_CONFIG[state.variant || 'info'];

  return (
    <Dialog
      open={state.open}
      onClose={onClose}
      TransitionComponent={SlideTransition}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: 'var(--surface, #fff)',
            color: 'var(--foreground, #1e293b)',
            border: '1px solid var(--glass-border, rgba(148,163,184,0.15))',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            zIndex: 99999,
          },
        },
        backdrop: {
          sx: {
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 99998,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pt: 3,
          pb: 1,
          px: 3,
          fontWeight: 700,
          fontSize: '1.1rem',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${variantCfg.color}15`,
            color: variantCfg.color,
            flexShrink: 0,
          }}
        >
          {variantCfg.icon}
        </Box>
        {state.title}
      </DialogTitle>

      {state.message && (
        <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
          <DialogContentText
            sx={{
              color: 'var(--text-muted, #64748b)',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              pl: 7.5,
            }}
          >
            {state.message}
          </DialogContentText>
        </DialogContent>
      )}

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: state.confirmColor || variantCfg.color,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderRadius: 2,
            px: 3,
            '&:hover': {
              bgcolor: state.confirmColor || variantCfg.color,
              filter: 'brightness(0.9)',
            },
          }}
        >
          {state.confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Modern confirm dialog hook — drop-in replacement for Swal.fire confirm dialogs.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: '',
    variant: 'warning',
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        message: options.message,
        variant: options.variant || 'warning',
        confirmText: options.confirmText || 'ยืนยัน',
        cancelText: options.cancelText || 'ยกเลิก',
        confirmColor: options.confirmColor,
        destructive: options.destructive,
      });
    });
  }, []);

  const handleClose = useCallback((confirmed: boolean) => {
    setState((prev) => ({ ...prev, open: false }));
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  }, []);

  const ConfirmDialog = useCallback(() => (
    <ConfirmDialogView state={state} onClose={handleClose} />
  ), [state, handleClose]);

  return { confirm, ConfirmDialog };
}

/**
 * Alert dialog (no cancel button) — replacement for Swal.fire({ icon: 'error', ... })
 */
export function useAlertDialog() {
  const [state, setState] = useState<DialogState & { onClose?: () => void }>({
    open: false,
    title: '',
    variant: 'info',
  });

  const resolveRef = useRef<(() => void) | null>(null);

  const alert = useCallback((
    options: Omit<ConfirmDialogOptions, 'cancelText'> & { onClose?: () => void }
  ): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        message: options.message,
        variant: options.variant || 'info',
        confirmText: options.confirmText || 'ตกลง',
        confirmColor: options.confirmColor,
        onClose: options.onClose,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    const onCloseCb = state.onClose;
    setState((prev) => ({ ...prev, open: false }));
    resolveRef.current?.();
    resolveRef.current = null;
    onCloseCb?.();
  }, [state.onClose]);

  const AlertDialog = useCallback(() => (
    <AlertDialogView state={state} onClose={handleClose} />
  ), [state, handleClose]);

  return { alert, AlertDialog };
}
