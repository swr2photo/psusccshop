/** Allowed browser origins for split frontend/API deployment. */
export function getApiCorsOrigins(): string[] {
  const fromEnv = (process.env.API_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    'https://sccshop.psuscc.club',
    'https://www.sccshop.psuscc.club',
    'https://sccshop.psusci.club',
    'https://www.sccshop.psusci.club',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean) as string[];

  return [...new Set([...fromEnv, ...defaults])];
}

export function resolveApiPort(): number {
  return Number(process.env.PORT || process.env.API_PORT || 3001);
}
