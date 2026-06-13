import { NextRequest, NextResponse } from 'next/server';
import {
  trackShipment,
  trackShipmentWithFallback,
  trackMultipleShipments,
  getTrackingUrl,
  getTrack123Url,
  ShippingProvider,
  SHIPPING_PROVIDERS,
} from '@/lib/shipping';
import { isAdminEmailAsync } from '@/lib/auth';
import { userOwnsTrackingNumber } from '@/lib/order-lookup';
import { rateLimitOrNull } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireSession() {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session;
}

async function assertTrackingAccess(email: string, trackingNumber: string): Promise<NextResponse | null> {
  const isAdmin = await isAdminEmailAsync(email);
  const allowed = await userOwnsTrackingNumber(email, trackingNumber, isAdmin);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'ไม่มีสิทธิ์ติดตามพัสดุนี้', errorCode: 'FORBIDDEN' },
      { status: 403 }
    );
  }
  return null;
}

interface TrackRequest {
  provider?: ShippingProvider;
  trackingNumber?: string;
  trackingNumbers?: string[];
  courierCode?: string;
  useFallback?: boolean;
}

export async function POST(request: NextRequest) {
  const rateLimited = await rateLimitOrNull(request, { maxRequests: 30, windowSeconds: 60, prefix: 'ship-track' });
  if (rateLimited) return rateLimited;

  const session = await requireSession();
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const body: TrackRequest = await request.json();
    const { provider, trackingNumber, trackingNumbers, courierCode, useFallback = true } = body;
    const isAdmin = await isAdminEmailAsync(session.user.email);

    if (trackingNumbers && Array.isArray(trackingNumbers) && trackingNumbers.length > 0) {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Batch tracking requires admin', errorCode: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      const cleanedNumbers = trackingNumbers.map((n) => n.trim().toUpperCase());
      const results = await trackMultipleShipments(cleanedNumbers);
      return NextResponse.json({
        success: true,
        data: Object.fromEntries(results),
        count: results.size,
      });
    }

    if (!trackingNumber) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุเลขพัสดุ', errorCode: 'MISSING_PARAMS' },
        { status: 400 }
      );
    }

    if (provider && !SHIPPING_PROVIDERS[provider]) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ให้บริการขนส่งที่ระบุ', errorCode: 'INVALID_PROVIDER' },
        { status: 400 }
      );
    }

    const cleanedTrackingNumber = trackingNumber.trim().toUpperCase();
    const denied = await assertTrackingAccess(session.user.email, cleanedTrackingNumber);
    if (denied) return denied;

    const trackingInfo = useFallback
      ? await trackShipmentWithFallback(provider || 'custom', cleanedTrackingNumber, courierCode)
      : await trackShipment(provider || 'custom', cleanedTrackingNumber, courierCode);

    if (!trackingInfo) {
      const trackingUrl = provider ? getTrackingUrl(provider, cleanedTrackingNumber) : '';
      const track123Url = getTrack123Url(cleanedTrackingNumber);
      return NextResponse.json({
        success: true,
        data: {
          provider: provider || 'custom',
          trackingNumber: cleanedTrackingNumber,
          status: 'unknown',
          statusText: 'ไม่สามารถดึงข้อมูลได้',
          statusTextThai: 'กรุณาตรวจสอบที่เว็บไซต์ขนส่ง',
          trackingUrl,
          track123Url,
          events: [],
          lastUpdate: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, data: trackingInfo });
  } catch (error) {
    console.error('[API] Shipping track error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการติดตามพัสดุ', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const rateLimited = await rateLimitOrNull(request, { maxRequests: 30, windowSeconds: 60, prefix: 'ship-track' });
  if (rateLimited) return rateLimited;

  const session = await requireSession();
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as ShippingProvider | null;
    const trackingNumber = searchParams.get('tracking') || searchParams.get('trackingNumber');
    const courierCode = searchParams.get('courier') || searchParams.get('courierCode');

    if (!trackingNumber) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ tracking parameter', errorCode: 'MISSING_PARAMS' },
        { status: 400 }
      );
    }

    if (provider && !SHIPPING_PROVIDERS[provider]) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ให้บริการขนส่งที่ระบุ', errorCode: 'INVALID_PROVIDER' },
        { status: 400 }
      );
    }

    const cleanedTrackingNumber = trackingNumber.trim().toUpperCase();
    const denied = await assertTrackingAccess(session.user.email, cleanedTrackingNumber);
    if (denied) return denied;

    const trackingInfo = await trackShipment(
      provider || 'custom',
      cleanedTrackingNumber,
      courierCode || undefined
    );

    const trackingUrl = provider ? getTrackingUrl(provider, cleanedTrackingNumber) : '';
    const track123Url = getTrack123Url(cleanedTrackingNumber);

    if (!trackingInfo) {
      return NextResponse.json({
        success: true,
        data: {
          provider: provider || 'custom',
          trackingNumber: cleanedTrackingNumber,
          status: 'unknown',
          statusText: 'ไม่สามารถดึงข้อมูลได้',
          statusTextThai: 'กรุณาติดต่อเว็บไซต์ขนส่ง',
          trackingUrl,
          track123Url,
          events: [],
          lastUpdate: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, data: trackingInfo });
  } catch (error) {
    console.error('[API] Shipping track GET error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการติดตามพัสดุ', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
