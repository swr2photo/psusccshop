import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, customer_email, status, total_amount, created_at, slip_data')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('=== 10 Orders ล่าสุด ===\n');
  orders?.forEach((o, i) => {
    console.log(`${i+1}. ${o.id}`);
    console.log(`   ชื่อ: ${o.customer_name}`);
    console.log(`   Email: ${o.customer_email}`);
    console.log(`   สถานะ: ${o.status}`);
    console.log(`   ยอด: ${o.total_amount}`);
    console.log(`   วันที่: ${o.created_at}`);
    const transRef = o.slip_data?.transRef || o.slip_data?.slipData?.transRef || 'N/A';
    console.log(`   transRef: ${transRef}`);
    console.log('');
  });
}

findOrders();
