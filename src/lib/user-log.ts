// src/lib/user-log.ts
// Helper for logging user actions to /api/admin/user-logs

export async function logUserAction({
  email,
  name,
  action,
  details,
  metadata
}: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await fetch('/api/admin/user-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, action, details, metadata })
    });
  } catch (e) {
    // Do not throw, just warn
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('Failed to log user action', e);
    }
  }
}
