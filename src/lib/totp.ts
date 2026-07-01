import crypto from 'crypto';

/**
 * Decodes a base32 string into a Buffer.
 * Supports standard RFC 4648 base32.
 */
export function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error('Invalid base32 character: ' + cleaned[i]);
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
      value &= (1 << bits) - 1; // keep only remaining bits
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a random base32 secret.
 */
export function generateSecret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const randomBytes = crypto.randomBytes(length);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += alphabet[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Calculates the HOTP code for a secret at a specific counter.
 */
export function getHOTP(secretBuffer: Buffer, counter: number): string {
  // Convert counter to 8-byte buffer
  const buf = Buffer.alloc(8);
  let tmp = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(tmp & 0xffn);
    tmp >>= 8n;
  }

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buf);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = code % 1_000_000;
  return String(otp).padStart(6, '0');
}

/**
 * Verifies a TOTP token against a secret.
 * Allows a clock drift window (default 1 step = 30s before/after).
 */
export function verifyTOTP(secret: string, token: string, window = 1): boolean {
  try {
    const secretBuffer = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const cleanToken = token.trim().replace(/\s/g, '');
    
    if (cleanToken.length !== 6 || !/^\d+$/.test(cleanToken)) {
      return false;
    }
    
    for (let i = -window; i <= window; i++) {
      if (getHOTP(secretBuffer, counter + i) === cleanToken) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[TOTP] Verification error:', error);
    return false;
  }
}
