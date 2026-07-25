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
  // Browser extension noise (not app bugs)
  /message channel closed before a response was received/i,
  /A listener indicated an asynchronous response by returning true/i,
  /ResizeObserver loop/i,
];

export function sentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isBenignConnectionError(hint.originalException)) {
    return null;
  }

  const message =
    event.message ||
    event.exception?.values?.map((v) => v.value).filter(Boolean).join(' ') ||
    '';
  if (
    /message channel closed/i.test(message) ||
    /asynchronous response by returning true/i.test(message)
  ) {
    return null;
  }

  return event;
}
