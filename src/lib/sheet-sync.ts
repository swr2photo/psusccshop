// src/lib/sheet-sync.ts
// Background sheet sync utility - auto-syncs orders to Google Sheets

import { getSheets } from '@/lib/google';
import { getJson, listKeys, putJson } from '@/lib/filebase';

const ORDERS_SHEET_TITLE = 'Orders';
const VENDOR_SHEET_TITLE = 'Orders Vendor';
const FACTORY_EXPORT_TITLE = 'Factory Export';

// Config key for storing sheet settings
const CONFIG_KEY = 'config/shop-settings.json';

// Debounce sync requests - avoid syncing too frequently
let syncTimeout: NodeJS.Timeout | null = null;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 5000; // Minimum 5 seconds between syncs

/**
 * Trigger a background sync to Google Sheets
 * This is debounced to prevent excessive API calls
 */
export async function triggerSheetSync(baseUrl?: string): Promise<void> {
  const now = Date.now();
  
  // Skip if synced very recently
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log('[sheet-sync] Skipping - synced recently');
    return;
  }

  // Clear any pending sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  // Debounce: wait 2 seconds before actually syncing
  // This batches rapid changes together
  syncTimeout = setTimeout(async () => {
    try {
      await performSync(baseUrl);
      lastSyncTime = Date.now();
    } catch (error) {
      console.error('[sheet-sync] Background sync failed:', error);
    }
  }, 2000);
}

/**
 * Immediately sync without debounce (use sparingly)
 */
export async function syncNow(baseUrl?: string): Promise<{ success: boolean; message: string }> {
  try {
    await performSync(baseUrl);
    lastSyncTime = Date.now();
    return { success: true, message: 'Synced successfully' };
  } catch (error: any) {
    console.error('[sheet-sync] Sync failed:', error);
    return { success: false, message: error?.message || 'Sync failed' };
  }
}

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
    const slipVerified = slip?.slipData?.transRef ? 'ผ่าน' : (hasSlip ? 'รอตรวจสอบ' : '');
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
// IMPORTANT: This should only receive PAID orders
const buildFactoryExport = (orders: any[]) => {
  // Define size order for sorting
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
  const getSizeIndex = (size: string) => {
    const idx = sizeOrder.findIndex(s => size?.toUpperCase()?.includes(s));
    return idx === -1 ? 999 : idx;
  };

  // Collect all items with full details
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

      allItems.push({
        orderRef: o?.ref || '',
        orderDate: o?.date || o?.createdAt || '',
        customerName: o?.customerName || o?.name || '',
        customerPhone: o?.customerPhone || o?.phone || '',
        productName: item.productName || item.name || item.productId || '',
        size,
        qty,
        isLongSleeve,
        customName: item.options?.customName || item.customName || '',
        customNumber: item.options?.customNumber || item.customNumber || '',
        unitPrice: item.unitPrice || 0,
        subtotal: (item.unitPrice || 0) * qty,
      });
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
    'สินค้า',
    'Ref',
    'วันที่สั่ง',
  ];

  // Build data rows
  const rows = allItems.map((item, index) => [
    index + 1,
    item.size,
    item.isLongSleeve ? 'แขนยาว' : 'แขนสั้น',
    item.customName || '-',
    item.customNumber || '-',
    item.customerName,
    item.customerPhone,
    item.productName,
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

const ensureSheet = async (sheets: any, spreadsheetId: string, title: string) => {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const hasSheet = meta.data?.sheets?.some((s: any) => s.properties?.title === title);
    if (!hasSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title, gridProperties: { frozenRowCount: 1 } },
            },
          }],
        },
      });
    }
  } catch (error) {
    console.error(`[sheet-sync] Failed to ensure sheet ${title}:`, error);
  }
};

async function performSync(baseUrl?: string): Promise<void> {
  // Check if Google credentials are available
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[sheet-sync] Skipping - Google credentials not configured');
    return;
  }

  // Get config to find sheet IDs
  const config = await getJson<any>(CONFIG_KEY);
  const sheetId = config?.sheetId || process.env.GOOGLE_SHEET_ID;
  const vendorSheetId = config?.vendorSheetId || process.env.VENDOR_SHEET_ID;

  if (!sheetId) {
    console.log('[sheet-sync] Skipping - No sheet ID configured');
    return;
  }

  console.log('[sheet-sync] Starting sync to sheet:', sheetId);

  const sheets = await getSheets();
  const url = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psusci.club';

  // Ensure sheets exist
  await ensureSheet(sheets, sheetId, ORDERS_SHEET_TITLE);
  await ensureSheet(sheets, sheetId, FACTORY_EXPORT_TITLE);

  // Get all orders
  const keys = await listKeys('orders/');
  const orders = (await Promise.all(keys.map(async (k) => {
    const data = await getJson<any>(k);
    return data ? { ...data, _key: k } : null;
  }))).filter(Boolean) as any[];

  // Sync main orders sheet
  const header = ['Ref', 'Date', 'Name', 'Email', 'Phone', 'Amount', 'Status', 'Address', 'Items (summary)', 'Notes', 'Slip', 'Slip Date', 'Slip Verified', 'Slip Link'];
  const values = [header, ...buildRows(orders, url)];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${ORDERS_SHEET_TITLE}!A1:N${values.length}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  // Factory export tab - ONLY PAID orders (important for production tracking)
  const paidOrders = orders.filter((o) => o?.status === 'PAID');
  const factoryValues = buildFactoryExport(paidOrders);
  
  // Clear the factory sheet first to avoid stale data when orders get cancelled
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${FACTORY_EXPORT_TITLE}!A:Z`,
  });
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${FACTORY_EXPORT_TITLE}!A1:J${factoryValues.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: factoryValues },
  });

  console.log(`[sheet-sync] Factory export - ${paidOrders.length} PAID orders synced`);

  // Sync vendor sheet if configured
  if (vendorSheetId) {
    try {
      await ensureSheet(sheets, vendorSheetId, VENDOR_SHEET_TITLE);
      const vendorHeader = ['Ref', 'Date', 'Name', 'Phone', 'Amount', 'Status', 'Address', 'Items (summary)', 'Notes'];
      const vendorValues = [vendorHeader, ...buildVendorRows(orders)];
      await sheets.spreadsheets.values.update({
        spreadsheetId: vendorSheetId,
        range: `${VENDOR_SHEET_TITLE}!A1:I${vendorValues.length}`,
        valueInputOption: 'RAW',
        requestBody: { values: vendorValues },
      });
    } catch (error) {
      console.error('[sheet-sync] Vendor sheet sync failed:', error);
    }
  }

  console.log(`[sheet-sync] Completed - ${orders.length} orders synced`);
}
