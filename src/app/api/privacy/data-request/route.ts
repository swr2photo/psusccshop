// src/app/api/privacy/data-request/route.ts
// API for handling PDPA data subject rights requests

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getJson, putJson, listKeys, deleteObject } from '@/lib/filebase';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Types
type RequestType = 'access' | 'download' | 'delete' | 'rectification' | 'restriction' | 'objection';

interface DataRequest {
  id: string;
  email: string;
  type: RequestType;
  reason?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  notes?: string;
}

// Helper functions
const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const emailHash = (email: string) => {
  const normalized = normalizeEmail(email);
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const dataRequestKey = (id: string) => `data-requests/${id}.json`;

const userDataKey = (email: string) => `users/${emailHash(email)}.json`;

const orderIndexKey = (email: string) => `orders/index/${emailHash(email)}.json`;

/**
 * GET: Get user's data or data request status
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const userEmail = authResult.email;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'my-data';
  
  try {
    switch (action) {
      case 'my-data': {
        // Get all user's data (PDPA Access Right)
        const [profile, orderIndex] = await Promise.all([
          getJson<any>(userDataKey(userEmail)),
          getJson<any[]>(orderIndexKey(userEmail)),
        ]);
        
        // Get full order details
        const orders: any[] = [];
        if (orderIndex && orderIndex.length > 0) {
          for (const indexEntry of orderIndex) {
            if (indexEntry.key) {
              const order = await getJson<any>(indexEntry.key);
              if (order) {
                // Remove sensitive admin data
                const sanitizedOrder = {
                  ref: order.ref,
                  status: order.status,
                  totalAmount: order.totalAmount,
                  cart: order.cart,
                  createdAt: order.createdAt,
                  updatedAt: order.updatedAt,
                  customerName: order.customerName,
                  customerEmail: order.customerEmail,
                  customerPhone: order.customerPhone,
                  customerAddress: order.customerAddress,
                  customerInstagram: order.customerInstagram,
                };
                orders.push(sanitizedOrder);
              }
            }
          }
        }
        
        return NextResponse.json({
          status: 'success',
          data: {
            profile: profile || null,
            orders,
            exportedAt: new Date().toISOString(),
            email: userEmail,
          }
        });
      }
      
      case 'my-requests': {
        // Get user's data requests
        const keys = await listKeys('data-requests/');
        const requests: DataRequest[] = [];
        
        for (const key of keys) {
          const request = await getJson<DataRequest>(key);
          if (request && normalizeEmail(request.email) === normalizeEmail(userEmail)) {
            requests.push(request);
          }
        }
        
        // Sort by date desc
        requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return NextResponse.json({
          status: 'success',
          data: { requests }
        });
      }
      
      default:
        return NextResponse.json(
          { status: 'error', message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Privacy API] GET Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

/**
 * POST: Submit data request or process data deletion
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const userEmail = authResult.email;
  
  try {
    const body = await req.json();
    const { action, type, reason } = body;
    
    switch (action) {
      case 'request': {
        // Create a new data request
        if (!type || !['access', 'download', 'delete', 'rectification', 'restriction', 'objection'].includes(type)) {
          return NextResponse.json(
            { status: 'error', message: 'ประเภทคำขอไม่ถูกต้อง' },
            { status: 400 }
          );
        }
        
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const dataRequest: DataRequest = {
          id: requestId,
          email: userEmail,
          type: type as RequestType,
          reason: reason || undefined,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        
        await putJson(dataRequestKey(requestId), dataRequest);
        
        // Send confirmation email
        await sendEmail({
          to: userEmail,
          subject: `[SCC Shop] ได้รับคำขอใช้สิทธิ์ข้อมูลส่วนบุคคล #${requestId}`,
          html: generateRequestConfirmationEmail(dataRequest),
          type: 'custom',
        });
        
        // Notify admin
        await sendEmail({
          to: 'psuscc@psusci.club',
          subject: `[PDPA] คำขอใช้สิทธิ์ข้อมูลใหม่ - ${type} - ${userEmail}`,
          html: generateAdminNotificationEmail(dataRequest),
          type: 'custom',
        });
        
        return NextResponse.json({
          status: 'success',
          message: 'ส่งคำขอเรียบร้อยแล้ว เราจะดำเนินการภายใน 30 วัน',
          data: { requestId }
        });
      }
      
      case 'delete-my-data': {
        // Immediately delete profile data (Quick delete for non-order data)
        const profileKey = userDataKey(userEmail);
        const cartKey = `carts/${emailHash(userEmail)}.json`;
        
        await Promise.all([
          deleteObject(profileKey).catch(() => {}),
          deleteObject(cartKey).catch(() => {}),
        ]);
        
        // Create deletion record
        const requestId = `del-${Date.now()}`;
        const dataRequest: DataRequest = {
          id: requestId,
          email: userEmail,
          type: 'delete',
          status: 'completed',
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          notes: 'Auto-processed: Profile and cart data deleted',
        };
        
        await putJson(dataRequestKey(requestId), dataRequest);
        
        // Send confirmation
        await sendEmail({
          to: userEmail,
          subject: '[SCC Shop] ลบข้อมูลโปรไฟล์เรียบร้อยแล้ว',
          html: generateDeletionConfirmationEmail(userEmail),
          type: 'custom',
        });
        
        return NextResponse.json({
          status: 'success',
          message: 'ลบข้อมูลโปรไฟล์และตะกร้าเรียบร้อยแล้ว',
          data: {
            deletedItems: ['profile', 'cart'],
            note: 'ข้อมูลคำสั่งซื้อยังคงเก็บไว้ตามข้อกำหนดทางกฎหมาย (2 ปี)',
          }
        });
      }
      
      case 'download': {
        // Generate download data (PDPA Portability Right)
        const [profile, orderIndex] = await Promise.all([
          getJson<any>(userDataKey(userEmail)),
          getJson<any[]>(orderIndexKey(userEmail)),
        ]);
        
        const orders: any[] = [];
        if (orderIndex && orderIndex.length > 0) {
          for (const indexEntry of orderIndex) {
            if (indexEntry.key) {
              const order = await getJson<any>(indexEntry.key);
              if (order) {
                orders.push({
                  ref: order.ref,
                  status: order.status,
                  totalAmount: order.totalAmount,
                  cart: order.cart,
                  createdAt: order.createdAt,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  customerAddress: order.customerAddress,
                });
              }
            }
          }
        }
        
        const exportData = {
          exportInfo: {
            exportedAt: new Date().toISOString(),
            exportedFor: userEmail,
            format: 'JSON',
            version: '1.0',
          },
          profile: profile || null,
          orders,
        };
        
        // Log the export
        const requestId = `export-${Date.now()}`;
        await putJson(dataRequestKey(requestId), {
          id: requestId,
          email: userEmail,
          type: 'download',
          status: 'completed',
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        });
        
        return NextResponse.json({
          status: 'success',
          data: exportData,
        });
      }
      
      default:
        return NextResponse.json(
          { status: 'error', message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Privacy API] POST Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

// Email templates
function generateRequestConfirmationEmail(request: DataRequest): string {
  const typeLabels: Record<RequestType, string> = {
    access: 'ขอเข้าถึงข้อมูล',
    download: 'ขอรับสำเนาข้อมูล',
    delete: 'ขอลบข้อมูล',
    rectification: 'ขอแก้ไขข้อมูล',
    restriction: 'ขอระงับการใช้ข้อมูล',
    objection: 'คัดค้านการประมวลผลข้อมูล',
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1);">
          <div style="text-align:center;margin-bottom:30px;">
            <div style="width:64px;height:64px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:28px;">📋</span>
            </div>
          </div>
          
          <h1 style="color:#f1f5f9;font-size:24px;text-align:center;margin-bottom:10px;">
            ได้รับคำขอของท่านแล้ว
          </h1>
          
          <p style="color:#94a3b8;text-align:center;font-size:15px;line-height:1.6;margin-bottom:30px;">
            เราได้รับคำขอใช้สิทธิ์ข้อมูลส่วนบุคคลของท่านเรียบร้อยแล้ว
          </p>
          
          <div style="background:rgba(99,102,241,0.1);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(99,102,241,0.2);">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="color:#94a3b8;padding:8px 0;">หมายเลขคำขอ:</td>
                <td style="color:#f1f5f9;font-weight:600;text-align:right;">${request.id}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;padding:8px 0;">ประเภทคำขอ:</td>
                <td style="color:#a78bfa;font-weight:600;text-align:right;">${typeLabels[request.type]}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;padding:8px 0;">วันที่ยื่นคำขอ:</td>
                <td style="color:#f1f5f9;text-align:right;">${new Date(request.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="color:#94a3b8;padding:8px 0;">สถานะ:</td>
                <td style="color:#fbbf24;font-weight:600;text-align:right;">รอดำเนินการ</td>
              </tr>
            </table>
          </div>
          
          <div style="background:rgba(16,185,129,0.1);border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid rgba(16,185,129,0.2);">
            <p style="color:#6ee7b7;margin:0;font-size:14px;line-height:1.6;">
              ⏱️ เราจะดำเนินการตามคำขอของท่านภายใน <strong>30 วัน</strong> นับจากวันที่ได้รับคำขอ ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            </p>
          </div>
          
          <p style="color:#64748b;font-size:13px;text-align:center;margin-top:30px;">
            หากมีคำถามเพิ่มเติม กรุณาติดต่อ psuscc@psusci.club
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateAdminNotificationEmail(request: DataRequest): string {
  const typeLabels: Record<RequestType, string> = {
    access: 'ขอเข้าถึงข้อมูล',
    download: 'ขอรับสำเนาข้อมูล',
    delete: 'ขอลบข้อมูล',
    rectification: 'ขอแก้ไขข้อมูล',
    restriction: 'ขอระงับการใช้ข้อมูล',
    objection: 'คัดค้านการประมวลผลข้อมูล',
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:20px;background:#f8fafc;font-family:sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
        <h1 style="color:#dc2626;font-size:20px;margin-bottom:20px;">
          🔔 คำขอใช้สิทธิ์ PDPA ใหม่
        </h1>
        
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#64748b;">หมายเลขคำขอ:</td>
            <td style="padding:12px 0;font-weight:600;">${request.id}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#64748b;">อีเมลผู้ขอ:</td>
            <td style="padding:12px 0;font-weight:600;">${request.email}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#64748b;">ประเภทคำขอ:</td>
            <td style="padding:12px 0;font-weight:600;color:#dc2626;">${typeLabels[request.type]}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 0;color:#64748b;">วันที่ยื่น:</td>
            <td style="padding:12px 0;">${new Date(request.createdAt).toLocaleString('th-TH')}</td>
          </tr>
          ${request.reason ? `
          <tr>
            <td style="padding:12px 0;color:#64748b;">เหตุผล:</td>
            <td style="padding:12px 0;">${request.reason}</td>
          </tr>
          ` : ''}
        </table>
        
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
          <p style="color:#dc2626;margin:0;font-size:14px;">
            ⚠️ กรุณาดำเนินการภายใน 30 วัน ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateDeletionConfirmationEmail(email: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1);">
          <div style="text-align:center;margin-bottom:30px;">
            <div style="width:64px;height:64px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:28px;">✓</span>
            </div>
          </div>
          
          <h1 style="color:#f1f5f9;font-size:24px;text-align:center;margin-bottom:10px;">
            ลบข้อมูลเรียบร้อยแล้ว
          </h1>
          
          <p style="color:#94a3b8;text-align:center;font-size:15px;line-height:1.6;margin-bottom:30px;">
            เราได้ลบข้อมูลโปรไฟล์และตะกร้าสินค้าของท่านเรียบร้อยแล้ว
          </p>
          
          <div style="background:rgba(16,185,129,0.1);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(16,185,129,0.2);">
            <h3 style="color:#6ee7b7;margin:0 0 12px 0;font-size:16px;">ข้อมูลที่ถูกลบ:</h3>
            <ul style="color:#94a3b8;margin:0;padding-left:20px;line-height:1.8;">
              <li>ข้อมูลโปรไฟล์ (ชื่อ, เบอร์โทร, ที่อยู่)</li>
              <li>ตะกร้าสินค้า</li>
            </ul>
          </div>
          
          <div style="background:rgba(245,158,11,0.1);border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid rgba(245,158,11,0.2);">
            <p style="color:#fbbf24;margin:0;font-size:14px;line-height:1.6;">
              📋 <strong>หมายเหตุ:</strong> ข้อมูลคำสั่งซื้อยังคงเก็บไว้ตามข้อกำหนดทางกฎหมาย (2 ปี) เพื่อวัตถุประสงค์ทางบัญชีและการตรวจสอบ
            </p>
          </div>
          
          <p style="color:#64748b;font-size:13px;text-align:center;margin-top:30px;">
            ขอบคุณที่ใช้บริการ SCC Shop
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
