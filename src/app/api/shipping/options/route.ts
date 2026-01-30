// src/app/api/shipping/options/route.ts
// Shipping options configuration API

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ShippingConfig, DEFAULT_SHIPPING_CONFIG } from '@/lib/shipping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'shipping_config';

// GET - Retrieve shipping options
export async function GET(request: NextRequest) {
  try {
    // Use admin client for server-side read (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      // Return default config if admin client not available
      console.warn('[API] Supabase admin client not available, returning default config');
      return NextResponse.json({
        success: true,
        data: DEFAULT_SHIPPING_CONFIG
      });
    }

    // Get shipping config from database using admin client
    const { data, error } = await supabaseAdmin
      .from('config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .single();

    if (error || !data) {
      // Return default config if not found
      return NextResponse.json({
        success: true,
        data: DEFAULT_SHIPPING_CONFIG
      });
    }

    const config = data.value as ShippingConfig;

    // For public requests, only return enabled options
    const session = await getServerSession(authOptions);
    const isAdminUser = session?.user?.email ? isAdminEmail(session.user.email) : false;

    if (!isAdminUser) {
      const publicConfig: ShippingConfig = {
        ...config,
        options: config.options.filter(opt => opt.enabled),
      };
      return NextResponse.json({
        success: true,
        data: publicConfig
      });
    }

    return NextResponse.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('[API] Get shipping options error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get shipping options' },
      { status: 500 }
    );
  }
}

// POST - Update shipping options (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const newConfig: ShippingConfig = body.config;

    // Validate config
    if (!newConfig || !Array.isArray(newConfig.options)) {
      return NextResponse.json(
        { success: false, error: 'Invalid shipping config' },
        { status: 400 }
      );
    }

    // Use admin client for write operations (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('[API] Supabase admin client not available');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database configuration error',
          details: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Get it from Supabase Dashboard > Settings > API > service_role'
        },
        { status: 500 }
      );
    }

    // Upsert config using admin client
    const { error } = await supabaseAdmin
      .from('config')
      .upsert({
        key: CONFIG_KEY,
        value: newConfig,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('[API] Save shipping config error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save shipping config', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Shipping config updated successfully'
    });

  } catch (error) {
    console.error('[API] Update shipping options error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update shipping options' },
      { status: 500 }
    );
  }
}
