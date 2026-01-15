// TypeScript: Extend globalThis for chunked cache
declare global {
  // eslint-disable-next-line no-var
  var _chunkedProductsCache: Record<number, any[]> | undefined;
}
import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';

const CONFIG_KEY = 'config/shop-settings.json';

const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
};

export async function GET() {
  const cfg = (await getJson<ShopConfig>(CONFIG_KEY)) || DEFAULT_CONFIG;
  return NextResponse.json({ status: 'success', data: cfg });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = body?.config as ShopConfig | undefined;
    const products = body?.products as any[] | undefined;
    const chunkIndex = body?.chunkIndex;
    const chunkTotal = body?.chunkTotal;
    const isLastChunk = body?.isLastChunk;

    // If not chunked, fallback to normal save
    if (!Array.isArray(products) || chunkIndex === undefined || chunkTotal === undefined) {
      if (!config) return NextResponse.json({ status: 'error', message: 'missing config' }, { status: 400 });
      await putJson(CONFIG_KEY, config);
      return NextResponse.json({ status: 'success', data: config });
    }

    // --- Chunked upload logic ---
    // Use in-memory cache (global variable) for chunked products
    // Note: This cache will reset on serverless cold start
    // For production, consider using Redis or persistent cache
    if (!globalThis._chunkedProductsCache) {
      globalThis._chunkedProductsCache = {};
    }
    const cache = globalThis._chunkedProductsCache;
    if (!cache[chunkIndex]) cache[chunkIndex] = [];
    cache[chunkIndex] = products;

    // If not last chunk, just acknowledge
    if (!isLastChunk) {
      return NextResponse.json({ status: 'success', message: `Chunk ${chunkIndex + 1}/${chunkTotal} received` });
    }

    // Last chunk: merge all chunks and save
    const allChunks = [];
    for (let i = 0; i < chunkTotal; i++) {
      if (!Array.isArray(cache[i])) {
        return NextResponse.json({ status: 'error', message: `Missing chunk ${i + 1}` }, { status: 400 });
      }
      allChunks.push(...cache[i]);
    }
    // Clean up cache
    delete globalThis._chunkedProductsCache;

    // Merge products into config and save
    const mergedConfig = { ...config, products: allChunks };
    await putJson(CONFIG_KEY, mergedConfig);
    return NextResponse.json({ status: 'success', data: mergedConfig });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
