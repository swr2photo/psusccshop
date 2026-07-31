'use client';

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Popover,
} from '@mui/material';
import { Search, ArrowUpDown, X } from 'lucide-react';
import { ProductCardItem } from './ProductCardItem';
import type { Product } from '@/lib/config';
import { useTranslation } from '@/hooks/useTranslation';

export interface ProductGridSectionProps {
  filteredProducts: Product[];
  subShopTabs: Array<{ slug: string; name: string; logoUrl?: string; isOpen: boolean }>;
  activeShopMenu: string;
  onSelectShopMenu: (slug: string) => void;
  availableCategories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  priceSort: 'default' | 'asc' | 'desc';
  onPriceSortChange: (sort: 'default' | 'asc' | 'desc') => void;
  catalogContext: {
    shopId?: string;
    shopSlug?: string;
    isOpen: boolean;
    events?: any[];
  };
  now: Date;
  lang: 'th' | 'en';
  onSelectProduct: (product: Product, context: { shopId?: string; shopSlug?: string; isOpen: boolean }) => void;
  onQuickAddToCart?: (product: Product, context: { shopId?: string; shopSlug?: string; isOpen: boolean }) => void;
  onShowToast: (type: 'info' | 'warning' | 'success' | 'error', message: string) => void;
  mainShopLabel: string;
}

export function ProductGridSection({
  filteredProducts,
  subShopTabs,
  activeShopMenu,
  onSelectShopMenu,
  availableCategories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchQueryChange,
  priceSort,
  onPriceSortChange,
  catalogContext,
  now,
  lang,
  onSelectProduct,
  onQuickAddToCart,
  onShowToast,
  mainShopLabel,
}: ProductGridSectionProps) {
  const { t } = useTranslation();
  const [sortAnchorEl, setSortAnchorEl] = React.useState<HTMLButtonElement | null>(null);

  const handleOpenSort = (event: React.MouseEvent<HTMLButtonElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleCloseSort = () => {
    setSortAnchorEl(null);
  };

  return (
    <Box sx={{ width: '100%', py: 4 }}>
      {/* Sub-shop Tabs Bar */}
      {subShopTabs.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            pb: 2,
            mb: 3,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          <Chip
            label={mainShopLabel}
            onClick={() => onSelectShopMenu('main')}
            color={activeShopMenu === 'main' ? 'primary' : 'default'}
            variant={activeShopMenu === 'main' ? 'filled' : 'outlined'}
            sx={{ fontWeight: 700, px: 1, py: 2.2, borderRadius: 3, cursor: 'pointer' }}
          />

          {subShopTabs.map((tab) => (
            <Chip
              key={tab.slug}
              label={tab.name}
              onClick={() => onSelectShopMenu(tab.slug)}
              color={activeShopMenu === tab.slug ? 'primary' : 'default'}
              variant={activeShopMenu === tab.slug ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, px: 1, py: 2.2, borderRadius: 3, cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}

      {/* Filter and Search Bar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          mb: 3,
        }}
      >
        {/* Category Chips */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            py: 0.5,
            flexGrow: 1,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          <Chip
            label={t.common.all || 'ทั้งหมด'}
            onClick={() => onSelectCategory('all')}
            color={selectedCategory === 'all' ? 'primary' : 'default'}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
          {availableCategories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => onSelectCategory(cat)}
              color={selectedCategory === cat ? 'primary' : 'default'}
              sx={{ fontWeight: 600, cursor: 'pointer' }}
            />
          ))}
        </Box>

        {/* Search & Sort Controls */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            placeholder={lang === 'en' ? 'Search products...' : 'ค้นหาสินค้า...'}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchQueryChange('')}>
                    <X size={16} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              minWidth: { xs: '100%', sm: 220 },
              '& .MuiOutlinedInput-root': { borderRadius: 3 },
            }}
          />

          <IconButton onClick={handleOpenSort} sx={{ border: '1px solid var(--border)', borderRadius: 3 }}>
            <ArrowUpDown size={18} />
          </IconButton>

          <Popover
            open={Boolean(sortAnchorEl)}
            anchorEl={sortAnchorEl}
            onClose={handleCloseSort}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 160 }}>
              <Button
                size="small"
                onClick={() => { onPriceSortChange('default'); handleCloseSort(); }}
                variant={priceSort === 'default' ? 'contained' : 'text'}
              >
                {lang === 'en' ? 'Newest' : 'เรียงตามล่าสุด'}
              </Button>
              <Button
                size="small"
                onClick={() => { onPriceSortChange('asc'); handleCloseSort(); }}
                variant={priceSort === 'asc' ? 'contained' : 'text'}
              >
                {lang === 'en' ? 'Price: Low to High' : 'ราคา: ต่ำ ➔ สูง'}
              </Button>
              <Button
                size="small"
                onClick={() => { onPriceSortChange('desc'); handleCloseSort(); }}
                variant={priceSort === 'desc' ? 'contained' : 'text'}
              >
                {lang === 'en' ? 'Price: High to Low' : 'ราคา: สูง ➔ ต่ำ'}
              </Button>
            </Box>
          </Popover>
        </Box>
      </Box>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: { xs: 1.5, sm: 2.5 },
          }}
        >
          {filteredProducts.map((product) => (
            <ProductCardItem
              key={product.id}
              product={product}
              catalogContext={catalogContext}
              now={now}
              lang={lang}
              onSelectProduct={onSelectProduct}
              onQuickAddToCart={onQuickAddToCart}
              onShowToast={onShowToast}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
            {lang === 'en' ? 'No products found' : 'ไม่พบรายการสินค้าที่ค้นหา'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
