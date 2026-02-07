'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut, signIn } from 'next-auth/react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material';
import {
  History,
  Home,
  LogOut,
  TriangleAlert,
  User,
  X,
  ArrowLeftRight,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface SidebarMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
  availableProviders?: string[];
}

export default function SidebarMenu(props: SidebarMenuProps) {
  const open = props.open;
  const onClose = props.onClose;
  const onOpenProfile = props.onOpenProfile;
  const onOpenHistory = props.onOpenHistory;
  const availableProviders = props.availableProviders || ['google'];

  const { data: session } = useSession();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [switchAccountOpen, setSwitchAccountOpen] = React.useState(false);

  return (
    <>
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.95)',
          color: 'var(--foreground)',
          width: 320,
          maxHeight: '100vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          backdropFilter: 'blur(24px)',
          borderLeft: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '-18px 0 60px rgba(0,0,0,0.45)' : '-18px 0 60px rgba(0,0,0,0.08)',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>เมนู</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ThemeToggle size="small" />
            <IconButton onClick={onClose}>
              <X style={{ color: 'inherit' }} size={24} />
            </IconButton>
          </Box>
        </Box>
        <Divider sx={{ mb: 2, borderColor: 'divider' }} />

        {session && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar src={session?.user?.image || ''} sx={{ mr: 2, width: 40, height: 40 }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{session?.user?.name}</Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{session?.user?.email}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2, borderColor: 'divider' }} />
            <Button
              fullWidth
              onClick={() => { onClose(); onOpenProfile(); }}
              sx={{
                textAlign: 'left',
                mb: 1,
                color: 'var(--foreground)',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(120deg, rgba(0,113,227,0.18), rgba(14,165,233,0.12))'
                  : 'linear-gradient(120deg, rgba(0,113,227,0.08), rgba(14,165,233,0.05))',
                border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                '&:hover': {
                  borderColor: 'rgba(0,113,227,0.5)',
                },
              }}
              startIcon={<User size={20} />}
            >
              ข้อมูลจัดส่งของฉัน
            </Button>
            <Button
              fullWidth
              onClick={() => { onClose(); onOpenHistory(); }}
              sx={{
                textAlign: 'left',
                mb: 1,
                color: 'var(--foreground)',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(120deg, rgba(16,185,129,0.18), rgba(14,165,233,0.12))'
                  : 'linear-gradient(120deg, rgba(16,185,129,0.08), rgba(14,165,233,0.05))',
                border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                '&:hover': {
                  borderColor: 'rgba(16,185,129,0.5)',
                },
              }}
              startIcon={<History size={20} />}
            >
              ประวัติคำสั่งซื้อ
            </Button>
            <Button
              fullWidth
              onClick={() => { onClose(); setSwitchAccountOpen(true); }}
              sx={{
                textAlign: 'left',
                mb: 1,
                color: 'var(--foreground)',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(120deg, rgba(139,92,246,0.18), rgba(99,102,241,0.12))'
                  : 'linear-gradient(120deg, rgba(139,92,246,0.08), rgba(99,102,241,0.05))',
                border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                '&:hover': {
                  borderColor: 'rgba(139,92,246,0.5)',
                },
              }}
              startIcon={<ArrowLeftRight size={20} />}
            >
              สลับบัญชี
            </Button>
            <Button
              fullWidth
              onClick={() => setLogoutConfirmOpen(true)}
              sx={{
                textAlign: 'left',
                color: 'error.main',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(120deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))'
                  : 'linear-gradient(120deg, rgba(239,68,68,0.06), rgba(239,68,68,0.03))',
                border: '1px solid rgba(248,113,113,0.3)',
                '&:hover': { borderColor: 'rgba(248,113,113,0.6)' },
              }}
              startIcon={<LogOut size={20} />}
            >
              ออกจากระบบ
            </Button>
          </>
        )}

        <Divider sx={{ my: 2, borderColor: 'divider' }} />
        <Button
          component={Link}
          href="/"
          fullWidth
          sx={{
            textAlign: 'left',
            color: 'var(--foreground)',
            justifyContent: 'flex-start',
            borderRadius: 2,
            px: 1.5,
            py: 1.1,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(120deg, rgba(0,113,227,0.16), rgba(29,29,31,0.6))'
              : 'linear-gradient(120deg, rgba(0,113,227,0.06), rgba(245,245,247,0.8))',
            border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            '&:hover': { borderColor: 'rgba(0,113,227,0.6)' },
          }}
          startIcon={<Home size={20} />}
        >
          หน้าแรก
        </Button>
      </Box>
    </Drawer>

    {/* Logout Confirmation Dialog */}
    <Dialog
      open={logoutConfirmOpen}
      onClose={() => setLogoutConfirmOpen(false)}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.95)' : '#fff',
          backdropFilter: 'blur(20px)',
          maxWidth: 360,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <TriangleAlert size={22} color="#ff9f0a" />
        ยืนยันการออกจากระบบ
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'var(--text-muted)' }}>
          คุณต้องการออกจากระบบใช่หรือไม่?
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={() => setLogoutConfirmOpen(false)}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={() => signOut()}
          variant="contained"
          color="error"
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
        >
          ออกจากระบบ
        </Button>
      </DialogActions>
    </Dialog>

    {/* Switch Account Dialog */}
    <Dialog
      open={switchAccountOpen}
      onClose={() => setSwitchAccountOpen(false)}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: '20px',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.95)' : '#fff',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArrowLeftRight size={20} />
          สลับบัญชี
        </Box>
        <IconButton onClick={() => setSwitchAccountOpen(false)} size="small">
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {session && (
          <Box sx={{
            p: 2, borderRadius: '14px',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.1)' : 'rgba(0,113,227,0.06)',
            border: '1px solid rgba(0,113,227,0.2)',
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Avatar src={session?.user?.image || ''} sx={{ width: 40, height: 40 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session?.user?.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session?.user?.email}
              </Typography>
            </Box>
          </Box>
        )}

        <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 1 }}>
          เลือกวิธีเข้าสู่ระบบด้วยบัญชีอื่น
        </Typography>

        <Button
          fullWidth
          onClick={() => { setSwitchAccountOpen(false); signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' }); }}
          sx={{
            py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
            background: '#ffffff', color: '#1d1d1f',
            border: '1px solid rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
            '&:hover': { background: '#f5f5f7', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </Button>

        {availableProviders.includes('azure-ad') && (
          <Button
            fullWidth
            onClick={() => { setSwitchAccountOpen(false); signIn('azure-ad', { redirect: true, callbackUrl: '/' }); }}
            sx={{
              py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
              background: '#2f2f2f', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              '&:hover': { background: '#404040', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' },
            }}
          >
            <svg width="18" height="18" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            Microsoft
          </Button>
        )}

        {availableProviders.includes('facebook') && (
          <Button
            fullWidth
            onClick={() => { setSwitchAccountOpen(false); signIn('facebook', { redirect: true, callbackUrl: '/' }); }}
            sx={{
              py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
              background: '#1877F2', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              '&:hover': { background: '#166FE5', boxShadow: '0 4px 14px rgba(24,119,242,0.3)' },
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Facebook
          </Button>
        )}

        {availableProviders.includes('apple') && (
          <Button
            fullWidth
            onClick={() => { setSwitchAccountOpen(false); signIn('apple', { redirect: true, callbackUrl: '/' }); }}
            sx={{
              py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
              background: '#000', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              '&:hover': { background: '#1a1a1a', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' },
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C4.24 16.76 4.89 10.87 8.88 10.6c1.24.07 2.1.72 2.83.78.99-.2 1.94-.78 3-.84 1.28-.08 2.25.48 2.88 1.22-2.65 1.58-2.02 5.07.36 6.04-.47 1.2-.97 2.4-1.9 3.48zM12.07 10.5c-.16-2.3 1.74-4.2 3.93-4.5.32 2.5-2.25 4.64-3.93 4.5z"/>
            </svg>
            Apple
          </Button>
        )}

        {availableProviders.includes('line') && (
          <Button
            fullWidth
            onClick={() => { setSwitchAccountOpen(false); signIn('line', { redirect: true, callbackUrl: '/' }); }}
            sx={{
              py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
              background: '#06C755', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              '&:hover': { background: '#05B34C', boxShadow: '0 4px 14px rgba(6,199,85,0.3)' },
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .348-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .349-.281.63-.63.63h-2.386c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63h2.386c.349 0 .63.282.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.348.279-.63.63-.63.346 0 .627.282.627.63v4.771zm-5.741 0c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.348.282-.63.627-.63.349 0 .631.282.631.63v4.771zm-2.466.63H4.917c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63.349 0 .63.282.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .349-.281.63-.629.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            LINE
          </Button>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
