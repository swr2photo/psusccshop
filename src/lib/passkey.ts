// src/lib/passkey.ts
// WebAuthn/Passkey server-side utilities
// Uses @simplewebauthn/server v11 for registration & authentication

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SignJWT, jwtVerify } from 'jose';

// ==================== RP CONFIG ====================

function getRpConfig() {
  const url = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const parsed = new URL(url);
  return {
    rpName: 'PSU SCC Shop',
    rpID: parsed.hostname,
    origin: parsed.origin,
  };
}

// ==================== TYPES ====================

export interface StoredCredential {
  credential_id: string;
  user_email: string;
  public_key: string; // base64url
  counter: number;
  device_type: CredentialDeviceType;
  backed_up: boolean;
  transports: AuthenticatorTransportFuture[];
  friendly_name: string;
  created_at: string;
  last_used_at: string | null;
}

// ==================== CHALLENGE STORE ====================

async function storeChallenge(
  challenge: string,
  type: 'registration' | 'authentication',
  userEmail?: string,
): Promise<string> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');

  const { data, error } = await db
    .from('passkey_challenges')
    .insert({
      challenge,
      type,
      user_email: userEmail || null,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to store challenge: ${error.message}`);
  return data.id;
}

async function getAndDeleteChallenge(
  challengeId: string,
  type: 'registration' | 'authentication',
): Promise<string> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');

  const { data, error } = await db
    .from('passkey_challenges')
    .delete()
    .eq('id', challengeId)
    .eq('type', type)
    .gt('expires_at', new Date().toISOString())
    .select('challenge')
    .single();

  if (error || !data) throw new Error('Challenge expired or not found');
  return data.challenge;
}

// Clean up expired challenges
async function cleanExpiredChallenges(): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from('passkey_challenges')
    .delete()
    .lt('expires_at', new Date().toISOString());
}

// ==================== CREDENTIAL STORE ====================

export async function getCredentialsByEmail(email: string): Promise<StoredCredential[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from('passkey_credentials')
    .select('*')
    .eq('user_email', email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Passkey] Failed to get credentials:', error);
    return [];
  }
  return (data || []) as StoredCredential[];
}

export async function getCredentialById(credentialId: string): Promise<StoredCredential | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from('passkey_credentials')
    .select('*')
    .eq('credential_id', credentialId)
    .single();

  if (error) return null;
  return data as StoredCredential;
}

async function getAllCredentials(): Promise<StoredCredential[]> {
  // For discoverable credentials login — get all to match
  // In production, the authenticator sends credentialId so we look up directly
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data } = await db
    .from('passkey_credentials')
    .select('*');

  return (data || []) as StoredCredential[];
}

async function saveCredential(cred: Omit<StoredCredential, 'created_at' | 'last_used_at'>): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error('Database not available');

  const { error } = await db
    .from('passkey_credentials')
    .insert({
      credential_id: cred.credential_id,
      user_email: cred.user_email,
      public_key: cred.public_key,
      counter: cred.counter,
      device_type: cred.device_type,
      backed_up: cred.backed_up,
      transports: cred.transports || [],
      friendly_name: cred.friendly_name,
    });

  if (error) throw new Error(`Failed to save credential: ${error.message}`);
}

async function updateCredentialCounter(credentialId: string, newCounter: number): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;

  await db
    .from('passkey_credentials')
    .update({
      counter: newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('credential_id', credentialId);
}

export async function deleteCredential(credentialId: string, userEmail: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;

  const { error } = await db
    .from('passkey_credentials')
    .delete()
    .eq('credential_id', credentialId)
    .eq('user_email', userEmail);

  return !error;
}

export async function renameCredential(
  credentialId: string,
  userEmail: string,
  name: string,
): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;

  const { error } = await db
    .from('passkey_credentials')
    .update({ friendly_name: name })
    .eq('credential_id', credentialId)
    .eq('user_email', userEmail);

  return !error;
}

// ==================== REGISTRATION ====================

export async function generatePasskeyRegistrationOptions(
  userEmail: string,
  userName: string,
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }> {
  const { rpName, rpID } = getRpConfig();

  // Get existing credentials to exclude
  const existingCreds = await getCredentialsByEmail(userEmail);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userEmail,
    userDisplayName: userName || userEmail,
    // Don't re-register existing authenticators
    excludeCredentials: existingCreds.map((c) => ({
      id: c.credential_id,
      transports: c.transports,
    })),
    authenticatorSelection: {
      // Prefer platform authenticators (fingerprint, face, etc.)
      authenticatorAttachment: 'platform',
      // Require resident key for discoverable credentials
      residentKey: 'preferred',
      userVerification: 'required',
    },
    attestationType: 'none',
  });

  const challengeId = await storeChallenge(options.challenge, 'registration', userEmail);

  // Opportunistically clean expired challenges
  cleanExpiredChallenges().catch(() => {});

  return { options, challengeId };
}

export async function verifyPasskeyRegistration(
  challengeId: string,
  response: RegistrationResponseJSON,
  userEmail: string,
  friendlyName?: string,
): Promise<VerifiedRegistrationResponse> {
  const { rpID, origin } = getRpConfig();

  const expectedChallenge = await getAndDeleteChallenge(challengeId, 'registration');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await saveCredential({
      credential_id: credential.id,
      user_email: userEmail,
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: (response.response.transports as AuthenticatorTransportFuture[]) || [],
      friendly_name: friendlyName || detectDeviceName(),
    });
  }

  return verification;
}

// ==================== AUTHENTICATION ====================

export async function generatePasskeyAuthenticationOptions(): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}> {
  const { rpID } = getRpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    // Empty allowCredentials = discoverable credential (resident key) flow
    allowCredentials: [],
  });

  const challengeId = await storeChallenge(options.challenge, 'authentication');

  return { options, challengeId };
}

export async function verifyPasskeyAuthentication(
  challengeId: string,
  response: AuthenticationResponseJSON,
): Promise<{ verified: boolean; userEmail: string | null }> {
  const { rpID, origin } = getRpConfig();

  const expectedChallenge = await getAndDeleteChallenge(challengeId, 'authentication');

  // Find the credential by ID
  const credentialId = response.id;
  const storedCred = await getCredentialById(credentialId);

  if (!storedCred) {
    return { verified: false, userEmail: null };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: storedCred.credential_id,
      publicKey: Uint8Array.from(Buffer.from(storedCred.public_key, 'base64url')),
      counter: storedCred.counter,
      transports: storedCred.transports,
    },
  });

  if (verification.verified) {
    // Update counter for clone detection
    await updateCredentialCounter(
      storedCred.credential_id,
      verification.authenticationInfo.newCounter,
    );
  }

  return {
    verified: verification.verified,
    userEmail: verification.verified ? storedCred.user_email : null,
  };
}

// ==================== PASSKEY LOGIN TOKEN ====================
// Short-lived JWT to prove passkey auth succeeded
// Used by NextAuth CredentialsProvider

const SECRET_KEY = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');

export async function createPasskeyLoginToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: 'passkey-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2m') // Very short-lived
    .sign(SECRET_KEY);
}

export async function verifyPasskeyLoginToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.purpose !== 'passkey-login') return null;
    return (payload.email as string) || null;
  } catch {
    return null;
  }
}

// ==================== HELPERS ====================

function detectDeviceName(): string {
  // Server-side, we can't detect device — use generic name
  const names = ['Passkey', 'พาสคีย์'];
  return names[0];
}
