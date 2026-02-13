import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSlipData() {
  // Pass transRef as CLI argument: npx tsx scripts/fix-slip-data3.ts <transRef> <senderName> <receiverName>
  const transRef = process.argv[2];
  const correctSenderName = process.argv[3];
  const correctReceiverName = process.argv[4];

  if (!transRef || !correctSenderName || !correctReceiverName) {
    console.error('Usage: npx tsx scripts/fix-slip-data3.ts <transRef> <senderName> <receiverName>');
    process.exit(1);
  }
  
  // ค้นหา order โดยใช้ JSONB query
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('slip_data->>transRef', transRef);
  
  if (error) {
    console.error('Error finding by transRef:', error);
    // ลองหาแบบอื่น - ดึงทั้งหมดแล้ว filter
    const { data: allOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    const found = allOrders?.find(o => {
      const sd = o.slip_data;
      return sd?.transRef === transRef || sd?.slipData?.transRef === transRef;
    });
    
    if (found) {
      await fixOrder(found, correctSenderName, correctReceiverName);
    } else {
      console.log('ไม่พบ order ที่มี transRef:', transRef);
    }
    return;
  }
  
  if (!orders || orders.length === 0) {
    console.log('ไม่พบ order ที่มี transRef:', transRef);
    return;
  }
  
  await fixOrder(orders[0], correctSenderName, correctReceiverName);
}

async function fixOrder(order: any, correctSenderName: string, correctReceiverName: string) {
  console.log('พบ order:', order.id);
  console.log('ชื่อลูกค้าปัจจุบัน:', order.customer_name);
  
  // Parse slip_data
  let slipData = typeof order.slip_data === 'string' 
    ? JSON.parse(order.slip_data) 
    : order.slip_data;
  
  console.log('\n--- ข้อมูลก่อนแก้ไข ---');
  console.log('slip_data.senderName:', slipData?.senderName);
  console.log('slip_data.receiverName:', slipData?.receiverName);
  console.log('slipData.senderName:', slipData?.slipData?.senderName);
  console.log('slipData.receiverName:', slipData?.slipData?.receiverName);
  
  // แก้ไข slip_data ทุกระดับ
  if (slipData) {
    slipData.senderName = correctSenderName;
    slipData.receiverName = correctReceiverName;
    slipData.senderFullName = correctSenderName;
    slipData.receiverDisplayName = correctReceiverName;
    
    // แก้ไข nested slipData ด้วย
    if (slipData.slipData) {
      slipData.slipData.senderName = correctSenderName;
      slipData.slipData.receiverName = correctReceiverName;
      slipData.slipData.senderFullName = correctSenderName;
      slipData.slipData.receiverDisplayName = correctReceiverName;
    }
  }
  
  // อัพเดท database
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      customer_name: correctSenderName,
      slip_data: slipData
    })
    .eq('id', order.id);
  
  if (updateError) {
    console.error('Update error:', updateError);
    return;
  }
  
  console.log('\n✅ แก้ไข slip_data สำเร็จ!');
  console.log('ชื่อลูกค้า:', correctSenderName);
  console.log('ผู้โอน (sender):', correctSenderName);
  console.log('ผู้รับ (receiver):', correctReceiverName);
}

fixSlipData();
