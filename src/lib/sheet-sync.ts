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
        rows.length + 1,
        o?.customerName || o?.name || '',
        item.options?.customNumber || item.customNumber || '',
        item.options?.customName || item.customName || '',
        size,
        item.options?.isLongSleeve ? 'แขนยาว' : '',
        '',
        '',
        o?.notes || o?.remark || '',
        '',
        '',
        '',
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

  return [header, ...rows, [], summaryHeader, ...summaryRows];
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

  // Sync factory export
  const factoryValues = buildFactoryExport(orders);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${FACTORY_EXPORT_TITLE}!A1:N${factoryValues.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: factoryValues },
  });

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
