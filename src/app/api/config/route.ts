import { listKeys } from '@/lib/filebase';
// TypeScript: Extend globalThis for chunked cache
declare global {
  // eslint-disable-next-line no-var
  var _chunkedProductsCache: Record<number, any[]> | undefined;
}
import { NextRequest, NextResponse } from 'next/server';
import { getDoc, setDoc } from '@/lib/firestore';
import { ShopConfig } from '@/lib/config';

const CONFIG_COLLECTION = 'config';
const CONFIG_DOC = 'shop-settings';
const PRODUCTS_DOC = 'products';

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
  // Load config from Firestore
  const cfg = (await getDoc<ShopConfig>(CONFIG_COLLECTION, CONFIG_DOC)) || DEFAULT_CONFIG;
  // If productsKey exists, load products from Firestore
  let products: any[] = [];
  if (cfg.productsKey) {
    products = (await getDoc<any[]>(CONFIG_COLLECTION, PRODUCTS_DOC)) || [];
  } else if (Array.isArray(cfg.products)) {
    products = cfg.products;
  }
  return NextResponse.json({ status: 'success', data: { ...cfg, products } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = body?.config as ShopConfig | undefined;
    const products = body?.products as any[] | undefined;
    const chunkIndex = body?.chunkIndex;
    const chunkTotal = body?.chunkTotal;
    const isLastChunk = body?.isLastChunk;

    // If not chunked, fallback to normal save (แต่ products จะถูกเก็บแยก)
    if (!Array.isArray(products) || chunkIndex === undefined || chunkTotal === undefined) {
      if (!config) return NextResponse.json({ status: 'error', message: 'missing config' }, { status: 400 });
      // ถ้ามี products ใน config ให้แยกเก็บ
      let productsKey = undefined;
      if (Array.isArray(config.products) && config.products.length > 0) {
        productsKey = PRODUCTS_DOC;
        await setDoc(CONFIG_COLLECTION, PRODUCTS_DOC, { products: config.products });
      }
      const configToSave = { ...config, products: undefined, productsKey };
      await setDoc(CONFIG_COLLECTION, CONFIG_DOC, configToSave);
      return NextResponse.json({ status: 'success', data: configToSave });
    }

    // --- Chunked upload logic ---
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

    // Last chunk: merge all chunks and save to Firestore
    const allChunks = [];
    for (let i = 0; i < chunkTotal; i++) {
      if (!Array.isArray(cache[i])) {
        return NextResponse.json({ status: 'error', message: `Missing chunk ${i + 1}` }, { status: 400 });
      }
      allChunks.push(...cache[i]);
    }
    // Clean up cache
    delete globalThis._chunkedProductsCache;

    // Save products to Firestore
    const productsKey = PRODUCTS_DOC;
    await setDoc(CONFIG_COLLECTION, PRODUCTS_DOC, { products: allChunks });

    // Save config (products field เป็น undefined, เก็บแค่ productsKey)
    const mergedConfig = { ...config, products: undefined, productsKey };
    await setDoc(CONFIG_COLLECTION, CONFIG_DOC, mergedConfig);
    return NextResponse.json({ status: 'success', data: mergedConfig });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
