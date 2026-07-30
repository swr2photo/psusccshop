// src/lib/payload-crypto.ts
import { NextResponse } from 'next/server';

const SECRET = process.env.NEXT_PUBLIC_PAYLOAD_SECRET || '00000000000000000000000000000000';

function getCryptoAPI() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  // Fallback for older Node environments if not polyfilled by Next.js
  const nodeCrypto = require('crypto');
  return nodeCrypto.webcrypto;
}

let cachedKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  
  const crypto = getCryptoAPI();
  const enc = new TextEncoder();
  // Ensure the secret is exactly 32 bytes (256 bits)
  const keyMaterial = enc.encode(SECRET.padEnd(32, '0').substring(0, 32));
  
  cachedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  ) as CryptoKey;
  
  return cachedKey;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptPayload(data: any): Promise<string> {
  const crypto = getCryptoAPI();
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);
  
  return arrayBufferToBase64(combined.buffer);
}

export async function decryptPayload(encryptedStr: string): Promise<any> {
  try {
    const crypto = getCryptoAPI();
    const key = await getEncryptionKey();
    const combinedBuffer = base64ToArrayBuffer(encryptedStr);
    const combinedArray = new Uint8Array(combinedBuffer);
    
    const iv = combinedArray.slice(0, 12);
    const data = combinedArray.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    const decoded = new TextDecoder().decode(decrypted);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[PayloadCrypto] Decryption failed:', error);
    throw new Error('Failed to decrypt payload');
  }
}

/**
 * Server Helper: Automatically read and decrypt incoming JSON requests.
 * Use this to replace `await req.json()`
 */
export async function secureJsonRequest(req: Request | any): Promise<any> {
  const body = await req.json();
  if (body && body._e) {
    return await decryptPayload(body._e);
  }
  return body; // Fallback for unencrypted webhooks or legacy traffic
}

/**
 * Server Helper: Automatically encrypt outgoing JSON responses.
 * Use this to replace `NextResponse.json(...)`
 */
export async function secureJsonResponse(data: any, init?: ResponseInit): Promise<NextResponse> {
  // If the payload is already an error or simple string, we still encrypt it
  // unless we specifically want to bypass. We'll encrypt everything for consistency.
  try {
    const encrypted = await encryptPayload(data);
    return NextResponse.json({ _e: encrypted }, init);
  } catch (error) {
    console.error('[PayloadCrypto] Encryption failed:', error);
    // Fallback to unencrypted in case of critical error
    return NextResponse.json(data, init);
  }
}
