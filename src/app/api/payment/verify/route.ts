import { NextResponse } from 'next/server';
import { getSheets, getDrive } from 'lib/google'; // ตอนนี้ต้องเจอไฟล์นี้แล้ว
import { Readable } from 'stream';

export async function POST(req: Request) {
  try {
    const { ref, base64, mime } = await req.json();
    
    // 1. อัปโหลดลง Google Drive
    const drive = await getDrive();
    
    // แปลง Base64 เป็น Stream
    const buffer = Buffer.from(base64, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: `SLIP_${ref}_${Date.now()}.png`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!]
    };

    const media = {
      mimeType: mime || 'image/png',
      body: stream
    };

    const driveFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    const slipUrl = driveFile.data.webViewLink;

    // 2. ปรับสถานะใน Google Sheets
    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // อ่าน Header เพื่อหาตำแหน่งคอลัมน์
    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Orders!1:1' });
    const headers = headerRes.data.values?.[0] || [];
    const colIdx = (name: string) => headers.indexOf(name);

    // หา Row Index
    const range = 'Orders!A:B'; 
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    
    // 🔥 แก้ตรงนี้: ใส่ type (row: any)
    const rowIndex = rows.findIndex((row: any) => String(row[colIdx('Ref')]).trim() === ref);

    if (rowIndex !== -1) {
      // อัปเดต Status, SlipURL, VerifiedAt
      const statusCol = String.fromCharCode(65 + colIdx('Status'));
      const slipCol = String.fromCharCode(65 + colIdx('SlipURL'));
      const verifiedCol = String.fromCharCode(65 + colIdx('VerifiedAt'));

      // อัปเดตทีละเซลล์
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Orders!${statusCol}${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED', requestBody: { values: [['PAID']] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Orders!${slipCol}${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED', requestBody: { values: [[slipUrl]] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `Orders!${verifiedCol}${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED', requestBody: { values: [[new Date().toISOString()]] }
      });
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error("API Error:", error); // Log error ดูใน Terminal
    return NextResponse.json({ status: 'error', message: error.message });
  }
}