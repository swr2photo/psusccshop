import { getRedisClient } from './redis';
import { ShopConfig } from './config';

/**
 * Merges real-time stock values from Redis into the ShopConfig object.
 * This ensures that the Frontend and Admin Panel see the true live stock
 * instead of the stale original stock in the JSON file.
 */
export async function mergeRealtimeStock(config: ShopConfig, shopId: string = 'main'): Promise<ShopConfig> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('[Realtime Stock] Redis not configured, skipping realtime stock merge');
    return config;
  }

  // Deep clone to avoid mutating the original cached object if any
  const mergedConfig: ShopConfig = JSON.parse(JSON.stringify(config));

  if (!mergedConfig.products || mergedConfig.products.length === 0) {
    return mergedConfig;
  }

  // Collect all keys and their corresponding references
  const keysToFetch: string[] = [];
  const keyMap: Record<string, { productIndex: number; variantIndex?: number }> = {};

  for (let pIdx = 0; pIdx < mergedConfig.products.length; pIdx++) {
    const product = mergedConfig.products[pIdx];
    
    if (product.variants && product.variants.length > 0) {
      for (let vIdx = 0; vIdx < product.variants.length; vIdx++) {
        const variant = product.variants[vIdx];
        if (typeof variant.stock === 'number' || variant.stock === null) {
          // Note: The key format matches src/app/api/orders/route.ts
          const size = variant.id || variant.name || 'FREE';
          const stockKey = `stock:${shopId}:${product.id}:${size}`;
          keysToFetch.push(stockKey);
          keyMap[stockKey] = { productIndex: pIdx, variantIndex: vIdx };
        }
      }
    } else {
      if (typeof product.stock === 'number' || product.stock === null) {
        const size = 'FREE';
        const stockKey = `stock:${shopId}:${product.id}:${size}`;
        keysToFetch.push(stockKey);
        keyMap[stockKey] = { productIndex: pIdx };
      }
    }
  }

  if (keysToFetch.length === 0) {
    return mergedConfig;
  }

  try {
    // MGET retrieves all stock values in a single network round-trip
    const redisStocks = await redis.mget(...keysToFetch);
    const keysToSeed: Record<string, number> = {};

    for (let i = 0; i < keysToFetch.length; i++) {
      const key = keysToFetch[i];
      const stockStr = redisStocks[i];
      const mapping = keyMap[key];
      const originalStock = mapping.variantIndex !== undefined 
          ? mergedConfig.products[mapping.productIndex].variants![mapping.variantIndex].stock 
          : mergedConfig.products[mapping.productIndex].stock;
      
      if (stockStr !== null && stockStr !== undefined) {
        const actualStock = parseInt(stockStr as string, 10);
        if (!isNaN(actualStock)) {
          if (mapping.variantIndex !== undefined) {
            mergedConfig.products[mapping.productIndex].variants![mapping.variantIndex].stock = actualStock;
          } else {
            mergedConfig.products[mapping.productIndex].stock = actualStock;
          }
        }
      } else if (originalStock !== null && originalStock !== undefined) {
        // Stock key is missing in Redis. We should re-seed it using the JSON stock source-of-truth.
        keysToSeed[key] = originalStock;
      }
    }

    // Self-healing: seed missing keys in the background
    if (Object.keys(keysToSeed).length > 0) {
      Promise.all(
        Object.entries(keysToSeed).map(([k, v]) => 
          redis.setnx(k, v) // Only set if it truly doesn't exist, to prevent race conditions
        )
      ).catch(e => console.warn('[Realtime Stock] Failed to auto-seed Redis:', e));
    }
  } catch (error) {
    console.error('[Realtime Stock] Failed to fetch stock from Redis:', error);
  }

  return mergedConfig;
}
