import { NextRequest, NextResponse } from 'next/server';
import { getSheets } from '@/lib/google';
import { getJson, listKeys } from '@/lib/filebase';

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

const buildRows = (orders: any[]) => {
  return orders.map((o) => {
    const items = o?.items || o?.cart || o?.raw?.items || [];
    const itemSummary = typeof items === 'string' ? items : summarizeItems(items);
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

    const keys = await listKeys('orders/');
    const orders = (await Promise.all(keys.map(async (k) => {
      const data = await getJson<any>(k);
      return data ? { ...data, _key: k } : null;
    }))).filter(Boolean) as any[];

    const header = ['Ref', 'Date', 'Name', 'Email', 'Phone', 'Amount', 'Status', 'Address', 'Items (summary)', 'Notes'];
    const values = [header, ...buildRows(orders)];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${ORDERS_SHEET_TITLE}!A1:J${values.length}`,
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
