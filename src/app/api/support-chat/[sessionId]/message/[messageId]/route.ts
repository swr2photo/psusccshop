// src/app/api/support-chat/[sessionId]/message/[messageId]/route.ts
// Unsend (DELETE) + edit text (PATCH)

import { NextRequest, NextResponse } from 'next/server';
import { isResourceOwner, getSession } from '@/lib/auth';
import { getChatSession, unsendChatMessage } from '@/lib/support-chat';
import { editChatMessage } from '@/lib/support-chat-edit';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string; messageId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { sessionId, messageId } = await params;
    const session = await getSession(request);

    if (!session?.user?.email) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }

    const chat = await getChatSession(sessionId);

    if (!chat) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }

    if (chat.status === 'closed') {
      return await secureJsonResponse(
        { error: 'ไม่สามารถยกเลิกข้อความได้เนื่องจากการสนทนาปิดแล้ว' },
        { status: 400 }
      );
    }

    const isOwner = isResourceOwner(chat.customer_email, session.user.email);

    if (!isOwner) {
      return await secureJsonResponse(
        { error: 'คุณสามารถยกเลิกได้เฉพาะข้อความของตัวเองเท่านั้น' },
        { status: 403 }
      );
    }

    const result = await unsendChatMessage(sessionId, messageId, session.user.email);

    if (!result.success) {
      return await secureJsonResponse(
        { error: result.error || 'ไม่สามารถยกเลิกข้อความได้' },
        { status: 400 }
      );
    }

    return await secureJsonResponse({
      success: true,
      message: 'ยกเลิกข้อความเรียบร้อยแล้ว',
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/message/delete] error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { sessionId, messageId } = await params;
    const session = await getSession(request);

    if (!session?.user?.email) {
      return await secureJsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const chat = await getChatSession(sessionId);
    if (!chat) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }

    if (chat.status === 'closed') {
      return await secureJsonResponse(
        { error: 'ไม่สามารถแก้ไขข้อความได้เนื่องจากการสนทนาปิดแล้ว' },
        { status: 400 }
      );
    }

    const isOwner = isResourceOwner(chat.customer_email, session.user.email);
    if (!isOwner) {
      return await secureJsonResponse(
        { error: 'แก้ไขได้เฉพาะข้อความของตัวเอง' },
        { status: 403 }
      );
    }

    const body = await secureJsonRequest(request).catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message : '';

    const result = await editChatMessage(sessionId, messageId, session.user.email, message);
    if (!result.success) {
      return await secureJsonResponse({ error: result.error || 'แก้ไขไม่สำเร็จ' }, { status: 400 });
    }

    return await secureJsonResponse({ success: true, message: result.message });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/message/edit] error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
