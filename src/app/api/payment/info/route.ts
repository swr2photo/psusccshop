import { NextResponse } from 'next/server';
import { getSheets } from '@/lib/google';
import { generatePromptPayQR, calculateOrderTotal } from '@/lib/payment-utils';

export async function POST(req: Request) {
  try {
    const { ref, discountCode } = await req.json();
    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // 1. อ่านข้อมูลจาก Sheet 'Orders'
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Orders!A:T' });
    const rows = response.data.values || [];
    const headers = rows[0].map((h: string) => h.trim());
    
    // Map Index คอลัมน์
    const colIdx = (name: string) => headers.indexOf(name);
    
    // 2. ค้นหา Order
    const rowIndex = rows.findIndex(row => String(row[colIdx('Ref')]).trim() === ref);
    if (rowIndex === -1) return NextResponse.json({ status: 'error', message: 'Order not found' });

    const rowData = rows[rowIndex];
    let items = [];
    try { items = JSON.parse(rowData[colIdx('Items')] || '[]'); } catch (e) {}

    // 3. คำนวณราคา
    let baseAmount = calculateOrderTotal(items);
    if (baseAmount === 0 && colIdx('Amount') > -1) baseAmount = Number(rowData[colIdx('Amount')] || 0);

    const shippingFee = 0; // บังคับ 0
    let discount = 0;

    // 4. Logic ส่วนลด
    if (discountCode) {
      const code = discountCode.toUpperCase();
      if (code === 'WELCOME') discount = 50;
      else if (code === 'CS10') discount = Math.floor(baseAmount * 0.1);
      else if (code === 'FREESHIP') discount = 50;
      
      // บันทึกส่วนลดกลับลง Sheet
      if (colIdx('Discount') !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Orders!${String.fromCharCode(65 + colIdx('Discount'))}${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[discount]] }
        });
      }
      if (colIdx('DiscountCode') !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Orders!${String.fromCharCode(65 + colIdx('DiscountCode'))}${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[code]] }
        });
      }
    } else {
      // ถ้าไม่ส่งโค้ดมา ให้ใช้ discount เดิมใน sheet
      discount = colIdx('Discount') > -1 ? Number(rowData[colIdx('Discount')] || 0) : 0;
    }

    const finalAmount = Math.max(0, baseAmount + shippingFee - discount);
    const qrUrl = generatePromptPayQR(finalAmount);

    return NextResponse.json({
      status: 'success',
      qrUrl, finalAmount, baseAmount, shippingFee, discount
    });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message });
  }
}