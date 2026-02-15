// src/components/PasskeyManager.tsx
// UI for registering, viewing, renaming, and deleting passkeys
// Rendered inside ProfileModal or as standalone section

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, CircularProgress,
  Chip, Dialog, DialogContent, DialogActions,
} from '@mui/material';
import { Fingerprint, Plus, Trash2, Edit, Check, X, Shield, Smartphone, Monitor, Key } from 'lucide-react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useTranslation } from '@/hooks/useTranslation';

interface PasskeyInfo {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface PasskeyManagerProps {
  userEmail: string;
}

export default function PasskeyManager({ userEmail }: PasskeyManagerProps) {
  const { lang, t } = useTranslation();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check browser support
  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  // Load existing passkeys
  const loadPasskeys = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/passkey');
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  // Register new passkey
  const handleRegister = useCallback(async () => {
    setRegistering(true);
    setMessage(null);
    try {
      // Step 1: Get registration options from server
      const optRes = await fetch('/api/auth/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register-options' }),
      });
      if (!optRes.ok) throw new Error('Failed to get registration options');
      const { options, challengeId } = await optRes.json();

      // Step 2: Create credential with browser WebAuthn API
      const attestation = await startRegistration({ optionsJSON: options });

      // Step 3: Verify with server
      const verifyRes = await fetch('/api/auth/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register-verify',
          challengeId,
          attestation,
          friendlyName: friendlyName.trim() || undefined,
        }),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.verified) {
        setMessage({
          type: 'success',
          text: lang === 'en' ? 'Passkey registered successfully!' : 'ลงทะเบียนพาสคีย์สำเร็จ!',
        });
        setShowNameDialog(false);
        setFriendlyName('');
        await loadPasskeys();
      } else {
        throw new Error(verifyData.error || 'Verification failed');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setMessage({
          type: 'error',
          text: lang === 'en' ? 'Registration cancelled' : 'ยกเลิกการลงทะเบียน',
        });
      } else {
        setMessage({
          type: 'error',
          text: err.message || (lang === 'en' ? 'Registration failed' : 'ลงทะเบียนไม่สำเร็จ'),
        });
      }
    } finally {
      setRegistering(false);
    }
  }, [friendlyName, lang, loadPasskeys]);

  // Delete passkey
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/auth/passkey?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPasskeys((prev) => prev.filter((p) => p.id !== id));
        setMessage({
          type: 'success',
          text: lang === 'en' ? 'Passkey removed' : 'ลบพาสคีย์แล้ว',
        });
      }
    } catch {
      setMessage({
        type: 'error',
        text: lang === 'en' ? 'Failed to delete' : 'ลบไม่สำเร็จ',
      });
    } finally {
      setDeletingId(null);
    }
  }, [lang]);

  // Rename passkey
  const handleRename = useCallback(async (id: string) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch('/api/auth/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', credentialId: id, name: editName.trim() }),
      });
      if (res.ok) {
        setPasskeys((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: editName.trim() } : p)),
        );
        setEditingId(null);
        setEditName('');
      }
    } catch {
      // ignore
    }
  }, [editName]);

  if (!supported) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
        <Fingerprint size={32} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          {lang === 'en'
            ? 'Passkeys are not supported on this browser'
            : 'เบราว์เซอร์นี้ไม่รองรับพาสคีย์'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Shield size={20} />
          <Typography variant="subtitle1" fontWeight={700}>
            {lang === 'en' ? 'Passkeys' : 'พาสคีย์'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={registering ? <CircularProgress size={16} /> : <Plus size={16} />}
          onClick={() => setShowNameDialog(true)}
          disabled={registering}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            fontSize: '0.8rem',
          }}
        >
          {lang === 'en' ? 'Add Passkey' : 'เพิ่มพาสคีย์'}
        </Button>
      </Box>

      {/* Description */}
      <Typography variant="body2" sx={{ mb: 2, opacity: 0.7, fontSize: '0.8rem' }}>
        {lang === 'en'
          ? 'Sign in instantly with your fingerprint, face, or screen lock — no password needed.'
          : 'ลงชื่อเข้าใช้ทันทีด้วยลายนิ้วมือ ใบหน้า หรือการล็อคหน้าจอ — ไม่ต้องใช้รหัสผ่าน'}
      </Typography>

      {/* Message */}
      {message && (
        <Box
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: '12px',
            bgcolor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: message.type === 'success' ? '#10b981' : '#ef4444',
              fontSize: '0.8rem',
            }}
          >
            {message.text}
          </Typography>
        </Box>
      )}

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : passkeys.length === 0 ? (
        /* Empty state */
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            borderRadius: '16px',
            bgcolor: 'rgba(99, 102, 241, 0.05)',
            border: '1px dashed rgba(99, 102, 241, 0.2)',
          }}
        >
          <Fingerprint size={40} style={{ opacity: 0.4 }} />
          <Typography variant="body2" sx={{ mt: 1.5, opacity: 0.6 }}>
            {lang === 'en' ? 'No passkeys registered yet' : 'ยังไม่มีพาสคีย์'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.4 }}>
            {lang === 'en'
              ? 'Add a passkey for faster, more secure sign-in'
              : 'เพิ่มพาสคีย์เพื่อเข้าสู่ระบบได้เร็วและปลอดภัยยิ่งขึ้น'}
          </Typography>
        </Box>
      ) : (
        /* Passkey list */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {passkeys.map((pk) => (
            <Box
              key={pk.id}
              sx={{
                p: 2,
                borderRadius: '14px',
                bgcolor: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {pk.deviceType === 'multiDevice' ? (
                  <Key size={20} style={{ color: '#6366f1' }} />
                ) : (
                  <Fingerprint size={20} style={{ color: '#6366f1' }} />
                )}
              </Box>

              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {editingId === pk.id ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      size="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(pk.id);
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditName('');
                        }
                      }}
                      autoFocus
                      sx={{ flex: 1, '& .MuiInputBase-root': { height: 32, fontSize: '0.85rem' } }}
                    />
                    <IconButton size="small" onClick={() => handleRename(pk.id)}>
                      <Check size={16} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingId(null);
                        setEditName('');
                      }}
                    >
                      <X size={16} />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {pk.name || 'Passkey'}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.5 }}>
                      {lang === 'en' ? 'Created' : 'สร้างเมื่อ'}{' '}
                      {new Date(pk.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {pk.lastUsedAt && (
                        <>
                          {' · '}
                          {lang === 'en' ? 'Last used' : 'ใช้ล่าสุด'}{' '}
                          {new Date(pk.lastUsedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </>
                      )}
                    </Typography>
                  </>
                )}
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  {pk.backedUp && (
                    <Chip
                      label={lang === 'en' ? 'Synced' : 'ซิงค์แล้ว'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                      }}
                    />
                  )}
                  {pk.deviceType === 'multiDevice' && (
                    <Chip
                      label={lang === 'en' ? 'Multi-device' : 'หลายอุปกรณ์'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* Actions */}
              {editingId !== pk.id && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingId(pk.id);
                      setEditName(pk.name);
                    }}
                    sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                  >
                    <Edit size={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(pk.id)}
                    disabled={deletingId === pk.id}
                    sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: '#ef4444' } }}
                  >
                    {deletingId === pk.id ? <CircularProgress size={16} /> : <Trash2 size={16} />}
                  </IconButton>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Name dialog before registration */}
      <Dialog
        open={showNameDialog}
        onClose={() => {
          setShowNameDialog(false);
          setFriendlyName('');
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
          },
        }}
      >
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Fingerprint size={48} style={{ color: '#6366f1' }} />
            <Typography variant="h6" sx={{ mt: 1, fontWeight: 700 }}>
              {lang === 'en' ? 'Add a Passkey' : 'เพิ่มพาสคีย์'}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.6 }}>
              {lang === 'en'
                ? 'Use your fingerprint, face, or screen lock to sign in'
                : 'ใช้ลายนิ้วมือ ใบหน้า หรือการล็อคหน้าจอเพื่อลงชื่อเข้าใช้'}
            </Typography>
          </Box>
          <TextField
            fullWidth
            label={lang === 'en' ? 'Name this passkey (optional)' : 'ตั้งชื่อพาสคีย์ (ไม่บังคับ)'}
            placeholder={lang === 'en' ? 'e.g. My iPhone, Work Laptop' : 'เช่น iPhone ของฉัน, โน้ตบุ๊คที่ทำงาน'}
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => {
              setShowNameDialog(false);
              setFriendlyName('');
            }}
            sx={{ borderRadius: '12px', textTransform: 'none' }}
          >
            {lang === 'en' ? 'Cancel' : 'ยกเลิก'}
          </Button>
          <Button
            variant="contained"
            onClick={handleRegister}
            disabled={registering}
            startIcon={registering ? <CircularProgress size={16} /> : <Fingerprint size={16} />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            {registering
              ? (lang === 'en' ? 'Registering...' : 'กำลังลงทะเบียน...')
              : (lang === 'en' ? 'Continue' : 'ดำเนินการ')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
