const fs = require('fs');

const path = 'src/app/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Import mutate from swr
if (!content.includes("import { mutate } from 'swr';")) {
  content = content.replace(
    "import { useShopCatalog, useProductReviews } from '@/hooks/usePageData';",
    "import { useShopCatalog, useProductReviews, PAGE_CACHE_KEYS } from '@/hooks/usePageData';\nimport { mutate } from 'swr';"
  );
} else if (!content.includes("PAGE_CACHE_KEYS")) {
  content = content.replace(
    "import { useShopCatalog, useProductReviews } from '@/hooks/usePageData';",
    "import { useShopCatalog, useProductReviews, PAGE_CACHE_KEYS } from '@/hooks/usePageData';"
  );
}

// 2. Add real-time listener for shops table
const target = `      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'config',
          // Lightweight version row bumped by the server on every config save
          filter: 'key=eq.config-version',
        },
        (payload) => {
          console.log('[Realtime] Public config change payload:', payload);
          const newData = payload.new as Record<string, any> | null;
          handleConfigChange(newData?.value || {});
        }
      )`;

const replacement = `      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'config',
          // Lightweight version row bumped by the server on every config save
          filter: 'key=eq.config-version',
        },
        (payload) => {
          console.log('[Realtime] Public config change payload:', payload);
          const newData = payload.new as Record<string, any> | null;
          handleConfigChange(newData?.value || {});
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shops',
        },
        (payload) => {
          console.log('[Realtime] Public shops change payload:', payload);
          // Refetch the public sub-shop catalog via SWR
          mutate(PAGE_CACHE_KEYS.CATALOG);
        }
      )`;

if (!content.includes("table: 'shops'")) {
  content = content.replace(target, replacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Update page.tsx success');
