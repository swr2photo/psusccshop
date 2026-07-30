import { getRedisClient } from './redis';

const ATOMIC_DEDUCT_SCRIPT = `
  local stock = tonumber(redis.call('get', KEYS[1]))
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
  const result = await redis.eval(ATOMIC_DEDUCT_SCRIPT, [stockKey], [quantity]);
  return result as number;
}

export async function restoreStockAtomic(stockKey: string, quantity: number): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis not configured for Atomic Stock');
  }
  const result = await redis.eval(ATOMIC_RESTORE_SCRIPT, [stockKey], [quantity]);
  return result as number;
}
