import { useMemo, useState, useCallback } from 'react';
import { Product, ShopConfig, sortProductsNewestFirst } from '@/lib/config';
import { productMatchesSearch } from '@/lib/product-search';
import { getShopStatus, ShopStatusType } from '@/components/ShopStatusCard';
import type { ShopEvent } from '@/components/EventBanner';

export interface CatalogShopEntry {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  logoUrl?: string;
  isOpen?: boolean;
  openDate?: string;
  closeDate?: string;
  settings?: { isOpen?: boolean; openDate?: string; closeDate?: string };
  products: Product[];
  events?: ShopEvent[];
  shirtNameConfig?: any;
  nameValidation?: any;
  shippingOptions?: any[];
  promoCodes?: any[];
}

export interface UseHomePageCatalogProps {
  config: ShopConfig | null;
  subShopCatalog: CatalogShopEntry[];
  now: Date;
  lang: 'th' | 'en';
  mainShopLabel: string;
}

export function useHomePageCatalog({
  config,
  subShopCatalog,
  now,
  lang,
  mainShopLabel,
}: UseHomePageCatalogProps) {
  const [activeShopMenu, setActiveShopMenu] = useState<string>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc'>('default');

  const shopStatusType = useMemo(
    () => getShopStatus(config?.isOpen ?? true, config?.closeDate, config?.openDate, now),
    [config, now]
  );
  const isShopOpen = shopStatusType === 'OPEN';

  const subShopTabs = useMemo(() => {
    return subShopCatalog.map((s) => ({
      slug: s.slug,
      name: lang === 'en' && s.nameEn ? s.nameEn : s.name,
      logoUrl: s.logoUrl,
      isOpen: getShopStatus(
        s.isOpen ?? s.settings?.isOpen ?? true,
        s.closeDate || s.settings?.closeDate,
        s.openDate || s.settings?.openDate,
        now
      ) === 'OPEN',
    }));
  }, [subShopCatalog, lang, now]);

  const activeShopContent = useMemo(() => {
    if (activeShopMenu === 'main') {
      return {
        shopId: undefined,
        shopSlug: undefined,
        shopName: mainShopLabel,
        products: config?.products || [],
        events: config?.events as ShopEvent[] | undefined,
        isOpen: isShopOpen,
        shirtNameConfig: config?.shirtNameConfig,
        nameValidation: config?.nameValidation,
        shippingOptions: (config as any)?.shippingOptions,
        promoCodes: (config as any)?.promoCodes,
      };
    }

    const shop = subShopCatalog.find((s) => s.slug === activeShopMenu);
    if (!shop) {
      return {
        shopId: undefined,
        shopSlug: undefined,
        shopName: '',
        products: [] as Product[],
        events: undefined as ShopEvent[] | undefined,
        isOpen: true,
        shirtNameConfig: undefined,
        nameValidation: undefined,
        shippingOptions: undefined,
        promoCodes: undefined,
      };
    }

    return {
      shopId: shop.id,
      shopSlug: shop.slug,
      shopName: lang === 'en' && shop.nameEn ? shop.nameEn : shop.name,
      products: (shop.products || []).filter((p) => p.isActive !== false) as Product[],
      events: shop.events as ShopEvent[] | undefined,
      isOpen: getShopStatus(
        shop.isOpen ?? shop.settings?.isOpen ?? true,
        shop.closeDate || shop.settings?.closeDate,
        shop.openDate || shop.settings?.openDate,
        now
      ) === 'OPEN',
      shirtNameConfig: shop.shirtNameConfig,
      nameValidation: shop.nameValidation,
      shippingOptions: shop.shippingOptions,
      promoCodes: shop.promoCodes,
    };
  }, [activeShopMenu, config, subShopCatalog, lang, isShopOpen, mainShopLabel, now]);

  const availableCategories = useMemo(() => {
    const rawProds = activeShopContent.products || [];
    const set = new Set<string>();
    for (const p of rawProds) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [activeShopContent.products]);

  const filteredProducts = useMemo(() => {
    let prods = [...(activeShopContent.products || [])];

    if (searchQuery.trim()) {
      prods = prods.filter((p) => productMatchesSearch(p, searchQuery, lang));
    }

    if (selectedCategory !== 'all') {
      prods = prods.filter((p) => p.category === selectedCategory);
    }

    if (priceSort === 'asc') {
      prods.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
    } else if (priceSort === 'desc') {
      prods.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
    } else {
      prods = sortProductsNewestFirst(prods);
    }

    return prods;
  }, [activeShopContent.products, searchQuery, selectedCategory, priceSort, lang]);

  const handleSelectShopMenu = useCallback((menuSlug: string) => {
    setActiveShopMenu(menuSlug);
    setSelectedCategory('all');
    setSearchQuery('');
  }, []);

  return {
    activeShopMenu,
    setActiveShopMenu,
    handleSelectShopMenu,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    priceSort,
    setPriceSort,
    shopStatusType,
    isShopOpen,
    subShopTabs,
    activeShopContent,
    availableCategories,
    filteredProducts,
  };
}
