// src/lib/security-audit.ts
// Security Audit Logging System — Prisma
// บันทึกกิจกรรมที่เกี่ยวข้องกับความปลอดภัยทั้งหมด

import crypto from 'crypto';
import { prisma } from './prisma';

// ==================== TYPES ====================

export type SecurityEventType =
  | 'auth_login' | 'auth_logout' | 'auth_failed'
  | 'auth_session_created' | 'auth_session_expired'
  | 'access_denied' | 'rate_limit_exceeded'
  | 'suspicious_activity' | 'ip_blocked' | 'ip_unblocked'
  | 'admin_action' | 'data_access' | 'data_modification' | 'data_deletion'
  | 'api_error' | 'security_scan_detected' | 'brute_force_detected'
  | 'csrf_violation' | 'xss_attempt' | 'injection_attempt'
  | 'file_upload' | 'payment_attempt' | 'payment_success' | 'payment_failed'
  | 'order_created' | 'order_modified' | 'config_changed';

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
  blocked?: boolean;
  threatScore?: number;
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

const logBuffer: SecurityAuditLog[] = [];
const BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 30000;

let flushTimeout: NodeJS.Timeout | null = null;

function logToDbRow(log: SecurityAuditLog): any {
  return {
    event_type: log.eventType,
    user_email: log.userEmail,
    ip_address: log.ipAddress,
    user_agent: log.userAgent,
    details: {
      id: log.id,
      timestamp: log.timestamp,
      severity: log.severity,
      ipHash: log.ipHash,
      userId: log.userId,
      emailHash: log.emailHash,
      requestPath: log.requestPath,
      requestMethod: log.requestMethod,
      requestId: log.requestId,
      blocked: log.blocked,
      threatScore: log.threatScore,
      ...log.details,
      metadata: log.metadata,
    },
  };
}

function dbRowToLog(row: any): SecurityAuditLog {
  const d = (row.details as any) || {};
  return {
    id: d.id || row.id,
    timestamp: d.timestamp || row.created_at?.toISOString?.() || row.created_at,
    eventType: row.event_type as SecurityEventType,
    severity: (d.severity || 'low') as SecuritySeverity,
    ipAddress: row.ip_address || d.ipAddress || '',
    ipHash: d.ipHash || '',
    userAgent: row.user_agent || '',
    userId: d.userId,
    userEmail: row.user_email,
    emailHash: d.emailHash,
    requestPath: d.requestPath || '/',
    requestMethod: d.requestMethod || 'GET',
    requestId: d.requestId,
    blocked: d.blocked,
    threatScore: d.threatScore,
    details: d,
    metadata: d.metadata,
  };
}

async function flushLogBuffer(): Promise<void> {
  if (logBuffer.length === 0) return;
  
  const logsToWrite = [...logBuffer];
  logBuffer.length = 0;
  
  try {
    await prisma.securityAuditLog.createMany({
      data: logsToWrite.map(logToDbRow),
    });
  } catch (error) {
    console.error('[Security Audit] Failed to write logs:', error);
    logBuffer.push(...logsToWrite);
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
    blocked?: boolean;
    threatScore?: number;
    details?: Record<string, any>;
    metadata?: Record<string, any>;
    immediate?: boolean;
  } = {}
): Promise<void> {
  const {
    severity = determineSeverity(eventType),
    ip = 'unknown',
    userAgent = 'unknown',
    userId, userEmail,
    requestPath = '/',
    requestMethod = 'GET',
    requestId,
    blocked = false,
    threatScore,
    details = {},
    metadata,
    immediate = false,
  } = options;
  
  const log: SecurityAuditLog = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    eventType, severity,
    ipAddress: maskIP(ip),
    ipHash: hashSensitiveData(ip),
    userAgent: userAgent.substring(0, 500),
    userId,
    userEmail: userEmail ? maskEmail(userEmail) : undefined,
    emailHash: userEmail ? hashSensitiveData(userEmail) : undefined,
    requestPath, requestMethod, requestId,
    blocked, threatScore,
    details: sanitizeDetails(details),
    metadata,
  };
  
  const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  console[logLevel](`[Security Audit] ${eventType}`, {
    severity, ip: log.ipAddress, path: requestPath,
    details: Object.keys(details),
  });
  
  if (immediate || severity === 'critical' || severity === 'high') {
    try {
      await prisma.securityAuditLog.create({ data: logToDbRow(log) });
    } catch (error) {
      console.error('[Security Audit] Immediate write failed:', error);
    }
    return;
  }
  
  logBuffer.push(log);
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
  try {
    const where: any = {};
    if (options.eventType) where.event_type = options.eventType;
    if (options.startDate) where.created_at = { ...(where.created_at || {}), gte: options.startDate };
    if (options.endDate) where.created_at = { ...(where.created_at || {}), lte: options.endDate };
    
    const data = await prisma.securityAuditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: options.offset || 0,
      take: options.limit || 100,
    });
    
    let logs = data.map(dbRowToLog);
    
    // Filter by severity/ipHash/emailHash in memory (stored in details JSON)
    if (options.severity) logs = logs.filter(l => l.severity === options.severity);
    if (options.ipHash) logs = logs.filter(l => l.ipHash === options.ipHash);
    if (options.emailHash) logs = logs.filter(l => l.emailHash === options.emailHash);
    
    return logs;
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

// ==================== QUERY INTERFACE FOR API ====================

export interface AuditLogQuery {
  eventTypes?: SecurityEventType[];
  severity?: SecuritySeverity[];
  startDate?: string;
  endDate?: string;
  ip?: string;
  userEmail?: string;
  limit?: number;
  offset?: number;
}

export async function getSecurityAuditLogs(query: AuditLogQuery): Promise<{
  logs: SecurityAuditLog[];
  total: number;
}> {
  try {
    const where: any = {};
    if (query.eventTypes?.length) where.event_type = { in: query.eventTypes };
    if (query.startDate) where.created_at = { ...(where.created_at || {}), gte: new Date(query.startDate) };
    if (query.endDate) where.created_at = { ...(where.created_at || {}), lte: new Date(query.endDate) };
    if (query.userEmail) where.user_email = { contains: query.userEmail };
    
    const [data, total] = await Promise.all([
      prisma.securityAuditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: query.offset || 0,
        take: query.limit || 100,
      }),
      prisma.securityAuditLog.count({ where }),
    ]);
    
    let logs = data.map(dbRowToLog);
    
    // Filter by severity in memory (stored in details JSON)
    if (query.severity?.length) {
      logs = logs.filter(l => query.severity!.includes(l.severity));
    }
    if (query.ip) {
      const ipHash = hashSensitiveData(query.ip);
      logs = logs.filter(l => l.ipHash === ipHash);
    }
    
    return { logs, total };
  } catch (error) {
    console.error('[Security Audit] Query failed:', error);
    return { logs: [], total: 0 };
  }
}

export async function getSecurityMetrics(startDate?: string, endDate?: string): Promise<{
  totalEvents: number;
  bySeverity: Record<SecuritySeverity, number>;
  byType: Record<string, number>;
  topIPs: { ipHash: string; count: number }[];
  criticalCount: number;
  highCount: number;
  blockedCount: number;
}> {
  const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();
  
  const { logs } = await getSecurityAuditLogs({ startDate: start, endDate: end, limit: 10000 });
  
  const stats = {
    totalEvents: logs.length,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<SecuritySeverity, number>,
    byType: {} as Record<string, number>,
    topIPs: [] as { ipHash: string; count: number }[],
    criticalCount: 0, highCount: 0, blockedCount: 0,
  };
  
  const ipCounts = new Map<string, number>();
  for (const log of logs) {
    stats.bySeverity[log.severity]++;
    stats.byType[log.eventType] = (stats.byType[log.eventType] || 0) + 1;
    if (log.ipHash) ipCounts.set(log.ipHash, (ipCounts.get(log.ipHash) || 0) + 1);
    if (log.severity === 'critical') stats.criticalCount++;
    if (log.severity === 'high') stats.highCount++;
    if (log.details?.blocked) stats.blockedCount++;
  }
  
  stats.topIPs = Array.from(ipCounts.entries())
    .map(([ipHash, count]) => ({ ipHash, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return stats;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  details: Record<string, any>;
}

export async function getSecurityAlerts(limit: number = 50): Promise<SecurityAlert[]> {
  const { logs } = await getSecurityAuditLogs({ severity: ['critical', 'high'], limit });
  return logs.map(log => ({
    id: log.id,
    timestamp: log.timestamp,
    eventType: log.eventType,
    severity: log.severity,
    message: getAlertMessage(log),
    details: log.details,
  }));
}

function getAlertMessage(log: SecurityAuditLog): string {
  const messages: Record<string, string> = {
    brute_force_detected: `Brute force attack detected from IP ${log.ipHash?.substring(0, 8)}***`,
    injection_attempt: `SQL/NoSQL injection attempt blocked`,
    xss_attempt: `XSS attack attempt blocked`,
    csrf_violation: `CSRF violation detected`,
    security_scan_detected: `Security scanner activity detected`,
    access_denied: `Unauthorized access attempt to ${log.requestPath}`,
    rate_limit_exceeded: `Rate limit exceeded by ${log.ipHash?.substring(0, 8)}***`,
    suspicious_activity: `Suspicious activity detected`,
    auth_failed: `Authentication failed multiple times`,
  };
  return messages[log.eventType] || `Security event: ${log.eventType}`;
}

export async function checkActiveThreats(): Promise<{
  hasActiveThreats: boolean;
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  activeThreats: number;
  recentCritical: number;
  recentHigh: number;
}> {
  const startDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { logs } = await getSecurityAuditLogs({ startDate, severity: ['critical', 'high'], limit: 1000 });
  
  const criticalCount = logs.filter(l => l.severity === 'critical').length;
  const highCount = logs.filter(l => l.severity === 'high').length;
  
  let threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
  if (criticalCount >= 5) threatLevel = 'critical';
  else if (criticalCount >= 1 || highCount >= 10) threatLevel = 'high';
  else if (highCount >= 5) threatLevel = 'medium';
  else if (highCount >= 1) threatLevel = 'low';
  
  return {
    hasActiveThreats: criticalCount > 0 || highCount > 0,
    threatLevel,
    activeThreats: criticalCount + highCount,
    recentCritical: criticalCount,
    recentHigh: highCount,
  };
}

// ==================== CLEANUP ====================

export async function cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await prisma.securityAuditLog.deleteMany({
      where: { created_at: { lt: cutoffDate } },
    });
    return result.count;
  } catch (error) {
    console.error('[Security Audit] Cleanup failed:', error);
    return 0;
  }
}

export const cleanupOldAuditLogs = cleanupOldLogs;
