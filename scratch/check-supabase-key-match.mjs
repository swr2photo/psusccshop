import fs from 'fs';

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function jwtPayload(token) {
  try {
    const part = token.split('.')[1];
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname; // xxx.supabase.co
    return host.split('.')[0];
  } catch {
    return null;
  }
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const urls = {
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL2: env.NEXT_PUBLIC_SUPABASE_URL2,
};
const keys = {
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY2: env.NEXT_PUBLIC_SUPABASE_ANON_KEY2,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2,
};

console.log('--- URLs ---');
for (const [k, v] of Object.entries(urls)) {
  console.log(k, v ? `${projectRefFromUrl(v)} (${v.slice(0, 28)}...)` : 'MISSING');
}

console.log('--- Keys (JWT ref/role) ---');
for (const [k, v] of Object.entries(keys)) {
  if (!v) {
    console.log(k, 'MISSING');
    continue;
  }
  if (v.startsWith('eyJ')) {
    const p = jwtPayload(v);
    console.log(k, p ? `ref=${p.ref || '?'} role=${p.role || '?'} iss=${p.iss || '?'}` : 'bad jwt');
  } else {
    console.log(k, `format=${v.slice(0, 14)}... (not JWT)`);
  }
}

const resolvedUrl = env.NEXT_PUBLIC_SUPABASE_URL2 || env.NEXT_PUBLIC_SUPABASE_URL;
const resolvedRef = projectRefFromUrl(resolvedUrl);
const servicePayload = jwtPayload(env.SUPABASE_SERVICE_ROLE_KEY || '');
console.log('\n--- Match check ---');
console.log('resolved storage URL ref:', resolvedRef);
console.log('service role JWT ref:', servicePayload?.ref);
console.log(
  'MATCH:',
  resolvedRef && servicePayload?.ref && resolvedRef === servicePayload.ref ? 'YES' : 'NO',
);
