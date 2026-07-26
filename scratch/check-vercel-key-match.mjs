import fs from 'fs';

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

function jwtPayload(token) {
  try {
    const part = token.split('.')[1];
    return JSON.parse(
      Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
  } catch {
    return null;
  }
}

function refFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return null;
  }
}

const env = loadEnv('scratch/vercel-prod.env');
const url = env.NEXT_PUBLIC_SUPABASE_URL2 || env.NEXT_PUBLIC_SUPABASE_URL;
const urlRef = refFromUrl(url);
const svc = jwtPayload(env.SUPABASE_SERVICE_ROLE_KEY || '');
console.log('prod storage url ref:', urlRef);
console.log('prod URL:', env.NEXT_PUBLIC_SUPABASE_URL ? refFromUrl(env.NEXT_PUBLIC_SUPABASE_URL) : 'MISSING');
console.log('prod URL2:', env.NEXT_PUBLIC_SUPABASE_URL2 ? refFromUrl(env.NEXT_PUBLIC_SUPABASE_URL2) : 'MISSING');
console.log('prod SERVICE_ROLE ref:', svc?.ref || 'MISSING');
console.log('prod SERVICE_ROLE2:', env.SUPABASE_SERVICE_ROLE_KEY2 ? 'present' : 'MISSING');
console.log('MATCH:', urlRef && svc?.ref && urlRef === svc.ref ? 'YES' : 'NO');
console.log('API_PROXY_ALL:', env.API_PROXY_ALL || '(unset)');
