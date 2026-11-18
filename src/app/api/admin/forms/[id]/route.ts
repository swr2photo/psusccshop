// GET    /api/admin/forms/[id]            — form + all responses + summary (admin)
// DELETE /api/admin/forms/[id]?r=<hash>   — remove one response
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { secureJsonResponse } from '@/lib/payload-crypto';
import { summarizeForm } from '@/lib/forms';
import { deleteResponse, getFormDefinition, hashRespondent, listResponses } from '@/lib/forms-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const admin = await requireAdminWithPermission('canManageEvents', request);
  if (admin instanceof NextResponse) return admin;
  try {
    const { id } = await params;
    const form = await getFormDefinition(id);
    if (!form) return await secureJsonResponse({ status: 'error', message: 'ไม่พบแบบฟอร์ม' }, { status: 404 });
    const responses = await listResponses(form.id);
    return await secureJsonResponse({
      status: 'success',
      form,
      responses: responses.map((r) => ({ ...r, respondentId: hashRespondent(r.email) })),
      summary: summarizeForm(form, responses, true),
    });
  } catch (error) {
    console.error('[admin/forms/:id] GET', error);
    return await secureJsonResponse({ status: 'error', message: 'โหลดคำตอบไม่สำเร็จ' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const admin = await requireAdminWithPermission('canManageEvents', request);
  if (admin instanceof NextResponse) return admin;
  try {
    const { id } = await params;
    const r = request.nextUrl.searchParams.get('r') || '';
    if (!r) return await secureJsonResponse({ status: 'error', message: 'r required' }, { status: 400 });
    await deleteResponse(id, r);
    return await secureJsonResponse({ status: 'success' });
  } catch (error) {
    console.error('[admin/forms/:id] DELETE', error);
    return await secureJsonResponse({ status: 'error', message: 'ลบคำตอบไม่สำเร็จ' }, { status: 500 });
  }
}
