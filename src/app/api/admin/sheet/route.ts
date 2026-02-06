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

// Flatten items for factory export + size summary - Beautiful format for production
const buildFactoryExport = (orders: any[]) => {
  // Define size order for sorting
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
  const getSizeIndex = (size: string) => {
    const idx = sizeOrder.findIndex(s => size?.toUpperCase()?.includes(s));
    return idx === -1 ? 999 : idx;
  };

  // Collect all items with full details - EXPAND by quantity for production counting
  const allItems: any[] = [];
  const sizeCount: Record<string, number> = {};
  const sizeLongSleeveCount: Record<string, number> = {};
  const sizeShortSleeveCount: Record<string, number> = {};
  
  orders.forEach((o) => {
    const items = o?.items || o?.cart || o?.raw?.items || [];
    items.forEach((item: any) => {
      const size = item.size || 'ไม่ระบุ';
      const qty = Number(item.quantity ?? 1) || 1;
      const isLongSleeve = item.options?.isLongSleeve || item.isLongSleeve || false;
      
      // Count totals
      sizeCount[size] = (sizeCount[size] || 0) + qty;
      if (isLongSleeve) {
        sizeLongSleeveCount[size] = (sizeLongSleeveCount[size] || 0) + qty;
      } else {
        sizeShortSleeveCount[size] = (sizeShortSleeveCount[size] || 0) + qty;
      }

      // EXPAND: Create separate row for each unit when quantity > 1
      // This helps factory count individual items for production
      for (let i = 0; i < qty; i++) {
        allItems.push({
          orderRef: o?.ref || '',
          orderDate: o?.date || o?.createdAt || '',
          customerName: o?.customerName || o?.name || '',
          customerPhone: o?.customerPhone || o?.phone || '',
          customerAddress: o?.customerAddress || o?.address || '',
          productName: item.productName || item.name || item.productId || '',
          size,
          qty: 1,
          originalQty: qty,
          itemIndex: qty > 1 ? `(${i + 1}/${qty})` : '',
          isLongSleeve,
          customName: item.options?.customName || item.customName || '',
          customNumber: item.options?.customNumber || item.customNumber || '',
          unitPrice: item.unitPrice || 0,
          subtotal: item.unitPrice || 0,
        });
      }
    });
  });

  // Sort items by size then by customer name
  allItems.sort((a, b) => {
    const sizeCompare = getSizeIndex(a.size) - getSizeIndex(b.size);
    if (sizeCompare !== 0) return sizeCompare;
    return (a.customerName || '').localeCompare(b.customerName || '');
  });

  // Build header row - production friendly
  const header = [
    'ลำดับ',
    'ไซซ์',
    'แขน',
    'ชื่อสกรีน',
    'เบอร์สกรีน',
    'ชื่อลูกค้า',
    'เบอร์โทร',
    'ที่อยู่',
    'สินค้า',
    'ตัวที่',
    'Ref',
    'วันที่สั่ง',
  ];

  // Build data rows - each row = 1 physical item for factory production
  const rows = allItems.map((item, index) => [
    index + 1,
    item.size,
    item.isLongSleeve ? 'แขนยาว' : 'แขนสั้น',
    item.customName || '-',
    item.customNumber || '-',
    item.customerName,
    item.customerPhone,
    item.customerAddress || '-',
    item.productName,
    item.itemIndex || '-',
    item.orderRef,
    item.orderDate ? new Date(item.orderDate).toLocaleDateString('th-TH') : '',
  ]);

  // Build size summary with totals - sorted properly
  const sortedSizes = Object.keys(sizeCount).sort((a, b) => getSizeIndex(a) - getSizeIndex(b));
  
  const summaryHeader = ['สรุปตามไซซ์', '', '', ''];
  const summarySubHeader = ['ไซซ์', 'แขนสั้น', 'แขนยาว', 'รวม'];
  const summaryRows = sortedSizes.map(size => [
    size,
    sizeShortSleeveCount[size] || 0,
    sizeLongSleeveCount[size] || 0,
    sizeCount[size] || 0,
  ]);

  // Calculate grand totals
  const totalShortSleeve = Object.values(sizeShortSleeveCount).reduce((a, b) => a + b, 0);
  const totalLongSleeve = Object.values(sizeLongSleeveCount).reduce((a, b) => a + b, 0);
  const grandTotal = totalShortSleeve + totalLongSleeve;

  const totalRow = ['รวมทั้งหมด', totalShortSleeve, totalLongSleeve, grandTotal];

  // Build stats row
  const statsRow = [
    `จำนวนคำสั่งซื้อที่ชำระแล้ว: ${orders.length} รายการ`,
    `จำนวนชิ้นทั้งหมด: ${grandTotal} ชิ้น`,
    `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`,
    '',
  ];

  // Combine all sections with spacing
  const values = [
    // Stats section
    ['รายงานการผลิต - Factory Export'],
    statsRow,
    [],
    // Main data
    header,
    ...rows,
    [],
    [],
    // Summary section
    summaryHeader,
    summarySubHeader,
    ...summaryRows,
    totalRow,
  ];

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

    // Factory export tab (optional format requested by vendor) - only PAID orders
    const paidOrders = orders.filter((o) => o?.status === 'PAID');
    const factoryValues = buildFactoryExport(paidOrders);
    
    // Clear the factory sheet first to avoid old data
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${FACTORY_EXPORT_TITLE}!A:Z`,
    });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${FACTORY_EXPORT_TITLE}!A1:L${factoryValues.length}`,
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
