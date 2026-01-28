# Security Enhancement Documentation

## Overview

This document describes the maximum security enhancements implemented for the PSU SCC Shop application.

## Security Modules

### 1. Advanced Security (`src/lib/advanced-security.ts`)

**Features:**
- **Request Fingerprinting**: Creates unique device fingerprints based on IP, User-Agent, and browser characteristics
- **Brute Force Protection**: Exponential backoff lockouts after failed attempts (5 attempts → 1min lock, escalating to 1hr max)
- **Threat Detection**: Real-time analysis of requests for malicious patterns
- **IP Reputation**: Tracking and scoring of IP addresses based on behavior
- **Nonce Validation**: Prevents replay attacks
- **Request Signing**: HMAC signatures for request integrity

**Usage:**
```typescript
import { 
  performSecurityAnalysis, 
  recordFailedAttempt,
  isLockedOut 
} from '@/lib/advanced-security';

// Analyze a request
const analysis = performSecurityAnalysis(request, body);
if (analysis.threatScore.score >= 60) {
  // Block the request
}

// Handle failed login
const lockout = recordFailedAttempt(clientIP);
if (lockout.isLocked) {
  // Return 429 error
}
```

### 2. Security Audit (`src/lib/security-audit.ts`)

**Features:**
- **Event Logging**: Comprehensive security event logging to Supabase
- **Batch Processing**: Events are batched for performance (critical events logged immediately)
- **Privacy-Preserving**: IP and email addresses are hashed
- **Metrics Dashboard**: Aggregated security metrics and analytics
- **Alert System**: Detection of active threats

**Event Types:**
- `auth_success`, `auth_failed`, `auth_logout`
- `access_denied`, `rate_limit_exceeded`
- `brute_force_detected`, `suspicious_activity`
- `injection_attempt`, `xss_attempt`
- `csrf_violation`, `session_hijack_attempt`
- `payment_attempt`, `payment_success`, `payment_failed`
- `admin_action`, `config_change`

**Usage:**
```typescript
import { logSecurityEvent, getSecurityMetrics } from '@/lib/security-audit';

// Log an event
await logSecurityEvent('suspicious_activity', {
  ip: clientIP,
  userAgent,
  requestPath: '/api/orders',
  threatScore: 75,
  blocked: true,
});

// Get metrics for dashboard
const metrics = await getSecurityMetrics('2024-01-01', '2024-01-31');
```

### 3. Secure Middleware (`src/lib/secure-middleware.ts`)

**Features:**
- **Unified Security Wrapper**: Combines all security checks in one middleware
- **Preset Configurations**: Pre-configured wrappers for different API types
- **Automatic Sanitization**: Input sanitization enabled by default
- **Audit Trail**: Automatic logging of API access

**Preset Wrappers:**
```typescript
import { 
  withPublicAPI,      // No auth, standard rate limiting
  withAuthenticatedAPI, // Requires login
  withAdminAPI,       // Admin only, audit logged
  withPaymentAPI,     // Maximum security with Turnstile
  withOrderAPI,       // Order operations
  withStrictAPI,      // Requires nonce, lowest thresholds
} from '@/lib/secure-middleware';

// Usage
export const POST = withAdminAPI(async (request, ctx, params) => {
  // ctx.isAdmin is guaranteed true
  // ctx.userEmail is available
  // Request is already validated
  return NextResponse.json({ success: true });
});
```

### 4. Encryption (`src/lib/encryption.ts`)

**Features:**
- **AES-256-GCM**: Industry-standard encryption with authentication
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Field-Level Encryption**: Encrypt specific fields in objects
- **Envelope Encryption**: For large data with separate DEK/KEK
- **Password Hashing**: Secure password storage with salts

**Usage:**
```typescript
import { 
  encrypt, 
  decrypt,
  encryptSensitiveFields,
  hashPassword,
  verifyPassword 
} from '@/lib/encryption';

// Simple encryption
const encrypted = encrypt('sensitive data');
const decrypted = decrypt(encrypted);

// Field-level encryption
const order = encryptSensitiveFields({
  customerPhone: '0812345678',
  slip: { base64: '...' }
});

// Password hashing
const { hash, salt } = hashPassword('user-password');
const isValid = verifyPassword('user-password', hash, salt);
```

## Security Headers (next.config.ts)

Enhanced Content Security Policy:
- `default-src 'self'`
- `script-src` - Limited to self and Cloudflare
- `frame-ancestors 'none'` - Prevents clickjacking
- `object-src 'none'` - No plugins
- `block-all-mixed-content` - HTTPS only
- `upgrade-insecure-requests` - Auto-upgrade HTTP

Additional Headers:
- `Cross-Origin-Embedder-Policy: credentialless`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Permissions-Policy` - Strict feature controls
- `Strict-Transport-Security` - HSTS with preload

## Database Schema

Run `scripts/supabase-security-audit-schema.sql` to create:
- `security_audit_logs` table
- Indexes for efficient queries
- Views for metrics and analysis
- Cleanup functions

## API Endpoints

### Security Dashboard API
`GET /api/admin/security?action=<action>`

Actions:
- `metrics` - Security metrics for timeframe
- `logs` - Audit logs with filtering
- `alerts` - Recent critical events
- `threats` - Active threat status
- `summary` - Complete overview

## Environment Variables

Add to `.env`:
```env
# Encryption key (required for production)
ENCRYPTION_KEY=your-secure-32-byte-key

# Optional: Separate security secret
SECURITY_SECRET_KEY=another-secret-key
```

## Best Practices

1. **Always use preset wrappers** for API routes
2. **Log all admin actions** with audit trail
3. **Encrypt sensitive data** before storage
4. **Monitor security metrics** regularly
5. **Set up alerts** for critical events
6. **Run cleanup jobs** to maintain retention policy

## Threat Detection Thresholds

| Score | Level | Action |
|-------|-------|--------|
| 0-19 | Safe | Allow |
| 20-39 | Low | Allow with warning |
| 40-59 | Medium | Rate limit strictly |
| 60-79 | High | Block with logging |
| 80-100 | Critical | Block immediately |

## Rate Limits

| API Type | Requests/min |
|----------|-------------|
| Public | 100 |
| Authenticated | 100 |
| Admin | 30 |
| Payment | 10 |
| Order | 5 |
| Strict | 3 |
