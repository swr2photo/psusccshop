import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder() {
  const orderId = '636c0698-0d71-4ba2-acb7-d986412eed39';
  
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('=== Order Detail ===');
  console.log('ID:', order.id);
  console.log('customer_name:', order.customer_name);
  console.log('\n=== slip_data ===');
  console.log('senderName:', order.slip_data?.senderName);
  console.log('senderFullName:', order.slip_data?.senderFullName);
  console.log('senderDisplayName:', order.slip_data?.senderDisplayName);
  console.log('receiverName:', order.slip_data?.receiverName);
  console.log('receiverDisplayName:', order.slip_data?.receiverDisplayName);
  console.log('transRef:', order.slip_data?.transRef);
  
  console.log('\n=== slip_data.slipData (nested) ===');
  const sd = order.slip_data?.slipData;
  console.log('senderName:', sd?.senderName);
  console.log('senderFullName:', sd?.senderFullName);
  console.log('senderDisplayName:', sd?.senderDisplayName);
  console.log('receiverName:', sd?.receiverName);
  console.log('receiverDisplayName:', sd?.receiverDisplayName);
}

checkOrder();
