/** Coarse stock availability for public API (no exact counts). */
export type StockAvailability = 'in_stock' | 'low_stock' | 'out_of_stock';

export type InventoryRow = {
  productId: string;
  totalStock: number;
  bySize: Record<string, number>;
  lowStockThreshold: number;
};

export type PublicInventoryItem = {
  productId: string;
  availability: StockAvailability;
  inStock: boolean;
};

export function groupInventoryRows(
  rows: Array<{ productId: string; quantity: number; size: string | null; lowStockThreshold: number | null }>
): InventoryRow[] {
  const grouped: Record<string, InventoryRow> = {};
  for (const row of rows) {
    if (!grouped[row.productId]) {
      grouped[row.productId] = {
        productId: row.productId,
        totalStock: 0,
        bySize: {},
        lowStockThreshold: row.lowStockThreshold || 5,
      };
    }
    grouped[row.productId].totalStock += row.quantity;
    grouped[row.productId].bySize[row.size || 'FREE'] = row.quantity;
  }
  return Object.values(grouped);
}

export function toPublicInventory(items: InventoryRow[]): PublicInventoryItem[] {
  return items.map((item) => {
    const threshold = item.lowStockThreshold || 5;
    let availability: StockAvailability = 'in_stock';
    if (item.totalStock <= 0) {
      availability = 'out_of_stock';
    } else if (item.totalStock <= threshold) {
      availability = 'low_stock';
    }
    return {
      productId: item.productId,
      availability,
      inStock: item.totalStock > 0,
    };
  });
}
