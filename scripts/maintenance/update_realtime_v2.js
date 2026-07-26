const fs = require('fs');
const path = 'src/app/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `      .on(
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

const replacement = `      .on(
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
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          console.log('[Realtime] Public products change payload:', payload);
          mutate(PAGE_CACHE_KEYS.CATALOG);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
        },
        (payload) => {
          console.log('[Realtime] Public categories change payload:', payload);
          mutate(PAGE_CACHE_KEYS.CATALOG);
        }
      )`;

if (!content.includes("table: 'products'")) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated page.tsx with products and categories realtime listeners');
} else {
  console.log('Listeners already exist');
}
