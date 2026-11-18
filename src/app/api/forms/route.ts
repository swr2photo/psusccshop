// GET /api/forms — list forms that students can see (open or closed, never drafts)
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { secureJsonResponse } from '@/lib/payload-crypto';
import { API_CACHE } from '@/lib/api-helpers';
import {
  anonRespondentKey,
  countResponsesByForm,
  getRespondedFormIds,
  listFormDefinitions,
  readAnonId,
  toListItem,
} from '@/lib/forms-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    const email = session?.user?.email || null;

    const anonId = readAnonId(request);
    const [defs, counts, byAccount, byBrowser] = await Promise.all([
      listFormDefinitions(),
      countResponsesByForm(),
      email ? getRespondedFormIds(email) : Promise.resolve(undefined),
      anonId ? getRespondedFormIds(anonRespondentKey(anonId)) : Promise.resolve(undefined),
    ]);
    // Anonymous (public) answers are tied to this browser's cookie, account answers to the email
    const responded = byAccount || byBrowser ? new Set([...(byAccount || []), ...(byBrowser || [])]) : undefined;

    const forms = defs
      .filter((f) => f.status !== 'draft')
      .map((f) => toListItem(f, counts, responded))
      // accepting first, then most recently updated
      .sort((a, b) => Number(b.isAcceptingResponses) - Number(a.isAcceptingResponses) || b.updatedAt.localeCompare(a.updatedAt));

    return await secureJsonResponse(
      { status: 'success', forms, loggedIn: Boolean(email) },
      { headers: { 'Cache-Control': API_CACHE.private } },
    );
  } catch (error) {
    console.error('[forms] GET list', error);
    return await secureJsonResponse({ status: 'error', message: 'โหลดแบบฟอร์มไม่สำเร็จ' }, { status: 500 });
  }
}
