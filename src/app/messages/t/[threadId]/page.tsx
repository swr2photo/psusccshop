'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useTranslation } from '@/hooks/useTranslation';

const SupportChatWidget = dynamic(() => import('@/components/SupportChatWidget'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-[var(--surface-2)] text-sm text-[var(--text-muted)]">
      Loading…
    </div>
  ),
});

export default function MessagesThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  const { status } = useSession();
  const { t, lang } = useTranslation();

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--surface-2)] px-4 text-center">
        <p className="text-base font-medium text-foreground">
          {t.supportChat.loginRequired}
        </p>
        <button
          type="button"
          onClick={() => signIn(undefined, { callbackUrl: `/messages/t/${threadId}` })}
          className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)]"
        >
          {lang === 'en' ? 'Sign in' : 'เข้าสู่ระบบ'}
        </button>
        <Link href="/" className="text-sm text-[var(--text-muted)] underline-offset-2 hover:underline">
          {lang === 'en' ? 'Back to shop' : 'กลับหน้าร้าน'}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--surface-2)]">
      <SupportChatWidget
        variant="page"
        hideMobileFab
        initialSessionId={threadId}
      />
    </div>
  );
}
