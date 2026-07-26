import { execSync } from 'child_process';
import fs from 'fs';

try {
  execSync('npx vercel env pull scratch/vercel-prod.env --environment=production --yes', {
    stdio: 'inherit',
  });
} catch {
  console.error('pull failed');
}

const t = fs.readFileSync('scratch/vercel-prod.env', 'utf8');
for (const k of [
  'API_PROXY_ALL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SPLIT_API',
  'API_INTERNAL_URL',
  'COOKIE_DOMAIN',
  'NEXT_PUBLIC_COOKIE_DOMAIN',
]) {
  const re = new RegExp(`^${k}=(.*)$`, 'm');
  const m = t.match(re);
  if (!m) {
    console.log(k + ': MISSING');
    continue;
  }
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  console.log(k + ':', v || '(empty)');
}
