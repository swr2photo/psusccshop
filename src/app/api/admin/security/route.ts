// src/app/api/admin/security/route.ts
// Security monitoring dashboard API for admins
// Provides security metrics, alerts, and threat analysis

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmailAsync } from '@/lib/auth';
import {
  getSecurityAuditLogs,
  getSecurityMetrics,
  getSecurityAlerts,
  checkActiveThreats,
  cleanupOldAuditLogs,
  AuditLogQuery,
} from '@/lib/security-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get security data (metrics, logs, alerts)
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const isAdmin = await isAdminEmailAsync(userEmail);
    if (!isAdmin) {
      return NextResponse.json(
        { status: 'error', message: 'Forbidden' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'metrics';
    
    switch (action) {
      case 'metrics': {
        // Get security metrics for dashboard
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        
        const metrics = await getSecurityMetrics(startDate, endDate);
        
        return NextResponse.json({
          status: 'success',
          metrics,
        });
      }
      
      case 'logs': {
        // Get security audit logs with filtering
        const query: AuditLogQuery = {};
        
        const eventTypes = searchParams.get('eventTypes');
        if (eventTypes) {
          query.eventTypes = eventTypes.split(',') as any[];
        }
        
        const severity = searchParams.get('severity');
        if (severity) {
          query.severity = severity.split(',') as any[];
        }
        
        query.startDate = searchParams.get('startDate') || undefined;
        query.endDate = searchParams.get('endDate') || undefined;
        query.ip = searchParams.get('ip') || undefined;
        query.userEmail = searchParams.get('userEmail') || undefined;
        query.limit = parseInt(searchParams.get('limit') || '100');
        query.offset = parseInt(searchParams.get('offset') || '0');
        
        const { logs, total } = await getSecurityAuditLogs(query);
        
        return NextResponse.json({
          status: 'success',
          logs,
          total,
          hasMore: query.offset! + logs.length < total,
        });
      }
      
      case 'alerts': {
        // Get recent security alerts
        const limit = parseInt(searchParams.get('limit') || '50');
        const alerts = await getSecurityAlerts(limit);
        
        return NextResponse.json({
          status: 'success',
          alerts,
        });
      }
      
      case 'threats': {
        // Check for active threats
        const threatStatus = await checkActiveThreats();
        
        return NextResponse.json({
          status: 'success',
          ...threatStatus,
        });
      }
      
      case 'summary': {
        // Get complete summary
        const [metrics, alerts, threatStatus] = await Promise.all([
          getSecurityMetrics(),
          getSecurityAlerts(10),
          checkActiveThreats(),
        ]);
        
        return NextResponse.json({
          status: 'success',
          metrics,
          recentAlerts: alerts,
          threatStatus,
        });
      }
      
      default:
        return NextResponse.json(
          { status: 'error', message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Security API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Perform security actions
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const isAdmin = await isAdminEmailAsync(userEmail);
    if (!isAdmin) {
      return NextResponse.json(
        { status: 'error', message: 'Forbidden' },
        { status: 403 }
      );
    }
    
    const { action, ...params } = await request.json();
    
    switch (action) {
      case 'cleanup': {
        // Clean up old audit logs
        const retentionDays = params.retentionDays || 90;
        const deletedCount = await cleanupOldAuditLogs();
        
        return NextResponse.json({
          status: 'success',
          message: `Cleaned up ${deletedCount} old logs`,
          deletedCount,
        });
      }
      
      case 'export': {
        // Export logs for compliance
        const query: AuditLogQuery = {
          startDate: params.startDate,
          endDate: params.endDate,
          severity: params.severity,
          limit: 10000, // Max export
        };
        
        const { logs, total } = await getSecurityAuditLogs(query);
        
        return NextResponse.json({
          status: 'success',
          logs,
          total,
          exportedAt: new Date().toISOString(),
        });
      }
      
      default:
        return NextResponse.json(
          { status: 'error', message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Security API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
