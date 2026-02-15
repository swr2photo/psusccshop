// src/components/PasskeyLoginButton.tsx
// "Sign in with Passkey" button for the login screen
// Uses WebAuthn discoverable credentials (resident keys)

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Fingerprint } from 'lucide-react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { signIn } from 'next-auth/react';
import { useTranslation } from '@/hooks/useTranslation';

interface PasskeyLoginButtonProps {
  onError?: (message: string) => void;
  onSuccess?: () => void;
  fullWidth?: boolean;
  variant?: 'contained' | 'outlined' | 'text';
}

export default function PasskeyLoginButton({
  onError,
  onSuccess,
  fullWidth = true,
  variant = 'outlined',
}: PasskeyLoginButtonProps) {
  const { lang } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Only show button if browser supports WebAuthn
    setSupported(browserSupportsWebAuthn());
  }, []);

  const handlePasskeyLogin = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: Get authentication options from server
      const optRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-options' }),
      });
      if (!optRes.ok) {
        const err = await optRes.json();
        throw new Error(err.error || 'Failed to get login options');
      }
      const { options, challengeId } = await optRes.json();

      // Step 2: Authenticate with browser WebAuthn API
      const assertion = await startAuthentication({ optionsJSON: options });

      // Step 3: Verify with server
      const verifyRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-verify', challengeId, assertion }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.verified || !verifyData.token) {
        throw new Error(verifyData.error || 'Authentication failed');
      }

      // Step 4: Sign in via NextAuth CredentialsProvider
      const result = await signIn('passkey', {
        token: verifyData.token,
        redirect: false,
        callbackUrl: '/',
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Success — reload to get session
      onSuccess?.();
      window.location.href = result?.url || '/';
    } catch (err: any) {
      setLoading(false);
      if (err.name === 'NotAllowedError') {
        // User cancelled the prompt
        return;
      }
      const msg =
        err.message ||
        (lang === 'en' ? 'Passkey sign-in failed' : 'เข้าสู่ระบบด้วยพาสคีย์ไม่สำเร็จ');
      onError?.(msg);
      console.error('[Passkey] Login error:', err);
    }
  }, [lang, onError, onSuccess]);

  if (!supported) return null;

  return (
    <Button
      variant={variant}
      fullWidth={fullWidth}
      onClick={handlePasskeyLogin}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={20} />
        ) : (
          <Fingerprint size={20} />
        )
      }
      sx={{
        height: 48,
        borderRadius: '14px',
        textTransform: 'none',
        fontSize: '0.95rem',
        fontWeight: 600,
        border: variant === 'outlined' ? '1.5px solid rgba(99, 102, 241, 0.4)' : undefined,
        color: variant === 'outlined' ? '#6366f1' : undefined,
        background:
          variant === 'contained'
            ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
            : undefined,
        '&:hover': {
          border: variant === 'outlined' ? '1.5px solid #6366f1' : undefined,
          bgcolor: variant === 'outlined' ? 'rgba(99, 102, 241, 0.06)' : undefined,
        },
      }}
    >
      {loading
        ? lang === 'en'
          ? 'Signing in...'
          : 'กำลังลงชื่อเข้าใช้...'
        : lang === 'en'
          ? 'Sign in with Passkey'
          : 'ลงชื่อเข้าใช้ด้วยพาสคีย์'}
    </Button>
  );
}
