import { getProductDescription, getProductName, type Product } from './config';

/** Match product against a search term (name, description, type, slug, tags, category). */
export function productMatchesSearch(
  product: Product,
  term: string,
  lang: 'th' | 'en',
  categoryLabel = '',
): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = [
    getProductName(product, lang),
    product.name,
    product.nameEn,
    getProductDescription(product, lang),
    product.description,
    product.descriptionEn,
    product.slug,
    product.id,
    product.type,
    product.category,
    categoryLabel,
    ...(Array.isArray((product as { tags?: string[] }).tags) ? (product as { tags?: string[] }).tags! : []),
  ]
    .filter(Boolean)
    .map((field) => String(field).toLowerCase());

  return tokens.every((token) => haystack.some((field) => field.includes(token)));
}

/** Rank products for search preview — exact name match first, then prefix, then contains. */
export function rankProductSearch(
  product: Product,
  term: string,
  lang: 'th' | 'en',
): number {
  const q = term.trim().toLowerCase();
  if (!q) return 0;

  const tokens = q.split(/\s+/).filter(Boolean);
  const name = getProductName(product, lang).toLowerCase();
  const thaiName = (product.name || '').toLowerCase();

  let score = 0;
  if (name === q) score = Math.max(score, 100);
  else if (name.startsWith(q)) score = Math.max(score, 80);
  else if (name.includes(q)) score = Math.max(score, 60);

  if (thaiName.startsWith(q)) score = Math.max(score, 55);
  else if (thaiName.includes(q)) score = Math.max(score, 45);

  if (tokens.length > 1) {
    const matchedTokens = tokens.filter(
      (token) => name.includes(token) || thaiName.includes(token) || productMatchesSearch(product, token, lang),
    ).length;
    score = Math.max(score, matchedTokens * 15);
    if (matchedTokens === tokens.length) score += 25;
  }

  if (!score && productMatchesSearch(product, q, lang)) score = 20;
  return score;
}
