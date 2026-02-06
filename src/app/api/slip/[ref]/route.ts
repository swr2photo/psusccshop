import { NextRequest, NextResponse } from 'next/server';
import { getJson, listKeys } from '@/lib/filebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdminEmail } from '@/lib/auth';

const findOrderKey = async (ref: string): Promise<string | null> => {
  const keys = await listKeys('orders/');
  return keys.find((k) => k.endsWith(`${ref}.json`)) || null;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    if (!userEmail || !isAdminEmail(userEmail)) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head><title>ไม่มีสิทธิ์เข้าถึง</title><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1e293b; color: #94a3b8;">
          <div style="text-align: center;">
            <h1 style="color: #ef4444;">ไม่มีสิทธิ์เข้าถึง</h1>
            <p>เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถดูสลิปได้</p>
            <a href="/admin" style="color: #2563eb; text-decoration: none;">เข้าสู่ระบบแอดมิน</a>
          </div>
        </body>
        </html>`,
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const { ref } = await params;
    
    if (!ref) {
      return NextResponse.json({ status: 'error', message: 'missing ref' }, { status: 400 });
    }

    const key = await findOrderKey(ref);
    if (!key) {
      return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });
    }

    const order = await getJson<any>(key);
    if (!order) {
      return NextResponse.json({ status: 'error', message: 'order data missing' }, { status: 404 });
    }

    // Support both 'slip' and 'slipData' field names (backward compatibility)
    const slip = order?.slip || order?.slipData;
    // Support both imageUrl (from SlipOK S3) and base64
    const hasSlipImage = slip && (slip.imageUrl || slip.base64);
    if (!hasSlipImage) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head><title>ไม่พบสลิป</title><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1e293b; color: #94a3b8;">
          <div style="text-align: center;">
            <h1 style="color: #f59e0b;">ไม่พบสลิป</h1>
            <p>ออเดอร์ #${ref} ยังไม่มีการอัพโหลดสลิป</p>
          </div>
        </body>
        </html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Build the image source - prefer imageUrl from SlipOK, fallback to base64
    let imageSrc: string;
    if (slip.imageUrl) {
      // Use SlipOK S3 URL directly
      imageSrc = slip.imageUrl;
    } else {
      // Fallback to base64
      const mime = slip.mime || 'image/png';
      imageSrc = slip.base64.startsWith('data:') 
        ? slip.base64 
        : `data:${mime};base64,${slip.base64}`;
    }
    
    const uploadedAt = slip.uploadedAt ? new Date(slip.uploadedAt).toLocaleString('th-TH') : '-';
    // Support both 'slipCheck.success' (old format) and 'verified' (new format)
    const isVerified = slip.verified === true || slip.slipCheck?.success === true;
    const verified = isVerified ? 'ผ่านการตรวจสอบ' : 'รอตรวจสอบ';
    // Support both 'slipCheck.data' (old format) and 'slipData' (new format from SlipOK)
    const slipData = slip.slipData || slip.slipCheck?.data;
    
    // Return HTML page with slip image
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>สลิป #${ref}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      color: #e2e8f0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .header {
      background: rgba(37, 99, 235, 0.1);
      border: 1px solid rgba(37, 99, 235, 0.3);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 1.5rem;
      color: #93c5fd;
    }
    .header .ref {
      font-family: monospace;
      font-size: 1.1rem;
      color: #f1f5f9;
      background: rgba(255,255,255,0.1);
      padding: 4px 12px;
      border-radius: 8px;
      display: inline-block;
    }
    .info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    .info-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .info-card .label {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 4px;
    }
    .info-card .value {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .verified { color: #10b981; }
    .pending { color: #f59e0b; }
    .slip-container {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 16px;
      text-align: center;
    }
    .slip-image {
      max-width: 100%;
      max-height: 70vh;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .slip-data {
      margin-top: 20px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 12px;
      padding: 16px;
      text-align: left;
    }
    .slip-data h3 {
      margin: 0 0 12px 0;
      color: #10b981;
      font-size: 1rem;
    }
    .slip-data .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .slip-data .row:last-child {
      border-bottom: none;
    }
    .slip-data .row .label {
      color: #64748b;
    }
    .slip-data .row .value {
      font-weight: 600;
      color: #f1f5f9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>สลิปการโอนเงิน</h1>
      <span class="ref">#${ref}</span>
    </div>
    
    <div class="info">
      <div class="info-card">
        <div class="label">วันที่อัพโหลด</div>
        <div class="value">${uploadedAt}</div>
      </div>
      <div class="info-card">
        <div class="label">สถานะ</div>
        <div class="value ${isVerified ? 'verified' : 'pending'}">${verified}</div>
      </div>
    </div>
    
    <div class="slip-container">
      <img src="${imageSrc}" alt="สลิปโอนเงิน" class="slip-image" />
    </div>
    
    ${slipData ? `
    <div class="slip-data">
      <h3>ข้อมูลจากสลิป</h3>
      ${slipData.sendingBank || slipData.senderBank ? `<div class="row"><span class="label">ธนาคารผู้โอน</span><span class="value">${slipData.sendingBank || slipData.senderBank}</span></div>` : ''}
      ${slipData.receivingBank || slipData.receiverBank ? `<div class="row"><span class="label">ธนาคารผู้รับ</span><span class="value">${slipData.receivingBank || slipData.receiverBank}</span></div>` : ''}
      ${slipData.sender?.displayName || slipData.senderName ? `<div class="row"><span class="label">ชื่อผู้โอน</span><span class="value">${slipData.sender?.displayName || slipData.senderName}</span></div>` : ''}
      ${slipData.receiver?.displayName || slipData.receiverName ? `<div class="row"><span class="label">ชื่อผู้รับ</span><span class="value">${slipData.receiver?.displayName || slipData.receiverName}</span></div>` : ''}
      ${slipData.amount ? `<div class="row"><span class="label">จำนวนเงิน</span><span class="value">฿${Number(slipData.amount).toLocaleString()}</span></div>` : ''}
      ${slipData.transDate ? `<div class="row"><span class="label">วันที่โอน</span><span class="value">${slipData.transDate}</span></div>` : ''}
      ${slipData.transTime ? `<div class="row"><span class="label">เวลา</span><span class="value">${slipData.transTime}</span></div>` : ''}
      ${slipData.transRef ? `<div class="row"><span class="label">เลขอ้างอิง</span><span class="value">${slipData.transRef}</span></div>` : ''}
    </div>
    ` : ''}
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[slip] error', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'failed to get slip' },
      { status: 500 }
    );
  }
}
