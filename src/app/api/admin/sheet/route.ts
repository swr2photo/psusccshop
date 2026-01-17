import { NextRequest, NextResponse } from 'next/server';
import { getSheets } from '@/lib/google';
import { getJson, listKeys } from '@/lib/filebase';
import { requireAdmin } from '@/lib/auth';

// Force Node runtime (googleapis needs Node, not Edge)
export const runtime = 'nodejs';
// Avoid static optimization; always run fresh
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: 'error', message: 'Use POST to sync sheets' }, { status: 405 });
}

const ORDERS_SHEET_TITLE = 'Orders';
const VENDOR_SHEET_TITLE = 'Orders Vendor';
const FACTORY_EXPORT_TITLE = 'Factory Export';

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

// Flatten items for factory export + size summary
const buildFactoryExport = (orders: any[]) => {
  const header = ['ลำดับ', 'ชื่อ', 'เบอร์เสื้อ', 'ชื่อบนเสื้อ', 'ไซซ์', 'แขนยาว', 'ไซซ์กางเกง (ถ้ามี)', 'เบอร์กางเกง (ถ้ามี)', 'หมายเหตุ', 'คณะ/กลุ่ม', 'เรียงลำดับ', 'สำรอง', 'Size', 'จำนวนรวม'];
  const rows: any[] = [];
  const sizeCount: Record<string, number> = {};

  orders.forEach((o) => {
    const items = o?.items || o?.cart || o?.raw?.items || [];
    items.forEach((item: any) => {
      const size = item.size || '';
      const qty = Number(item.quantity ?? 1) || 1;
      sizeCount[size] = (sizeCount[size] || 0) + qty;

      rows.push([
        rows.length + 1, // ลำดับ
        o?.customerName || o?.name || '',
        item.options?.customNumber || item.customNumber || '', // เบอร์เสื้อ
        item.options?.customName || item.customName || '', // ชื่อบนเสื้อ
        size,
        item.options?.isLongSleeve ? 'แขนยาว' : '',
        '', // ไซซ์กางเกง (ถ้ามี)
        '', // เบอร์กางเกง (ถ้ามี)
        o?.notes || o?.remark || '',
        '', // คณะ/กลุ่ม (optional)
        '', // เรียงลำดับ
        '', // สำรอง
        size,
        qty,
      ]);
    });
  });

  const summaryHeader = ['Size', 'จำนวนรวม'];
  const summaryRows = Object.entries(sizeCount)
    .filter(([size]) => size)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([size, qty]) => [size, qty]);

  const values = [header, ...rows, [], summaryHeader, ...summaryRows];
  return values;
};

// Vendor rows: remove email and slip columns for sharing with factory
const buildVendorRows = (orders: any[]) => {
  return orders.map((o) => {
    const items = o?.items || o?.cart || o?.raw?.items || [];
    const itemSummary = typeof items === 'string' ? items : summarizeItems(items);
    return [
      o?.ref || '',
      o?.date || o?.createdAt || o?.created_at || '',
      o?.customerName || o?.name || '',
      o?.customerPhone || o?.phone || '',
      Number(o?.totalAmount ?? o?.amount ?? o?.baseAmount ?? 0) || 0,
      o?.status || '',
      o?.customerAddress || o?.address || '',
      itemSummary,
      o?.notes || o?.remark || '',
    ];
  });
};

const ensureSheet = async (sheets: any, spreadsheetId: string, title: string = ORDERS_SHEET_TITLE) => {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const hasSheet = meta.data?.sheets?.some((s: any) => s.properties?.title === title);
  if (!hasSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
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
    // Vendor sheet now optional; if not provided we will skip factory sync entirely
    const vendorSheetIdInput: string | undefined = body?.vendorSheetId ?? process.env.VENDOR_SHEET_ID ?? undefined;
    let vendorSheetId: string | undefined = vendorSheetIdInput;

    // Fail fast with clear message when service account creds are missing to avoid opaque 502
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Google service account env missing (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY)',
        },
        { status: 500 }
      );
    }

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
    await ensureSheet(sheets, sheetId, FACTORY_EXPORT_TITLE);
    if (vendorSheetId) {
      await ensureSheet(sheets, vendorSheetId, VENDOR_SHEET_TITLE);
    }

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

    // Factory export tab (optional format requested by vendor)
    const factoryValues = buildFactoryExport(orders);
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${FACTORY_EXPORT_TITLE}!A1:N${factoryValues.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: factoryValues },
    });

    let vendorSheetUrl: string | undefined;
    if (vendorSheetId) {
      const vendorHeader = ['Ref', 'Date', 'Name', 'Phone', 'Amount', 'Status', 'Address', 'Items (summary)', 'Notes'];
      const vendorValues = [vendorHeader, ...buildVendorRows(orders)];

      await sheets.spreadsheets.values.update({
        spreadsheetId: vendorSheetId,
        range: `${VENDOR_SHEET_TITLE}!A1:I${vendorValues.length}`,
        valueInputOption: 'RAW',
        requestBody: { values: vendorValues },
      });

      vendorSheetUrl = `https://docs.google.com/spreadsheets/d/${vendorSheetId}`;
    }

    return NextResponse.json({
      status: 'success',
      data: {
        sheetId,
        sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : undefined,
        vendorSheetId,
        vendorSheetUrl,
        rows: orders.length,
      },
      message: created ? 'สร้าง Sheet และซิงก์ข้อมูลแล้ว' : 'ซิงก์ข้อมูลล่าสุดแล้ว',
    });
  } catch (error: any) {
    console.error('Sheet sync error:', error);
    // Provide more specific error messages
    let message = error?.message || 'sync failed';
    if (message.includes('invalid_grant') || message.includes('Invalid JWT')) {
      message = 'Google Service Account credentials ไม่ถูกต้องหรือหมดอายุ - กรุณาตรวจสอบ GOOGLE_PRIVATE_KEY';
    } else if (message.includes('Permission denied') || message.includes('forbidden')) {
      message = 'ไม่มีสิทธิ์เข้าถึง Google Sheet - ตรวจสอบว่า service account มีสิทธิ์แก้ไข Sheet แล้ว';
    } else if (message.includes('not found')) {
      message = 'ไม่พบ Google Sheet - ตรวจสอบ GOOGLE_SHEET_ID';
    }
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
