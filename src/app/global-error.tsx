'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);

    const isChunkError =
      error.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error.message) ||
      /failed to fetch/i.test(error.message) ||
      /refused to execute script/i.test(error.message);

    if (isChunkError) {
      try {
        const hasReloaded = sessionStorage.getItem('chunk_reload_attempted');
        if (!hasReloaded) {
          sessionStorage.setItem('chunk_reload_attempted', 'true');
          setTimeout(() => {
            try {
              sessionStorage.removeItem('chunk_reload_attempted');
            } catch (e) {}
          }, 10000);
          window.location.reload();
        }
      } catch (e) {
        console.error('Failed to reload page:', e);
      }
    }
  }, [error]);

  return (
    <html lang="th">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
