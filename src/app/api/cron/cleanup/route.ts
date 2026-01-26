// src/app/api/cron/cleanup/route.ts
// Cron job for data cleanup (PDPA compliance)

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldData, logSecurityEvent } from '@/lib/supabase';
import { cleanupExpiredRateLimits } from '@/lib/rate-limit-supabase';
import { autoRotateExpiringKeys, cleanupOldKeys } from '@/lib/api-key-rotation';
import { cleanupOldChatImages } from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Secret key for cron authentication
const CRON_SECRET = process.env.CRON_SECRET || 'psusccshop-cron-2026';

export async function GET(req: NextRequest) {
  // ตรวจสอบ authorization
  const authHeader = req.headers.get('authorization');
  const cronSecretFromHeader = authHeader?.replace('Bearer ', '');
  
  // รองรับทั้ง Vercel Cron และ manual call ด้วย secret
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const isValidSecret = cronSecretFromHeader === CRON_SECRET;
  
  if (!isVercelCron && !isValidSecret) {
    return NextResponse.json(
      { status: 'error', message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    status: 'success',
    timestamp: new Date().toISOString(),
    tasks: {},
  };

  try {
    console.log('[Cron Cleanup] Starting cleanup tasks...');

    // ==================== 1. CLEANUP OLD DATA ====================
    try {
      console.log('[Cron Cleanup] Cleaning old data (PDPA compliance)...');
      
      // Delete cancelled orders older than 1 year
      // Keep completed orders for 2 years
      const dataCleanup = await cleanupOldData(365);
      
      results.tasks.dataCleanup = {
        status: 'success',
        deletedOrders: dataCleanup.deletedOrders,
        deletedLogs: dataCleanup.deletedLogs,
        deletedAudit: dataCleanup.deletedAudit,
      };
      
      console.log(`[Cron Cleanup] Data cleanup: ${JSON.stringify(dataCleanup)}`);
    } catch (error) {
      console.error('[Cron Cleanup] Data cleanup error:', error);
      results.tasks.dataCleanup = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // ==================== 2. CLEANUP RATE LIMITS ====================
    try {
      console.log('[Cron Cleanup] Cleaning expired rate limits...');
      
      const deletedRateLimits = await cleanupExpiredRateLimits();
      
      results.tasks.rateLimits = {
        status: 'success',
        deleted: deletedRateLimits,
      };
      
      console.log(`[Cron Cleanup] Rate limits cleanup: ${deletedRateLimits} deleted`);
    } catch (error) {
      console.error('[Cron Cleanup] Rate limits cleanup error:', error);
      results.tasks.rateLimits = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // ==================== 3. AUTO-ROTATE EXPIRING API KEYS ====================
    try {
      console.log('[Cron Cleanup] Auto-rotating expiring API keys...');
      
      const rotatedKeys = await autoRotateExpiringKeys(3); // Keys expiring in 3 days
      
      results.tasks.apiKeyRotation = {
        status: 'success',
        rotated: rotatedKeys,
      };
      
      console.log(`[Cron Cleanup] API keys rotated: ${rotatedKeys}`);
    } catch (error) {
      console.error('[Cron Cleanup] API key rotation error:', error);
      results.tasks.apiKeyRotation = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // ==================== 4. CLEANUP OLD API KEYS ====================
    try {
      console.log('[Cron Cleanup] Cleaning old inactive API keys...');
      
      const deletedKeys = await cleanupOldKeys(90); // Keys inactive for 90 days
      
      results.tasks.apiKeyCleanup = {
        status: 'success',
        deleted: deletedKeys,
      };
      
      console.log(`[Cron Cleanup] Old API keys deleted: ${deletedKeys}`);
    } catch (error) {
      console.error('[Cron Cleanup] API key cleanup error:', error);
      results.tasks.apiKeyCleanup = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // ==================== 5. CLEANUP OLD CHAT IMAGES ====================
    try {
      console.log('[Cron Cleanup] Cleaning old chat images (7+ days)...');
      
      const chatImageCleanup = await cleanupOldChatImages(7); // Images older than 7 days
      
      results.tasks.chatImageCleanup = {
        status: 'success',
        deletedImages: chatImageCleanup.deletedImages,
        cleanedChats: chatImageCleanup.cleanedChats,
      };
      
      console.log(`[Cron Cleanup] Chat images cleanup: ${chatImageCleanup.deletedImages} images from ${chatImageCleanup.cleanedChats} chats`);
    } catch (error) {
      console.error('[Cron Cleanup] Chat image cleanup error:', error);
      results.tasks.chatImageCleanup = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // ==================== LOG COMPLETION ====================
    const duration = Date.now() - startTime;
    results.duration = `${duration}ms`;

    // Log to security audit
    await logSecurityEvent({
      eventType: 'cron_cleanup_completed',
      details: results,
    });

    console.log(`[Cron Cleanup] Completed in ${duration}ms`);
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('[Cron Cleanup] Fatal error:', error);
    
    // Log error to security audit
    await logSecurityEvent({
      eventType: 'cron_cleanup_failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
