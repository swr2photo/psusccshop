import { API_ROUTES } from '../routes/registry.js';

type CompiledRoute = {
  pattern: string;
  module: string;
  regex: RegExp;
  keys: string[];
};

function compilePattern(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const parts = pattern.split('/').filter(Boolean);
  const regexParts = parts.map((segment) => {
    if (segment.startsWith(':')) {
      keys.push(segment.slice(1));
      return '([^/]+)';
    }
    if (segment.startsWith('*')) {
      keys.push(segment.slice(1) || 'path');
      return '(.+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { regex: new RegExp(`^/${regexParts.join('/')}$`), keys };
}

const compiled: CompiledRoute[] = API_ROUTES.map((route) => {
  const { regex, keys } = compilePattern(route.pattern);
  return { ...route, regex, keys };
});

/** Match /api/... path to a Next route module + params. */
export function resolveApiRoute(pathname: string): { module: string; params: Record<string, string> } | null {
  let normalized = pathname.replace(/^\/api/, '') || '/';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/$/, '') || '/';

  for (const route of compiled) {
    const match = normalized.match(route.regex);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1]);
    });
    return { module: route.module, params };
  }
  return null;
}
