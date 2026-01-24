import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
console.log('Connecting to:', url?.slice(0, 40));

const db = createClient(url, key);
(async () => {
  const { data, error } = await db.from('orders').select('ref, status, slip_data').eq('status', 'PAID').limit(2);
  if (error) { console.error('Error:', error); return; }
  data?.forEach(o => {
    console.log('\n=== Order:', o.ref, '===');
    console.log('slip_data:', JSON.stringify(o.slip_data, null, 2));
  });
})();
