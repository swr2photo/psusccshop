import { NextRequest, NextResponse } from 'next/server';
import { getSheets } from '@/lib/google';
import { getJson, listKeys } from '@/lib/filebase';
import { requireAdmin } from '@/lib/auth';

const ORDERS_SHEET_TITLE = 'Orders';

const summarizeItems = (items: any[]): string => {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.map((item) => {
    const name = item.productName || item.productId || 'Item';
    const qty = item.quantity || 1;
    const size = item.size ? ` ${item.size}` : '';
    const price = item.unitPrice ? ` ฿${item.unitPrice}` : '';
    const total = item.unitPrice ? ` → ฿${(item.unitPrice || 0) * qty}` : '';
    const customName = item.options?.customName ? ` | Name:${item.options.customName}` : '';
    const customNumber = item.options?.customNumber ? ` | No:${item.options.customNumber}` : '';
    const longSleeve = item.options?.isLongSleeve ? ' | LongSleeve' : '';
    return `${name}${size} x${qty}${price}${total}${customName}${customNumber}${longSleeve}`.trim();
  }).join('; ');
};

const buildRows = (orders: any[], baseUrl: string) => {
  return orders.map((o) => {
    const items = o?.items || o?.cart || o?.raw?.items || [];
    const itemSummary = typeof items === 'string' ? items : summarizeItems(items);
    const slip = o?.slip;
    const hasSlip = !!(slip && slip.base64);
    const slipUploadedAt = slip?.uploadedAt ? new Date(slip.uploadedAt).toLocaleString('th-TH') : '';
    const slipVerified = slip?.slipCheck?.success ? 'ผ่าน' : (hasSlip ? 'รอตรวจสอบ' : '');
    const slipLink = hasSlip ? `${baseUrl}/api/slip/${o?.ref}` : '';
    
    return [
      o?.ref || '',
      o?.date || o?.createdAt || o?.created_at || '',
      o?.customerName || o?.name || '',
      o?.customerEmail || o?.email || '',
      o?.customerPhone || o?.phone || '',
      Number(o?.totalAmount ?? o?.amount ?? o?.baseAmount ?? 0) || 0,
      o?.status || '',
      o?.customerAddress || o?.address || '',
      itemSummary,
      o?.notes || o?.remark || '',
      hasSlip ? 'มี' : 'ไม่มี',
      slipUploadedAt,
      slipVerified,
      slipLink,
    ];
  });
};

const ensureSheet = async (sheets: any, spreadsheetId: string) => {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hasOrdersSheet = meta.data?.sheets?.some((s: any) => s.properties?.title === ORDERS_SHEET_TITLE);
  if (!hasOrdersSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: ORDERS_SHEET_TITLE,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
  }
};

export async function POST(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const mode = (body?.mode as 'create' | 'sync' | undefined) || 'sync';
    let sheetId: string | undefined = body?.sheetId ?? process.env.GOOGLE_SHEET_ID ?? undefined;
    const sheets = await getSheets();
    let created = false;

    if (!sheetId || mode === 'create') {
      const createdSheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: `PSU Orders ${new Date().toISOString().slice(0, 10)}` },
          sheets: [
            {
              properties: {
                title: ORDERS_SHEET_TITLE,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          ],
        },
      });
      sheetId = createdSheet.data.spreadsheetId ?? undefined;
      created = true;
    }

    if (!sheetId) return NextResponse.json({ status: 'error', message: 'missing sheet id' }, { status: 400 });

    await ensureSheet(sheets, sheetId);

    // Get base URL from request or environment
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

    const keys = await listKeys('orders/');
    const orders = (await Promise.all(keys.map(async (k) => {
      const data = await getJson<any>(k);
      return data ? { ...data, _key: k } : null;
    }))).filter(Boolean) as any[];

    const header = ['Ref', 'Date', 'Name', 'Email', 'Phone', 'Amount', 'Status', 'Address', 'Items (summary)', 'Notes', 'Slip', 'Slip Date', 'Slip Verified', 'Slip Link'];
    const values = [header, ...buildRows(orders, baseUrl)];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${ORDERS_SHEET_TITLE}!A1:N${values.length}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    return NextResponse.json({
      status: 'success',
      data: {
        sheetId,
        sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : undefined,
        rows: orders.length,
      },
      message: created ? 'สร้าง Sheet และซิงก์ข้อมูลแล้ว' : 'ซิงก์ข้อมูลล่าสุดแล้ว',
    });
  } catch (error: any) {
    console.error('Sheet sync error:', error);
    return NextResponse.json({ status: 'error', message: error?.message || 'sync failed' }, { status: 500 });
  }
}
