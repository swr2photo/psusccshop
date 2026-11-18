import { getRedisClient, markRedisUnavailable } from './redis';

/**
 * Returns the new stock, -1 when there is not enough stock, or -2 when the key
 * does not exist (stock not tracked in Redis: unlimited / not seeded yet).
 * -2 makes the caller use the DB/JSON stock instead of rejecting the order —
 * previously a missing key returned -1 and blocked every unlimited-stock item.
 */
const ATOMIC_DEDUCT_SCRIPT = `
  local raw = redis.call('get', KEYS[1])
  if not raw then
    return -2 -- ไม่มีข้อมูลสต็อกใน Redis → ใช้สต็อกจากฐานข้อมูลแทน
  end
  local stock = tonumber(raw)
  if stock == nil or stock < tonumber(ARGV[1]) then
    return -1 -- สต็อกไม่พอ
  end
  return redis.call('decrby', KEYS[1], ARGV[1])
`;

const ATOMIC_RESTORE_SCRIPT = `
  if redis.call('exists', KEYS[1]) == 1 then
    return redis.call('incrby', KEYS[1], ARGV[1])
  end
  return 0
`;

export async function deductStockAtomic(stockKey: string, quantity: number): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis not configured for Atomic Stock');
  }

  // EVAL script 1 key args...
  let result: unknown;
  try {
    result = await redis.eval(ATOMIC_DEDUCT_SCRIPT, [stockKey], [quantity]);
  } catch (error) {
    markRedisUnavailable(error instanceof Error ? error.message : error);
    throw error;
  }
  if (typeof result !== 'number') {
    // Upstash error body (e.g. quota) instead of a number — let the caller fall back
    markRedisUnavailable('stock deduct: invalid EVAL result');
    throw new Error('Redis returned an invalid stock result');
  }
  return result;
}

export async function restoreStockAtomic(stockKey: string, quantity: number): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis not configured for Atomic Stock');
  }
  const result = await redis.eval(ATOMIC_RESTORE_SCRIPT, [stockKey], [quantity]);
  return result as number;
}
