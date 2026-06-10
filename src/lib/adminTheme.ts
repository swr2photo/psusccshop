/** Shared admin theme tokens — use CSS variables so light/dark themes work correctly. */

export const ADMIN_THEME = {
  bg: 'var(--background)',
  bgCard: 'var(--glass-bg)',
  bgSidebar: 'var(--surface)',
  bgHeader: 'var(--glass-strong)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',

  text: 'var(--foreground)',
  textSecondary: 'var(--text-muted)',
  textMuted: 'var(--text-muted)',
  muted: 'var(--text-muted)',

  border: 'var(--glass-border)',
  borderActive: 'rgba(99,102,241,0.5)',

  glass: 'var(--glass-bg)',
  glassSoft: 'var(--surface-2)',
  glassHover: 'var(--glass-strong)',
  cardHover: 'var(--surface-2)',

  gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  gradientAlt: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  gradientWarm: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  gradientCool: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',

  primary: '#6366f1',
  primaryLight: '#a5b4fc',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#06b6d4',
  accent: '#8b5cf6',
};

/** Fixed palette for dark dialogs — never use CSS vars (admin may be light theme). */
export const DIALOG_THEME = {
  bg: '#1a1a2e',
  text: '#f1f5f9',
  title: '#f8fafc',
  label: '#cbd5e1',
  muted: '#94a3b8',
  inputBg: 'rgba(255,255,255,0.06)',
  section: '#c4b5fd',
  border: 'rgba(255,255,255,0.12)',
};

export const STATUS_THEME: Record<string, { bg: string; text: string; border: string }> = {
  WAITING_PAYMENT: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  PENDING: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  PAID: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
  READY: { bg: 'rgba(16,185,129,0.15)', text: '#34d399', border: 'rgba(16,185,129,0.4)' },
  SHIPPED: { bg: 'rgba(6,182,212,0.15)', text: '#22d3ee', border: 'rgba(6,182,212,0.4)' },
  COMPLETED: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.4)' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.4)' },
  REFUND_REQUESTED: { bg: 'rgba(124,58,237,0.15)', text: '#a78bfa', border: 'rgba(124,58,237,0.4)' },
  REFUNDED: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.4)' },
};

export const adminGlassCardSx = {
  background: ADMIN_THEME.glass,
  border: `1px solid ${ADMIN_THEME.border}`,
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  backdropFilter: 'blur(20px)',
  color: ADMIN_THEME.text,
  overflow: 'hidden',
};

export const adminCardSx = {
  bgcolor: ADMIN_THEME.glass,
  border: `1px solid ${ADMIN_THEME.border}`,
  borderRadius: '12px',
  color: ADMIN_THEME.text,
};

export const adminInputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: ADMIN_THEME.glassSoft,
    borderRadius: '12px',
    color: ADMIN_THEME.text,
    '& fieldset': { borderColor: ADMIN_THEME.border },
    '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.4)' },
    '&.Mui-focused fieldset': { borderColor: ADMIN_THEME.primary, boxShadow: '0 0 0 3px rgba(99,102,241,0.15)' },
  },
  '& .MuiInputLabel-root': { color: ADMIN_THEME.textSecondary },
  '& .MuiInputLabel-root.Mui-focused': { color: ADMIN_THEME.primary },
  '& .MuiInputBase-input': { color: ADMIN_THEME.text },
  '& .MuiFormHelperText-root': { color: ADMIN_THEME.muted },
  '& .MuiSelect-icon': { color: ADMIN_THEME.textSecondary },
};

export const adminInputSxCompact = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: ADMIN_THEME.glassSoft,
    color: ADMIN_THEME.text,
    '&:hover': { bgcolor: ADMIN_THEME.cardHover },
    '& fieldset': { borderColor: ADMIN_THEME.border },
    '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ADMIN_THEME.primary },
  },
  '& .MuiInputLabel-root': {
    color: ADMIN_THEME.textSecondary,
    '&.Mui-focused': { color: ADMIN_THEME.primary },
  },
  '& .MuiInputBase-input': { color: ADMIN_THEME.text },
  '& .MuiSelect-icon': { color: ADMIN_THEME.textSecondary },
};

export const adminSelectSx = {
  borderRadius: '12px',
  backgroundColor: ADMIN_THEME.glassSoft,
  color: ADMIN_THEME.text,
  '& fieldset': { borderColor: ADMIN_THEME.border },
  '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.35)' },
  '&.Mui-focused fieldset': { borderColor: ADMIN_THEME.primary },
};

export const adminGradientButtonSx = {
  background: ADMIN_THEME.gradient,
  color: '#fff',
  borderRadius: '12px',
  fontWeight: 700,
  textTransform: 'none',
  px: 3,
  py: 1.2,
  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
  '&:hover': {
    background: 'linear-gradient(135deg, #5458e9 0%, #7c3aed 100%)',
    boxShadow: '0 6px 20px rgba(99,102,241,0.45)',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.2s ease',
};

export const adminSecondaryButtonSx = {
  bgcolor: ADMIN_THEME.glass,
  color: ADMIN_THEME.textSecondary,
  borderRadius: '12px',
  border: `1px solid ${ADMIN_THEME.border}`,
  fontWeight: 600,
  textTransform: 'none',
  px: 2.5,
  py: 1,
  '&:hover': {
    bgcolor: ADMIN_THEME.cardHover,
    borderColor: ADMIN_THEME.border,
  },
};

export const adminTableSx = {
  '& th, & td': { borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text },
  '& thead th': { backgroundColor: ADMIN_THEME.glass, color: ADMIN_THEME.text },
};

export const dialogPaperSx = {
  bgcolor: DIALOG_THEME.bg,
  color: DIALOG_THEME.text,
  borderRadius: '16px',
  border: `1px solid ${DIALOG_THEME.border}`,
};

export const dialogInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: DIALOG_THEME.inputBg,
    color: DIALOG_THEME.text,
    '& fieldset': { borderColor: DIALOG_THEME.border },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
    '&.Mui-focused fieldset': { borderColor: ADMIN_THEME.accent },
  },
  '& .MuiInputLabel-root': { color: DIALOG_THEME.label },
  '& .MuiInputLabel-root.Mui-focused': { color: '#a78bfa' },
  '& .MuiInputBase-input': { color: DIALOG_THEME.text, fontSize: '0.9rem' },
  '& .MuiFormHelperText-root': { color: DIALOG_THEME.muted },
};

/** Theme-aware dialog (follows light/dark — use for most admin dialogs). */
export const adminDialogPaperSx = {
  bgcolor: ADMIN_THEME.surface,
  color: ADMIN_THEME.text,
  borderRadius: '16px',
  border: `1px solid ${ADMIN_THEME.border}`,
};
