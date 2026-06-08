import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2 || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2 || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY2 || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
