// Factory / production summary export for Google Sheets

import type { Product } from '@/lib/config';

export const FACTORY_EXPORT_TITLE = 'Factory Export';
export const FACTORY_SHEET_PREFIX = 'สรุป';

export interface SheetSettings {
  /** แยกชีตสรุปตามสินค้า (ค่าเริ่มต้น: เปิด) */
  factoryPerProduct?: boolean;
  /** สถานะออเดอร์ที่นำเข้าชีตสรุป (ค่าเริ่มต้น: PAID) */
  factoryOrderStatuses?: string[];
}

export const DEFAULT_SHEET_SETTINGS: Required<SheetSettings> = {
  factoryPerProduct: true,
  factoryOrderStatuses: ['PAID'],
};

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];

function getSizeIndex(size: string) {
  const idx = SIZE_ORDER.findIndex((s) => size?.toUpperCase()?.includes(s));
  return idx === -1 ? 999 : idx;
}

/** Google Sheets tab title — max 100 chars, forbidden: ' \\ / ? * [ ] */
export function sanitizeSheetTabTitle(raw: string, suffix = ''): string {
  const cleaned = (raw || 'สินค้า')
    .replace(/[\\/?*[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(1, 100 - suffix.length));
  return `${cleaned}${suffix}`.slice(0, 100);
}

export function resolveItemProductKey(item: any): string {
  const id = (item?.productId || '').trim();
  if (id) return id;
  const name = (item?.productName || item?.name || '').trim();
  return name ? `name:${name}` : 'unknown';
}

export function buildProductLabelMap(products: Product[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products) {
    if (p.id) map.set(p.id, p.name || p.id);
    if (p.name) map.set(`name:${p.name}`, p.name);
  }
  return map;
}

export function filterOrdersForProductKey(orders: any[], productKey: string): any[] {
  return orders
    .map((order) => {
      const items = (order?.items || order?.cart || order?.raw?.items || []).filter(
        (item: any) => resolveItemProductKey(item) === productKey,
      );
      if (!items.length) return null;
      return { ...order, items, cart: items };
    })
    .filter(Boolean) as any[];
}

export interface ProductFactoryGroup {
  productKey: string;
  sheetTitle: string;
  productLabel: string;
  orders: any[];
}

export function groupOrdersByProduct(
  orders: any[],
  products: Product[] = [],
): ProductFactoryGroup[] {
  const labelMap = buildProductLabelMap(products);
  const keys = new Set<string>();

  for (const order of orders) {
    const items = order?.items || order?.cart || order?.raw?.items || [];
    for (const item of items) {
      keys.add(resolveItemProductKey(item));
    }
  }

  const usedTitles = new Set<string>();
  const groups: ProductFactoryGroup[] = [];

  for (const productKey of keys) {
    const productLabel = labelMap.get(productKey)
      || (productKey.startsWith('name:') ? productKey.slice(5) : productKey);
    const baseTitle = `${FACTORY_SHEET_PREFIX} ${productLabel}`;
    let sheetTitle = sanitizeSheetTabTitle(baseTitle);
    if (usedTitles.has(sheetTitle)) {
      const shortId = productKey.replace(/^name:/, '').slice(0, 8);
      sheetTitle = sanitizeSheetTabTitle(baseTitle, ` (${shortId})`);
    }
    usedTitles.add(sheetTitle);

    groups.push({
      productKey,
      sheetTitle,
      productLabel,
      orders: filterOrdersForProductKey(orders, productKey),
    });
  }

  groups.sort((a, b) => a.productLabel.localeCompare(b.productLabel, 'th'));
  return groups;
}

export function resolveFactoryOrderStatuses(settings?: SheetSettings): string[] {
  const statuses = settings?.factoryOrderStatuses?.filter(Boolean);
  return statuses?.length ? statuses : DEFAULT_SHEET_SETTINGS.factoryOrderStatuses;
}

export function shouldUsePerProductFactorySheets(settings?: SheetSettings): boolean {
  return settings?.factoryPerProduct !== false;
}

/** Build production report rows for one product (or all items when productTitle omitted). */
export function buildFactoryExport(orders: any[], productTitle?: string) {
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

      sizeCount[size] = (sizeCount[size] || 0) + qty;
      if (isLongSleeve) {
        sizeLongSleeveCount[size] = (sizeLongSleeveCount[size] || 0) + qty;
      } else {
        sizeShortSleeveCount[size] = (sizeShortSleeveCount[size] || 0) + qty;
      }

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
          pattern: item.options?.pattern || item.pattern || '',
          customName: item.options?.customName || item.customName || '',
          customNumber: item.options?.customNumber || item.customNumber || '',
        });
      }
    });
  });

  allItems.sort((a, b) => {
    const sizeCompare = getSizeIndex(a.size) - getSizeIndex(b.size);
    if (sizeCompare !== 0) return sizeCompare;
    return (a.customerName || '').localeCompare(b.customerName || '');
  });

  const header = [
    'ลำดับ', 'ไซซ์', 'แขน', 'ลาย', 'ชื่อสกรีน', 'เบอร์สกรีน',
    'ชื่อลูกค้า', 'เบอร์โทร', 'ที่อยู่', 'สินค้า', 'ตัวที่', 'Ref', 'วันที่สั่ง',
  ];

  const rows = allItems.map((item, index) => [
    index + 1,
    item.size,
    item.isLongSleeve ? 'แขนยาว' : 'แขนสั้น',
    item.pattern || '-',
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

  const sortedSizes = Object.keys(sizeCount).sort((a, b) => getSizeIndex(a) - getSizeIndex(b));
  const summaryHeader = ['สรุปตามไซซ์', '', '', ''];
  const summarySubHeader = ['ไซซ์', 'แขนสั้น', 'แขนยาว', 'รวม'];
  const summaryRows = sortedSizes.map((size) => [
    size,
    sizeShortSleeveCount[size] || 0,
    sizeLongSleeveCount[size] || 0,
    sizeCount[size] || 0,
  ]);

  const totalShortSleeve = Object.values(sizeShortSleeveCount).reduce((a, b) => a + b, 0);
  const totalLongSleeve = Object.values(sizeLongSleeveCount).reduce((a, b) => a + b, 0);
  const grandTotal = totalShortSleeve + totalLongSleeve;

  const reportTitle = productTitle
    ? `รายงานการผลิต — ${productTitle}`
    : 'รายงานการผลิต - Factory Export';

  const statsRow = [
    `จำนวนคำสั่งซื้อ: ${orders.length} รายการ`,
    `จำนวนชิ้นทั้งหมด: ${grandTotal} ชิ้น`,
    `อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`,
    '',
  ];

  return [
    [reportTitle],
    statsRow,
    [],
    header,
    ...rows,
    [],
    [],
    summaryHeader,
    summarySubHeader,
    ...summaryRows,
    ['รวมทั้งหมด', totalShortSleeve, totalLongSleeve, grandTotal],
  ];
}
