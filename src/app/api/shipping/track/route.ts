// src/app/api/shipping/track/route.ts
// Shipping tracking API endpoint via Track123 with Thailand Post fallback

import { NextRequest, NextResponse } from 'next/server';
import { 
  trackShipment,
  trackShipmentWithFallback,
  trackMultipleShipments,
  getTrackingUrl,
  getTrack123Url,
  ShippingProvider, 
  SHIPPING_PROVIDERS 
} from '@/lib/shipping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TrackRequest {
  provider?: ShippingProvider;
  trackingNumber?: string;
  trackingNumbers?: string[]; // For batch tracking
  courierCode?: string; // Optional Track123 courier code
  useFallback?: boolean; // Use Thailand Post fallback API
}

export async function POST(request: NextRequest) {
  try {
    const body: TrackRequest = await request.json();
    const { provider, trackingNumber, trackingNumbers, courierCode, useFallback = true } = body;

    // Batch tracking mode
    if (trackingNumbers && Array.isArray(trackingNumbers) && trackingNumbers.length > 0) {
      const cleanedNumbers = trackingNumbers.map(n => n.trim().toUpperCase());
      const results = await trackMultipleShipments(cleanedNumbers);
      
      return NextResponse.json({
        success: true,
        data: Object.fromEntries(results),
        count: results.size,
      });
    }

    // Single tracking mode
    if (!trackingNumber) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'กรุณาระบุเลขพัสดุ',
          errorCode: 'MISSING_PARAMS'
        },
        { status: 400 }
      );
    }

    // Validate provider if provided
    if (provider && !SHIPPING_PROVIDERS[provider]) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ไม่พบผู้ให้บริการขนส่งที่ระบุ',
          errorCode: 'INVALID_PROVIDER'
        },
        { status: 400 }
      );
    }

    // Clean tracking number
    const cleanedTrackingNumber = trackingNumber.trim().toUpperCase();

    // Track shipment - use fallback for Thailand Post if enabled
    const trackingInfo = useFallback
      ? await trackShipmentWithFallback(
          provider || 'custom', 
          cleanedTrackingNumber,
          courierCode
        )
      : await trackShipment(
          provider || 'custom', 
          cleanedTrackingNumber,
          courierCode
        );

    if (!trackingInfo) {
      // Provide fallback with tracking URLs
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
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: trackingInfo
    });

  } catch (error) {
    console.error('[API] Shipping track error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'เกิดข้อผิดพลาดในการติดตามพัสดุ',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as ShippingProvider | null;
    const trackingNumber = searchParams.get('tracking') || searchParams.get('trackingNumber');
    const courierCode = searchParams.get('courier') || searchParams.get('courierCode');

    // Validate input
    if (!trackingNumber) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'กรุณาระบุ tracking parameter',
          errorCode: 'MISSING_PARAMS'
        },
        { status: 400 }
      );
    }

    // Validate provider if provided
    if (provider && !SHIPPING_PROVIDERS[provider]) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ไม่พบผู้ให้บริการขนส่งที่ระบุ',
          errorCode: 'INVALID_PROVIDER'
        },
        { status: 400 }
      );
    }

    // Clean tracking number
    const cleanedTrackingNumber = trackingNumber.trim().toUpperCase();

    // Track shipment via Track123
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
          statusTextThai: 'กรุณาตรวจสอบที่เว็บไซต์ขนส่ง',
          trackingUrl,
          track123Url,
          events: [],
          lastUpdate: new Date().toISOString(),
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: trackingInfo
    });

  } catch (error) {
    console.error('[API] Shipping track GET error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'เกิดข้อผิดพลาดในการติดตามพัสดุ',
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
