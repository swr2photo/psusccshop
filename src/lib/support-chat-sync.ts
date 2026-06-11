/**
 * Client helper for support-chat polling with ETag + delta sync.
 * Minimizes payload size and allows 304 Not Modified responses.
 */

export type ChatSyncResult<TChat> =
  | { kind: 'unchanged' }
  | { kind: 'delta'; chat: TChat; etag: string | null }
  | { kind: 'full'; chat: TChat; etag: string | null };

export async function fetchChatSync<TChat extends { messages?: Array<{ created_at: string }> }>(
  chatId: string,
  options: {
    etag?: string | null;
    since?: string | null;
  } = {}
): Promise<ChatSyncResult<TChat>> {
  const params = new URLSearchParams();
  if (options.since) params.set('since', options.since);

  const headers: Record<string, string> = {};
  if (options.etag) headers['If-None-Match'] = options.etag;

  const qs = params.toString();
  const url = `/api/support-chat/${chatId}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers });

  if (res.status === 304) {
    return { kind: 'unchanged' };
  }

  if (!res.ok) {
    throw new Error(`Chat sync failed: ${res.status}`);
  }

  const data = await res.json();
  const etag = res.headers.get('etag');
  const chat = data.chat as TChat;

  if (data.sync === 'delta') {
    return { kind: 'delta', chat, etag };
  }

  return { kind: 'full', chat, etag };
}

/** Merge delta messages into an existing message list (dedupe by id). */
export function mergeChatMessages<T extends { id: string; created_at: string }>(
  existing: T[],
  delta: T[]
): T[] {
  if (!delta.length) return existing;
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const msg of delta) {
    byId.set(msg.id, msg);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Adaptive poll interval: slower when Realtime is healthy or tab is hidden. */
export function getChatPollIntervalMs(connectionState: string, role: 'messages' | 'typing'): number {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return 60_000;
  }

  const connected = connectionState === 'connected';
  if (role === 'typing') {
    return connected ? 15_000 : 4000;
  }
  return connected ? 45_000 : 8000;
}
