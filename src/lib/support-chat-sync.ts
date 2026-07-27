/**
 * Client helper for support-chat polling with ETag + delta sync.
 * Minimizes payload size and allows 304 Not Modified responses.
 */

export type ChatSyncResult<TChat> =
  | { kind: 'unchanged' }
  | { kind: 'delta'; chat: TChat; etag: string | null; hasMore?: boolean | null }
  | { kind: 'full'; chat: TChat; etag: string | null; hasMore?: boolean | null };

export async function fetchChatSync<TChat extends { messages?: Array<{ created_at: string }> }>(
  chatId: string,
  options: {
    etag?: string | null;
    since?: string | null;
    limit?: number;
  } = {}
): Promise<ChatSyncResult<TChat>> {
  const params = new URLSearchParams();
  if (options.since) params.set('since', options.since);
  if (options.limit) params.set('limit', String(options.limit));

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
  const hasMore = typeof data.hasMore === 'boolean' ? data.hasMore : null;

  if (data.sync === 'delta') {
    return { kind: 'delta', chat, etag, hasMore };
  }

  return { kind: 'full', chat, etag, hasMore };
}

export async function fetchOlderChatMessages<T extends { id: string; created_at: string }>(
  chatId: string,
  options: {
    before: string;
    beforeId?: string;
    limit?: number;
  }
): Promise<{ messages: T[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set('before', options.before);
  if (options.beforeId) params.set('beforeId', options.beforeId);
  if (options.limit) params.set('limit', String(options.limit));

  const res = await fetch(`/api/support-chat/${chatId}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Older messages failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    messages: (data.messages || []) as T[],
    hasMore: Boolean(data.hasMore),
  };
}

/** Merge delta messages into an existing message list (dedupe by id + near-duplicate content). */
export function mergeChatMessages<T extends { id: string; created_at: string; message?: string; sender?: string; _optimistic?: boolean }>(
  existing: T[],
  delta: T[]
): T[] {
  if (!delta.length) return dedupeNearIdenticalMessages(existing);
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const msg of delta) {
    byId.set(msg.id, msg);
  }
  return dedupeNearIdenticalMessages(
    [...byId.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  );
}

/**
 * Collapse consecutive bubbles with the same sender + identical text within 60s.
 * Keeps the non-optimistic / later id when duplicates collide (e.g. RT + poll).
 */
export function dedupeNearIdenticalMessages<
  T extends { id: string; created_at: string; message?: string; sender?: string; _optimistic?: boolean }
>(messages: T[]): T[] {
  if (messages.length < 2) return messages;
  const out: T[] = [];
  for (const msg of messages) {
    const prev = out[out.length - 1];
    const sameContent =
      prev &&
      prev.sender &&
      msg.sender &&
      prev.sender === msg.sender &&
      (prev.message || '').trim() === (msg.message || '').trim() &&
      (prev.message || '').trim().length > 0 &&
      Math.abs(new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 60_000;

    if (sameContent && prev) {
      if (prev._optimistic && !msg._optimistic) {
        out[out.length - 1] = msg;
      } else if (prev.id.startsWith('opt_') && !msg.id.startsWith('opt_')) {
        out[out.length - 1] = msg;
      }
      // else keep prev, drop msg
      continue;
    }
    out.push(msg);
  }
  return out;
}

/**
 * Merge a newest-window full sync into an already-paginated list
 * without dropping older messages the user already loaded.
 */
export function mergeNewestWindow<T extends { id: string; created_at: string }>(
  existing: T[],
  newestWindow: T[]
): T[] {
  if (!existing.length) return newestWindow;
  if (!newestWindow.length) return existing;
  const oldestInWindow = newestWindow.reduce(
    (min, m) => (m.created_at < min ? m.created_at : min),
    newestWindow[0].created_at
  );
  const keptOlder = existing.filter((m) => m.created_at < oldestInWindow);
  return mergeChatMessages(keptOlder, newestWindow);
}

/** Adaptive poll interval: slower when Realtime is healthy or tab is hidden. */
export function getChatPollIntervalMs(connectionState: string, role: 'messages' | 'typing'): number {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return 60_000;
  }

  const connected = connectionState === 'connected';
  if (role === 'typing') {
    return connected ? 15_000 : 3000;
  }
  // Faster safety-net when Realtime is down so missed events surface quickly
  return connected ? 45_000 : 5000;
}
