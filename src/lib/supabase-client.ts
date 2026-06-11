import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function resolveSupabasePublicConfig() {
  return {
    url:
      process.env.NEXT_PUBLIC_SUPABASE_URL2 ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      '',
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2 ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY2 ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '',
  };
}

let _supabase: SupabaseClient | null = null;

function getSupabaseBrowser(): SupabaseClient {
  if (_supabase) return _supabase;
  let { url, anonKey } = resolveSupabasePublicConfig();
  if (!url || !anonKey) {
    if (process.env.WORKERS_CI === '1') {
      url = url || 'https://build-placeholder.supabase.co';
      anonKey = anonKey || 'build-placeholder-anon-key';
    } else {
      throw new Error('Supabase client is not configured (missing URL or anon key)');
    }
  }
  _supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      params: { eventsPerSecond: 2 },
    },
    global: {
      fetch(url, options = {}) {
        return fetch(url, { ...options, cache: 'no-store' as any });
      },
    },
  });
  return _supabase;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseBrowser();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
