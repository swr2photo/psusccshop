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
          bgcolor: 'rgba(10,14,26,0.9)',
          color: '#f1f5f9',
          width: 320,
          maxHeight: '100vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-18px 0 60px rgba(0,0,0,0.45)',
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.18), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.16), transparent 38%)',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>เมนู</Typography>
          <IconButton onClick={onClose}>
            <X style={{ color: '#f1f5f9' }} size={24} />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2, borderColor: '#334155' }} />

        {session && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar src={session?.user?.image || ''} sx={{ mr: 2, width: 40, height: 40 }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>{session?.user?.name}</Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>{session?.user?.email}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2, borderColor: '#334155' }} />
            <Button
              fullWidth
              onClick={() => { onClose(); onOpenProfile(); }}
              sx={{
                textAlign: 'left',
                mb: 1,
                color: '#e2e8f0',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: 'linear-gradient(120deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                '&:hover': { borderColor: 'rgba(99,102,241,0.5)', background: 'linear-gradient(120deg, rgba(99,102,241,0.24), rgba(14,165,233,0.18))' },
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
                color: '#e2e8f0',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: 'linear-gradient(120deg, rgba(16,185,129,0.18), rgba(14,165,233,0.12))',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                '&:hover': { borderColor: 'rgba(16,185,129,0.5)', background: 'linear-gradient(120deg, rgba(16,185,129,0.22), rgba(14,165,233,0.16))' },
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
                color: '#fecdd3',
                justifyContent: 'flex-start',
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                background: 'linear-gradient(120deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                border: '1px solid rgba(248,113,113,0.4)',
                boxShadow: '0 12px 30px rgba(239,68,68,0.18)',
                '&:hover': { borderColor: 'rgba(248,113,113,0.8)', background: 'linear-gradient(120deg, rgba(239,68,68,0.18), rgba(239,68,68,0.12))' },
              }}
              startIcon={<LogOut size={20} />}
            >
              ออกจากระบบ
            </Button>
          </>
        )}

        <Divider sx={{ my: 2, borderColor: '#334155' }} />
        <Button
          component={Link}
          href="/"
          fullWidth
          sx={{
            textAlign: 'left',
            color: '#e2e8f0',
            justifyContent: 'flex-start',
            borderRadius: 2,
            px: 1.5,
            py: 1.1,
            background: 'linear-gradient(120deg, rgba(99,102,241,0.16), rgba(30,41,59,0.6))',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
            '&:hover': { borderColor: 'rgba(99,102,241,0.6)', background: 'linear-gradient(120deg, rgba(99,102,241,0.22), rgba(30,41,59,0.7))' },
          }}
          startIcon={<Home size={20} />}
        >
          หน้าแรก
        </Button>
      </Box>
    </Drawer>
  );
}
