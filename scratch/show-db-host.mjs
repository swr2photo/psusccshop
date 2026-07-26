import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

for (const k of ['DATABASE_URL', 'DATABASE_URL2']) {
  const raw = env[k];
  if (!raw) {
    console.log(k, 'missing');
    continue;
  }
  try {
    const u = new URL(raw);
    console.log(k, { host: u.hostname, port: u.port || '5432', db: u.pathname });
  } catch (e) {
    console.log(k, 'invalid');
  }
}
