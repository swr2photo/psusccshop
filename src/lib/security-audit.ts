// src/lib/security-audit.ts
// Security Audit Logging System
// บันทึกกิจกรรมที่เกี่ยวข้องกับความปลอดภัยทั้งหมด

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase';

// ==================== TYPES ====================

export type SecurityEventType =
  | 'auth_login'
  | 'auth_logout'
  | 'auth_failed'
  | 'auth_session_created'
  | 'auth_session_expired'
  | 'access_denied'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'ip_blocked'
  | 'ip_unblocked'
  | 'admin_action'
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'api_error'
  | 'security_scan_detected'
  | 'brute_force_detected'
  | 'csrf_violation'
  | 'xss_attempt'
  | 'injection_attempt'
  | 'file_upload'
  | 'payment_attempt'
  | 'payment_success'
  | 'payment_failed'
  | 'order_created'
  | 'order_modified'
  | 'config_changed';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ipAddress: string;
  ipHash: string;
  userAgent: string;
  userId?: string;
  userEmail?: string;
  emailHash?: string;
  requestPath: string;
  requestMethod: string;
  requestId?: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
}

// ==================== HELPERS ====================

function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

function maskIP(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.*${parts[3].slice(-1)}`;
  }
  return ip.substring(0, 8) + '***';
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.substring(0, 2) + '***';
  return `${maskedLocal}@${domain}`;
}

function generateLogId(): string {
  return `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// ==================== IN-MEMORY BUFFER ====================
// Buffer logs before writing to database for better performance

const logBuffer: SecurityAuditLog[] = [];
const BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

let flushTimeout: NodeJS.Timeout | null = null;

async function flushLogBuffer(): Promise<void> {
  if (logBuffer.length === 0) return;
  
  const logsToWrite = [...logBuffer];
  logBuffer.length = 0;
  
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      console.warn('[Security Audit] Database not available, logs lost:', logsToWrite.length);
      return;
    }
    
    const { error } = await db
      .from('security_audit_logs')
      .insert(logsToWrite.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        event_type: log.eventType,
        severity: log.severity,
        ip_address: log.ipAddress,
        ip_hash: log.ipHash,
        user_agent: log.userAgent,
        user_id: log.userId,
        user_email: log.userEmail,
        email_hash: log.emailHash,
        request_path: log.requestPath,
        request_method: log.requestMethod,
        request_id: log.requestId,
        details: log.details,
        metadata: log.metadata,
      })));
    
    if (error) {
      console.error('[Security Audit] Failed to write logs:', error);
      // Re-add logs to buffer on failure
      logBuffer.push(...logsToWrite);
    }
  } catch (error) {
    console.error('[Security Audit] Error flushing buffer:', error);
  }
}

function scheduleFlush(): void {
  if (flushTimeout) return;
  
  flushTimeout = setTimeout(async () => {
    flushTimeout = null;
    await flushLogBuffer();
  }, FLUSH_INTERVAL_MS);
}

// ==================== MAIN LOGGING FUNCTION ====================

export async function logSecurityEvent(
  eventType: SecurityEventType,
  options: {
    severity?: SecuritySeverity;
    ip?: string;
    userAgent?: string;
    userId?: string;
    userEmail?: string;
    requestPath?: string;
    requestMethod?: string;
    requestId?: string;
    details?: Record<string, any>;
    metadata?: Record<string, any>;
    immediate?: boolean; // Write immediately instead of buffering
  } = {}
): Promise<void> {
  const {
    severity = determineSeverity(eventType),
    ip = 'unknown',
    userAgent = 'unknown',
    userId,
    userEmail,
    requestPath = '/',
    requestMethod = 'GET',
    requestId,
    details = {},
    metadata,
    immediate = false,
  } = options;
  
  const log: SecurityAuditLog = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    eventType,
    severity,
    ipAddress: maskIP(ip),
    ipHash: hashSensitiveData(ip),
    userAgent: userAgent.substring(0, 500), // Limit UA length
    userId,
    userEmail: userEmail ? maskEmail(userEmail) : undefined,
    emailHash: userEmail ? hashSensitiveData(userEmail) : undefined,
    requestPath,
    requestMethod,
    requestId,
    details: sanitizeDetails(details),
    metadata,
  };
  
  // Console log for immediate visibility
  const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  console[logLevel](`[Security Audit] ${eventType}`, {
    severity,
    ip: log.ipAddress,
    path: requestPath,
    details: Object.keys(details),
  });
  
  // Write immediately for critical/high severity
  if (immediate || severity === 'critical' || severity === 'high') {
    try {
      const db = getSupabaseAdmin();
      if (db) {
        await db.from('security_audit_logs').insert({
          id: log.id,
          timestamp: log.timestamp,
          event_type: log.eventType,
          severity: log.severity,
          ip_address: log.ipAddress,
          ip_hash: log.ipHash,
          user_agent: log.userAgent,
          user_id: log.userId,
          user_email: log.userEmail,
          email_hash: log.emailHash,
          request_path: log.requestPath,
          request_method: log.requestMethod,
          request_id: log.requestId,
          details: log.details,
          metadata: log.metadata,
        });
      }
    } catch (error) {
      console.error('[Security Audit] Immediate write failed:', error);
    }
    return;
  }
  
  // Add to buffer
  logBuffer.push(log);
  
  // Flush if buffer is full
  if (logBuffer.length >= BUFFER_SIZE) {
    await flushLogBuffer();
  } else {
    scheduleFlush();
  }
}

// ==================== HELPER FUNCTIONS ====================

function determineSeverity(eventType: SecurityEventType): SecuritySeverity {
  switch (eventType) {
    case 'brute_force_detected':
    case 'security_scan_detected':
    case 'injection_attempt':
    case 'xss_attempt':
      return 'critical';
    
    case 'ip_blocked':
    case 'access_denied':
    case 'csrf_violation':
    case 'auth_failed':
    case 'suspicious_activity':
      return 'high';
    
    case 'rate_limit_exceeded':
    case 'payment_failed':
    case 'api_error':
      return 'medium';
    
    default:
      return 'low';
  }
}

function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'credit_card', 'cvv'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 1000) {
      sanitized[key] = value.substring(0, 1000) + '...[truncated]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ==================== QUERY FUNCTIONS ====================

export async function getSecurityLogs(options: {
  eventType?: SecurityEventType;
  severity?: SecuritySeverity;
  ipHash?: string;
  emailHash?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<SecurityAuditLog[]> {
  const {
    eventType,
    severity,
    ipHash,
    emailHash,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = options;
  
  try {
    const db = getSupabaseAdmin();
    if (!db) return [];
    
    let query = db
      .from('security_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (eventType) query = query.eq('event_type', eventType);
    if (severity) query = query.eq('severity', severity);
    if (ipHash) query = query.eq('ip_hash', ipHash);
    if (emailHash) query = query.eq('email_hash', emailHash);
    if (startDate) query = query.gte('timestamp', startDate.toISOString());
    if (endDate) query = query.lte('timestamp', endDate.toISOString());
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      severity: row.severity,
      ipAddress: row.ip_address,
      ipHash: row.ip_hash,
      userAgent: row.user_agent,
      userId: row.user_id,
      userEmail: row.user_email,
      emailHash: row.email_hash,
      requestPath: row.request_path,
      requestMethod: row.request_method,
      requestId: row.request_id,
      details: row.details,
      metadata: row.metadata,
    }));
  } catch (error) {
    console.error('[Security Audit] Query failed:', error);
    return [];
  }
}

export async function getSecurityStats(hours: number = 24): Promise<{
  totalEvents: number;
  bySeverity: Record<SecuritySeverity, number>;
  byType: Record<string, number>;
  topIPs: { ipHash: string; count: number }[];
}> {
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  const logs = await getSecurityLogs({ startDate, limit: 10000 });
  
  const stats = {
    totalEvents: logs.length,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<SecuritySeverity, number>,
    byType: {} as Record<string, number>,
    topIPs: [] as { ipHash: string; count: number }[],
  };
  
  const ipCounts = new Map<string, number>();
  
  for (const log of logs) {
    stats.bySeverity[log.severity]++;
    stats.byType[log.eventType] = (stats.byType[log.eventType] || 0) + 1;
    ipCounts.set(log.ipHash, (ipCounts.get(log.ipHash) || 0) + 1);
  }
  
  stats.topIPs = Array.from(ipCounts.entries())
    .map(([ipHash, count]) => ({ ipHash, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return stats;
}

// ==================== CLEANUP ====================

export async function cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return 0;
    
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const { data, error } = await db
      .from('security_audit_logs')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .select('id');
    
    if (error) throw error;
    
    return data?.length || 0;
  } catch (error) {
    console.error('[Security Audit] Cleanup failed:', error);
    return 0;
  }
}
