import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/auth';
import { sanitizeConfigForPublic, sanitizeObjectUtf8 } from '@/lib/sanitize';

// Helper to save user log server-side
const userLogKey = (id: string) => `user-logs/${id}.json`;
interface LogEntry {
  id: string;
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}
const saveUserLogServer = async (params: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) => {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: LogEntry = {
      id,
      email: params.email,
      name: params.name,
      action: params.action,
      details: params.details,
      metadata: params.metadata,
      ip: params.ip,
      userAgent: params.userAgent,
      timestamp: new Date().toISOString(),
    };
    await putJson(userLogKey(id), entry);
  } catch (e) {
    console.error('[Config] Failed to save user log:', e);
  }
};

const CONFIG_KEY = 'config/shop-settings.json';

const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  openDate: '',
  closedMessage: '',
  paymentEnabled: true,
  paymentDisabledMessage: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  // Keep factory sheet linkage in defaults so it never disappears when config is empty
  vendorSheetId: '',
  vendorSheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
};

export async function GET() {
  const cfg = (await getJson<ShopConfig>(CONFIG_KEY)) || DEFAULT_CONFIG;
  
  // Sanitize: ลบ adminEmails, adminPermissions, sheetId ก่อนส่งให้ frontend
  const sanitizedConfig = sanitizeConfigForPublic(cfg);
  
  return NextResponse.json(
    { status: 'success', data: sanitizedConfig },
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}

export async function POST(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin - เฉพาะ admin เท่านั้นที่แก้ config ได้
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const config = body?.config as ShopConfig | undefined;
    if (!config) return NextResponse.json({ status: 'error', message: 'missing config' }, { status: 400 });
    
    // Sanitize UTF-8 input ก่อนบันทึก
    const sanitizedConfig = sanitizeObjectUtf8(config);
    
    await putJson(CONFIG_KEY, sanitizedConfig);
    
    // Log config change
    const userAgent = req.headers.get('user-agent') || undefined;
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || undefined;
    
    // Detect what changed
    const changes: string[] = [];
    if (config.isOpen !== undefined) changes.push(config.isOpen ? 'เปิดร้าน' : 'ปิดร้าน');
    if (config.products?.length) changes.push(`สินค้า ${config.products.length} รายการ`);
    if (config.announcement?.enabled) changes.push('ประกาศ');
    if (config.bankAccount?.accountNumber) changes.push('บัญชีธนาคาร');
    
    await saveUserLogServer({
      email: authResult.email,
      name: undefined,
      action: 'admin_config_change',
      details: `แก้ไขการตั้งค่าร้าน${changes.length ? ': ' + changes.join(', ') : ''}`,
      metadata: {
        isOpen: config.isOpen,
        productCount: config.products?.length || 0,
        announcementEnabled: config.announcement?.enabled,
        paymentEnabled: config.paymentEnabled,
      },
      ip: clientIP,
      userAgent,
    });
    
    return NextResponse.json(
      { status: 'success', data: sanitizedConfig },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
