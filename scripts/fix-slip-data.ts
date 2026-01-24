import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. ดึงข้อมูล order ปัจจุบัน
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('ref', 'ORD-1769255888964')
    .single();

  if (fetchError || !order) {
    console.error('Error fetching order:', fetchError?.message);
    process.exit(1);
  }

  console.log('Current order:', order.ref);
  console.log('Current customer_name:', order.customer_name);
  console.log('Current slip_data:', JSON.stringify(order.slip_data, null, 2));

  // 2. แก้ไขข้อมูล - สลับ sender/receiver ให้ถูกต้อง
  const correctedSlipData = {
    ...order.slip_data,
    // ผู้โอน (sender) = Mr. Justin M
    senderName: 'Mr. Justin M',
    senderFullName: '',
    senderDisplayName: 'Mr. Justin M',
    senderBank: 'KBANK',
    // ผู้รับ (receiver) = วีรชาติ แก้วขำ (บัญชีร้านค้า)
    receiverName: 'วีรชาติ แก้วขำ',
    receiverDisplayName: 'วีรชาติ แก้วขำ',
  };

  // 3. อัปเดต order
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ 
      customer_name: 'Mr. Justin M',
      slip_data: correctedSlipData
    })
    .eq('ref', 'ORD-1769255888964')
    .select('ref, customer_name, slip_data');

  if (updateError) {
    console.error('Error updating:', updateError.message);
    process.exit(1);
  }

  console.log('\n✅ แก้ไขสำเร็จ!');
  console.log('New customer_name:', updated[0]?.customer_name);
  console.log('New slip_data:', JSON.stringify(updated[0]?.slip_data, null, 2));
  process.exit(0);
}

main();
