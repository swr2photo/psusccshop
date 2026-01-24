import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // ดึง order ปัจจุบัน
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('slip_data')
    .eq('ref', 'ORD-1769255888964')
    .single();

  if (fetchError || !order) {
    console.error('Error:', fetchError?.message);
    process.exit(1);
  }

  // แก้ไขทุก level ให้ถูกต้อง
  const correctedSlipData = {
    ...order.slip_data,
    // Level 1 - แก้ไขให้ถูกต้อง
    senderName: 'Mr. Justin M',
    senderFullName: '',
    senderDisplayName: 'Mr. Justin M',
    senderBank: 'KBANK',
    receiverName: 'วีรชาติ แก้วขำ',
    receiverDisplayName: 'วีรชาติ แก้วขำ',
    // Level 2 (slipData ที่ซ้อนอยู่) - แก้ไขให้ถูกต้อง
    slipData: {
      ...order.slip_data.slipData,
      senderName: 'Mr. Justin M',
      senderBank: 'KBANK',
      receiverName: 'วีรชาติ แก้วขำ',
    }
  };

  // อัปเดต
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ slip_data: correctedSlipData })
    .eq('ref', 'ORD-1769255888964')
    .select('ref, slip_data');

  if (updateError) {
    console.error('Error:', updateError.message);
    process.exit(1);
  }

  console.log('✅ แก้ไข slip_data สำเร็จ!');
  console.log('ผู้โอน (sender):', updated[0]?.slip_data?.senderName);
  console.log('ผู้รับ (receiver):', updated[0]?.slip_data?.receiverName);
  console.log('slipData.senderName:', updated[0]?.slip_data?.slipData?.senderName);
  console.log('slipData.receiverName:', updated[0]?.slip_data?.slipData?.receiverName);
  process.exit(0);
}

main();
