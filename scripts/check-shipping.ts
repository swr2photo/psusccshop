import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const ref = 'ORD-1769869995052';

  const { data, error } = await supabase
    .from('orders')
    .select('ref, total_amount, cart, shipping_option')
    .eq('ref', ref)
    .single();

  if (data) {
    console.log('Cart:', JSON.stringify(data.cart, null, 2));
  }
}

main();
