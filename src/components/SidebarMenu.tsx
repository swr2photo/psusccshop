'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material';
import {
  History,
  Home,
  LogOut,
  User,
  X,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface SidebarMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenHistory: () => void;
}

export default function SidebarMenu(props: SidebarMenuProps) {
  const open = props.open;
  const onClose = props.onClose;
  const onOpenProfile = props.onOpenProfile;
  const onOpenHistory = props.onOpenHistory;

  const { data: session } = useSession();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(10,14,26,0.9)' : 'rgba(255,255,255,0.92)',
          color: 'text.primary',
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
                <Typography sx={{ fontWeight: 'bold', color: 'text.primary' }}>{session?.user?.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{session?.user?.email}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2, borderColor: 'divider' }} />
            <Button
              fullWidth
              onClick={() => { onClose(); onOpenProfile(); }}
              sx={{
                textAlign: 'left',
                mb: 1,
                color: 'text.primary',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(120deg, rgba(37,99,235,0.18), rgba(14,165,233,0.12))'
                  : 'linear-gradient(120deg, rgba(37,99,235,0.08), rgba(14,165,233,0.05))',
                border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                '&:hover': {
                  borderColor: 'rgba(37,99,235,0.5)',
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
                color: 'text.primary',
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
              onClick={() => signOut()}
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
            color: 'text.primary',
            justifyContent: 'flex-start',
            borderRadius: 2,
            px: 1.5,
            py: 1.1,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(120deg, rgba(37,99,235,0.16), rgba(30,41,59,0.6))'
              : 'linear-gradient(120deg, rgba(37,99,235,0.06), rgba(241,245,249,0.8))',
            border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            '&:hover': { borderColor: 'rgba(37,99,235,0.6)' },
          }}
          startIcon={<Home size={20} />}
        >
          หน้าแรก
        </Button>
      </Box>
    </Drawer>
  );
}
