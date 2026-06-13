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
  ].filter(Boolean) as string[];

  if (process.env.NODE_ENV !== 'production') {
    defaults.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  return [...new Set([...fromEnv, ...defaults])];
}

/** Whether a browser Origin may call credentialed API routes in production. */
export function isBrowserOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return false;
  }

  const allowed = getApiCorsOrigins();
  if (allowed.includes(origin)) return true;

  // Dev-only: Codespaces / preview hosts when not in production
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
    if (origin.endsWith('.app.github.dev')) return true;
  }

  return false;
}

export function resolveApiPort(): number {
  return Number(process.env.PORT || process.env.API_PORT || 3001);
}
