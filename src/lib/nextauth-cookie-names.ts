function getEnvValue(key: string): string | undefined {
  // Try globalThis.__CF_ENV__ first (Cloudflare Workers env bindings)
  const cfEnv = (globalThis as any).__CF_ENV__;
  if (cfEnv && typeof cfEnv === 'object' && key in cfEnv) {
    return String(cfEnv[key]);
  }
  // Fallback to process.env
  return process.env[key];
}

function resolveUseSecureCookies(): boolean {
  return getEnvValue('NODE_ENV') === 'production';
}

function resolveCookiePrefix(): string {
  return resolveUseSecureCookies() ? '__Secure-' : '';
}

function resolveAuthSessionVersion(): string {
  const explicit = getEnvValue('AUTH_SESSION_VERSION');
  if (explicit) return explicit.trim();
  return resolveUseSecureCookies() ? '2' : '1';
}

function versionSuffix(version: string): string {
  return version && version !== '1' ? `.v${version}` : '';
}

export function getNextAuthSessionCookieName(version?: string): string {
  const resolvedVersion = version || resolveAuthSessionVersion();
  const prefix = resolveCookiePrefix();
  return `${prefix}next-auth.session-token${versionSuffix(resolvedVersion)}`;
}

export function getNextAuthCallbackCookieName(version?: string): string {
  const resolvedVersion = version || resolveAuthSessionVersion();
  const prefix = resolveCookiePrefix();
  return `${prefix}next-auth.callback-url${versionSuffix(resolvedVersion)}`;
}

export function getAllSessionCookieNames(): string[] {
  const prefix = resolveCookiePrefix();
  const names = new Set<string>([
    getNextAuthSessionCookieName('2'),
    getNextAuthSessionCookieName('1'),
    `${prefix}next-auth.session-token`,
    'next-auth.session-token',
  ]);
  return [...names];
}

export function getAllCallbackCookieNames(): string[] {
  const prefix = resolveCookiePrefix();
  const names = new Set<string>([
    getNextAuthCallbackCookieName('2'),
    getNextAuthCallbackCookieName('1'),
    `${prefix}next-auth.callback-url`,
    'next-auth.callback-url',
  ]);
  return [...names];
}

export function getSessionCookieNamesForRead(): string[] {
  const prefix = resolveCookiePrefix();
  return [
    getNextAuthSessionCookieName('2'),
    getNextAuthSessionCookieName('1'),
    `${prefix}next-auth.session-token`,
    'next-auth.session-token',
  ];
}

export function getNextAuthCsrfCookieName(): string {
  return resolveUseSecureCookies() ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token';
}
