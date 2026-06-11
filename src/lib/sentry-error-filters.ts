import type { ErrorEvent, EventHint } from '@sentry/core';

/** Client disconnected mid-request — common during HMR, navigation, or tab close. */
export function isBenignConnectionError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    const msg = error.message.toLowerCase();
    if (msg === 'aborted' || msg === 'socket hang up') return true;
  }

  const errno = error as NodeJS.ErrnoException;
  return (
    errno.code === 'ECONNRESET' ||
    errno.code === 'EPIPE' ||
    errno.code === 'ERR_STREAM_PREMATURE_CLOSE'
  );
}

export const sentryIgnoredErrors: Array<string | RegExp> = [
  'AbortError',
  'ECONNRESET',
  'EPIPE',
  'ERR_STREAM_PREMATURE_CLOSE',
  /^aborted$/i,
  /socket hang up/i,
];

export function sentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isBenignConnectionError(hint.originalException)) {
    return null;
  }
  return event;
}
