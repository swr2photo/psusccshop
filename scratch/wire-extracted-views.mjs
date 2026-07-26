/**
 * Replace inline Promo/Events/Announcements/Products views in admin/page.tsx
 * with imports from extracted shadcn components.
 */
import fs from 'fs';

const path = 'src/app/admin/page.tsx';
let src = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

if (src.includes("from '@/components/admin/PromoCodesView'")) {
  console.log('Already wired');
  process.exit(0);
}

// Add imports
src = src.replace(
  `import ShopManagement from '@/components/admin/ShopManagement';`,
  `import ShopManagement from '@/components/admin/ShopManagement';
import { PromoCodesView } from '@/components/admin/PromoCodesView';
import { EventsView } from '@/components/admin/EventsView';
import { AnnouncementsView } from '@/components/admin/AnnouncementsView';
import { ProductsView } from '@/components/admin/ProductsView';`,
);

const lines = src.split('\n');

function findLine(pred) {
  const i = lines.findIndex(pred);
  if (i < 0) throw new Error('marker not found: ' + pred);
  return i;
}

const promoStart = findLine((l) => l.includes('// ============== PROMO CODES VIEW'));
const mainStart = findLine((l) => l.includes('// ============== MAIN COMPONENT'));
// Remove promo through end of announcements (line before MAIN)
const withoutViews = [...lines.slice(0, promoStart), ...lines.slice(mainStart)];

// Remove ProductCardItem / ProductsView / pickup dialog at end
// Keep StatCard and helpers that Orders needs; cut from isProductOpen / ProductCardItem
let cutFrom = withoutViews.findIndex((l) => l.includes('Check if product is currently open'));
if (cutFrom < 0) {
  cutFrom = withoutViews.findIndex((l) => l.includes('const ProductCardItem'));
}
if (cutFrom < 0) {
  cutFrom = withoutViews.findIndex((l) => l.includes('type ProductsViewProps'));
}
if (cutFrom < 0) throw new Error('Products section not found');

// Also remove formatDateTime / status badge helpers only used by ProductCard if just above
// Walk back a bit past blank lines / comments
while (cutFrom > 0 && withoutViews[cutFrom - 1].trim() === '') cutFrom--;
// If previous block is StatusBadge or similar product-only, try to keep StatusBadge for orders
// Look for "// Format date/time" or StatusBadge - StatusBadge may be used by orders

const beforeProducts = withoutViews.slice(0, cutFrom);
const hasStatusBadge = beforeProducts.some((l) => l.includes('StatusBadge'));
console.log('cutFrom line', cutFrom + 1, 'hasStatusBadge in kept', hasStatusBadge);

const newSrc = beforeProducts.join('\n') + '\n';
fs.writeFileSync(path, newSrc);
console.log('page.tsx lines:', newSrc.split('\n').length);

// Verify no duplicate definitions
for (const name of ['const PromoCodesView', 'const EventsView', 'const AnnouncementsView', 'function ProductsView', 'const ProductCardItem']) {
  if (newSrc.includes(name)) console.warn('STILL HAS', name);
  else console.log('removed', name);
}
