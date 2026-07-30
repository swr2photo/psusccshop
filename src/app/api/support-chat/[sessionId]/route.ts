// src/app/api/support-chat/[sessionId]/route.ts
// Get chat session details and messages (supports ETag + delta sync + older pages)

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, isResourceOwner, getSession } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import {
  getChatSession,
  getChatSessionWithMessages,
  getMessagesSince,
  getMessagesBefore,
  buildChatEtag,
  markMessagesAsRead,
  CHAT_MESSAGE_PAGE_SIZE,
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

function parseLimit(raw: string | null): number {
  if (!raw) return CHAT_MESSAGE_PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return CHAT_MESSAGE_PAGE_SIZE;
  return Math.max(1, Math.min(n, 50));
}

// GET: Get chat session with messages (full, older page, delta, or 304)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getSession(request);

    if (!session?.user?.email) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }

    const chatSession = await getChatSession(sessionId);
    if (!chatSession) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }

    const isAdminUser = await isAdminEmailAsync(session.user.email);
    const isOwner = isResourceOwner(chatSession.customer_email, session.user.email);

    if (!isAdminUser && !isOwner) {
      return await secureJsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const shouldMarkRead = searchParams.get('markRead') === 'true';
    const sinceParam = searchParams.get('since');
    const beforeParam = searchParams.get('before');
    const beforeId = searchParams.get('beforeId') || undefined;
    const limit = parseLimit(searchParams.get('limit'));

    // Older history page (infinite scroll up)
    if (beforeParam && !sinceParam) {
      const page = await getMessagesBefore(sessionId, beforeParam, limit, beforeId);
      return await secureJsonResponse({
        messages: page.messages,
        hasMore: page.hasMore,
        sync: 'older',
      });
    }

    // ETag check before markRead so idle polls stay cheap (304)
    let sessionForResponse = chatSession;
    let etag = buildChatEtag(sessionForResponse);
    const ifNoneMatch = request.headers.get('if-none-match');
    if (!shouldMarkRead && ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    if (shouldMarkRead) {
      const reader = isOwner ? 'customer' : 'admin';
      await markMessagesAsRead(sessionId, reader);
      const refreshed = await getChatSession(sessionId);
      if (refreshed) {
        sessionForResponse = refreshed;
        etag = buildChatEtag(sessionForResponse);
      }
    }

    if (sinceParam) {
      const sinceDate = new Date(sinceParam);
      if (!Number.isNaN(sinceDate.getTime())) {
        const deltaMessages = await getMessagesSince(sessionId, sinceDate);
        return await secureJsonResponse(
          {
            chat: { ...sessionForResponse, messages: deltaMessages },
            sync: 'delta',
            hasMore: null,
          },
          { headers: { ETag: etag } }
        );
      }
    }

    const chat = await getChatSessionWithMessages(sessionId, limit);
    if (!chat) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }

    const { hasMore, ...chatPayload } = chat;
    return await secureJsonResponse(
      { chat: chatPayload, sync: 'full', hasMore },
      { headers: { ETag: etag } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/sessionId] GET error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
