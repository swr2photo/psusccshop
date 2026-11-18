// Admin forms management
// GET    /api/admin/forms        — every form (incl. drafts) + response counts
// POST   /api/admin/forms        — create / update a form  { form }
// DELETE /api/admin/forms?id=xx  — delete a form and all its responses
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { sanitizeFormDefinition } from '@/lib/forms';
import {
  countResponsesByForm,
  deleteFormDefinition,
  getFormDefinition,
  listFormDefinitions,
  saveFormDefinition,
} from '@/lib/forms-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERMISSION = 'canManageEvents' as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdminWithPermission(PERMISSION, request);
  if (admin instanceof NextResponse) return admin;
  try {
    const [forms, counts] = await Promise.all([listFormDefinitions({ fresh: true }), countResponsesByForm()]);
    return await secureJsonResponse({ status: 'success', forms, counts });
  } catch (error) {
    console.error('[admin/forms] GET', error);
    return await secureJsonResponse({ status: 'error', message: 'โหลดแบบฟอร์มไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminWithPermission(PERMISSION, request);
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await secureJsonRequest(request);
    const input = body?.form || {};
    const existing = input.id ? await getFormDefinition(String(input.id)) : null;
    let form;
    try {
      form = sanitizeFormDefinition({ ...input, createdBy: admin.email }, existing);
    } catch (e) {
      return await secureJsonResponse({ status: 'error', message: (e as Error).message }, { status: 400 });
    }
    await saveFormDefinition(form);
    return await secureJsonResponse({ status: 'success', form });
  } catch (error) {
    console.error('[admin/forms] POST', error);
    return await secureJsonResponse({ status: 'error', message: 'บันทึกแบบฟอร์มไม่สำเร็จ' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminWithPermission(PERMISSION, request);
  if (admin instanceof NextResponse) return admin;
  try {
    const id = request.nextUrl.searchParams.get('id') || '';
    if (!id) return await secureJsonResponse({ status: 'error', message: 'id required' }, { status: 400 });
    await deleteFormDefinition(id);
    return await secureJsonResponse({ status: 'success' });
  } catch (error) {
    console.error('[admin/forms] DELETE', error);
    return await secureJsonResponse({ status: 'error', message: 'ลบแบบฟอร์มไม่สำเร็จ' }, { status: 500 });
  }
}
