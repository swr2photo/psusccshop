// src/lib/sheet-sync.ts
// Background sheet sync utility - auto-syncs orders to Google Sheets

import { getSheets } from '@/lib/google';
import { getJson, getAllOrders } from '@/lib/filebase';
import type { Product } from '@/lib/config';
import {
  FACTORY_EXPORT_TITLE,
  buildFactoryExport,
  groupOrdersByProduct,
  resolveFactoryOrderStatuses,
  shouldUsePerProductFactorySheets,
  type SheetSettings,
} from '@/lib/sheet-factory-export';

const ORDERS_SHEET_TITLE = 'Orders';
const VENDOR_SHEET_TITLE = 'Orders Vendor';

const CONFIG_KEY = 'config/shop-settings.json';

let syncTimeout: NodeJS.Timeout | null = null;
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 5000;

export async function triggerSheetSync(baseUrl?: string): Promise<void> {
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    console.log('[sheet-sync] Skipping - synced recently');
    return;
  }
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await performSync(baseUrl);
      lastSyncTime = Date.now();
    } catch (error) {
      console.error('[sheet-sync] Background sync failed:', error);
    }
  }, 2000);
}

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

export const ensureSheet = async (sheets: any, spreadsheetId: string, title: string) => {
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

export async function syncFactoryExportSheets(
  sheets: any,
  spreadsheetId: string,
  orders: any[],
  products: Product[] = [],
  sheetSettings?: SheetSettings,
): Promise<{ mode: 'per_product' | 'combined'; tabs: string[] }> {
  const statuses = resolveFactoryOrderStatuses(sheetSettings);
  const factoryOrders = orders.filter((o) => statuses.includes(String(o?.status || '').toUpperCase()));
  const perProduct = shouldUsePerProductFactorySheets(sheetSettings);

  if (perProduct) {
    const groups = groupOrdersByProduct(factoryOrders, products);
    const tabs: string[] = [];

    for (const group of groups) {
      await ensureSheet(sheets, spreadsheetId, group.sheetTitle);
      const values = buildFactoryExport(group.orders, group.productLabel);
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${group.sheetTitle.replace(/'/g, "''")}'!A:Z`,
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${group.sheetTitle.replace(/'/g, "''")}'!A1:M${values.length}`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
      tabs.push(group.sheetTitle);
    }

    // Clear legacy combined tab if present
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${FACTORY_EXPORT_TITLE}!A:Z`,
      });
    } catch {
      /* tab may not exist */
    }

    console.log(`[sheet-sync] Per-product factory export — ${groups.length} product tabs`);
    return { mode: 'per_product', tabs };
  }

  await ensureSheet(sheets, spreadsheetId, FACTORY_EXPORT_TITLE);
  const factoryValues = buildFactoryExport(factoryOrders);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${FACTORY_EXPORT_TITLE}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${FACTORY_EXPORT_TITLE}!A1:M${factoryValues.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: factoryValues },
  });

  console.log(`[sheet-sync] Combined factory export — ${factoryOrders.length} orders`);
  return { mode: 'combined', tabs: [FACTORY_EXPORT_TITLE] };
}

async function performSync(baseUrl?: string): Promise<void> {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[sheet-sync] Skipping - Google credentials not configured');
    return;
  }

  const config = await getJson<any>(CONFIG_KEY);
  const sheetId = config?.sheetId || process.env.GOOGLE_SHEET_ID;
  const vendorSheetId = config?.vendorSheetId || process.env.VENDOR_SHEET_ID;
  const sheetSettings: SheetSettings | undefined = config?.sheetSettings;
  const products: Product[] = config?.products || [];

  if (!sheetId) {
    console.log('[sheet-sync] Skipping - No sheet ID configured');
    return;
  }

  console.log('[sheet-sync] Starting sync to sheet:', sheetId);

  const sheets = await getSheets();
  const url = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psusci.club';

  await ensureSheet(sheets, sheetId, ORDERS_SHEET_TITLE);

  const { orders } = await getAllOrders({ limit: 10000 });
  const orderList = orders.map((data: any) => ({ ...data, _key: `orders/${data.ref}.json` }));

  const header = ['Ref', 'Date', 'Name', 'Email', 'Phone', 'Amount', 'Status', 'Address', 'Items (summary)', 'Notes', 'Slip', 'Slip Date', 'Slip Verified', 'Slip Link'];
  const values = [header, ...buildRows(orderList, url)];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${ORDERS_SHEET_TITLE}!A1:N${values.length}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  await syncFactoryExportSheets(sheets, sheetId, orderList, products, sheetSettings);

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
