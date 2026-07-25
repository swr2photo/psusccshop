'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { apiFetch } from '@/lib/api-client';

/**
 * User-facing receipt viewer. Fetches /api/invoice with same-origin cookies
 * (avoids bare API navigation showing raw JSON 401).
 */
function ReceiptPageInner() {
  const params = useParams<{ ref: string }>();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const ref = decodeURIComponent(params?.ref || '');
  const lang = (searchParams.get('lang') === 'en' ? 'en' : 'th') as 'th' | 'en';

  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const copy = useMemo(
    () =>
      lang === 'en'
        ? {
            title: 'Receipt',
            loading: 'Loading receipt…',
            needLogin: 'Please sign in to view this receipt.',
            signIn: 'Sign in',
            retry: 'Try again',
            print: 'Print / Save PDF',
            back: 'Back to shop',
            missing: 'Missing order reference',
          }
        : {
            title: 'ใบเสร็จรับเงิน',
            loading: 'กำลังโหลดใบเสร็จ…',
            needLogin: 'กรุณาเข้าสู่ระบบเพื่อดูใบเสร็จ',
            signIn: 'เข้าสู่ระบบ',
            retry: 'ลองอีกครั้ง',
            print: 'พิมพ์ / บันทึก PDF',
            back: 'กลับร้านค้า',
            missing: 'ไม่พบเลขที่ออเดอร์',
          },
    [lang],
  );

  const load = useCallback(async () => {
    if (!ref) {
      setError(copy.missing);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const res = await apiFetch(
        `/api/invoice?ref=${encodeURIComponent(ref)}&lang=${lang}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (res.status === 401) {
        setError(copy.needLogin);
        return;
      }
      if (!res.ok) {
        let message = copy.title;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json().catch(() => null);
          message = data?.error || data?.message || message;
        } else {
          message = (await res.text().catch(() => '')) || message;
        }
        setError(message);
        return;
      }
      setHtml(await res.text());
    } catch {
      setError(lang === 'en' ? 'Failed to load receipt' : 'โหลดใบเสร็จไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [ref, lang, copy.missing, copy.needLogin, copy.title]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setError(copy.needLogin);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Refresh Domain-scoped session cookie before invoice fetch (new tab / host-only leftovers)
      try {
        await fetch('/api/auth/sync-cookie', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        /* continue — invoice may still work */
      }
      if (!cancelled) void load();
    })();
    return () => {
      cancelled = true;
    };
  }, [status, load, copy.needLogin]);

  const callbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : `/receipt/${encodeURIComponent(ref)}?lang=${lang}`;

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.25,
          bgcolor: 'rgba(255,255,255,0.92)',
          borderBottom: '1px solid #e4e4e7',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Typography sx={{ fontWeight: 700, flex: 1, fontSize: '0.95rem' }}>{copy.title}</Typography>
        {html && (
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              const frame = document.getElementById('receipt-frame') as HTMLIFrameElement | null;
              frame?.contentWindow?.print();
            }}
            sx={{ textTransform: 'none', bgcolor: '#2563eb' }}
          >
            {copy.print}
          </Button>
        )}
        <Button
          size="small"
          href="/"
          sx={{ textTransform: 'none', color: '#52525b' }}
        >
          {copy.back}
        </Button>
      </Box>

      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 2 }}>
        {loading || status === 'loading' ? (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={32} />
            <Typography sx={{ mt: 1.5, color: '#71717a', fontSize: '0.85rem' }}>{copy.loading}</Typography>
          </Box>
        ) : error ? (
          <Box
            sx={{
              maxWidth: 420,
              width: '100%',
              bgcolor: '#fff',
              borderRadius: 2,
              border: '1px solid #e4e4e7',
              p: 3,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{copy.title}</Typography>
            <Typography sx={{ color: '#52525b', fontSize: '0.9rem', mb: 2 }}>{error}</Typography>
            {error === copy.needLogin || status === 'unauthenticated' ? (
              <Button
                variant="contained"
                onClick={() => signIn(undefined, { callbackUrl })}
                sx={{ textTransform: 'none', bgcolor: '#2563eb' }}
              >
                {copy.signIn}
              </Button>
            ) : (
              <Button variant="outlined" onClick={() => void load()} sx={{ textTransform: 'none' }}>
                {copy.retry}
              </Button>
            )}
          </Box>
        ) : html ? (
          <Box
            component="iframe"
            id="receipt-frame"
            title={copy.title}
            srcDoc={html}
            sandbox="allow-same-origin allow-modals allow-popups allow-scripts"
            sx={{
              width: '100%',
              maxWidth: 860,
              height: 'calc(100dvh - 72px)',
              border: '1px solid #e4e4e7',
              borderRadius: 2,
              bgcolor: '#fff',
              boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            }}
          />
        ) : null}
      </Box>
    </Box>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={32} />
        </Box>
      }
    >
      <ReceiptPageInner />
    </Suspense>
  );
}
