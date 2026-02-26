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
import { prisma } from '@/lib/prisma';
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
  public_key: string;
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
  const data = await prisma.passkeyChallenge.create({
    data: {
      challenge,
      type,
      user_email: userEmail || null,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  return data.id;
}

async function getAndDeleteChallenge(
  challengeId: string,
  type: 'registration' | 'authentication',
): Promise<string> {
  const data = await prisma.passkeyChallenge.findFirst({
    where: {
      id: challengeId,
      type,
      expires_at: { gt: new Date() },
    },
  });
  
  if (!data) throw new Error('Challenge expired or not found');
  
  await prisma.passkeyChallenge.delete({ where: { id: challengeId } }).catch(() => {});
  return data.challenge;
}

async function cleanExpiredChallenges(): Promise<void> {
  await prisma.passkeyChallenge.deleteMany({
    where: { expires_at: { lt: new Date() } },
  }).catch(() => {});
}

// ==================== CREDENTIAL STORE ====================

function toStoredCred(row: any): StoredCredential {
  return {
    ...row,
    transports: (row.transports as any) || [],
    created_at: row.created_at?.toISOString?.() || row.created_at,
    last_used_at: row.last_used_at?.toISOString?.() || row.last_used_at,
  };
}

export async function getCredentialsByEmail(email: string): Promise<StoredCredential[]> {
  const data = await prisma.passkeyCredential.findMany({
    where: { user_email: email },
    orderBy: { created_at: 'desc' },
  });
  return data.map(toStoredCred);
}

export async function getCredentialById(credentialId: string): Promise<StoredCredential | null> {
  const data = await prisma.passkeyCredential.findUnique({
    where: { credential_id: credentialId },
  });
  return data ? toStoredCred(data) : null;
}

async function getAllCredentials(): Promise<StoredCredential[]> {
  const data = await prisma.passkeyCredential.findMany();
  return data.map(toStoredCred);
}

async function saveCredential(cred: Omit<StoredCredential, 'created_at' | 'last_used_at'>): Promise<void> {
  await prisma.passkeyCredential.create({
    data: {
      credential_id: cred.credential_id,
      user_email: cred.user_email,
      public_key: cred.public_key,
      counter: cred.counter,
      device_type: cred.device_type,
      backed_up: cred.backed_up,
      transports: (cred.transports || []) as any,
      friendly_name: cred.friendly_name,
    },
  });
}

async function updateCredentialCounter(credentialId: string, newCounter: number): Promise<void> {
  await prisma.passkeyCredential.update({
    where: { credential_id: credentialId },
    data: { counter: newCounter, last_used_at: new Date() },
  });
}

export async function deleteCredential(credentialId: string, userEmail: string): Promise<boolean> {
  try {
    await prisma.passkeyCredential.deleteMany({
      where: { credential_id: credentialId, user_email: userEmail },
    });
    return true;
  } catch {
    return false;
  }
}

export async function renameCredential(
  credentialId: string,
  userEmail: string,
  name: string,
): Promise<boolean> {
  try {
    const existing = await prisma.passkeyCredential.findFirst({
      where: { credential_id: credentialId, user_email: userEmail },
    });
    if (!existing) return false;
    
    await prisma.passkeyCredential.update({
      where: { credential_id: credentialId },
      data: { friendly_name: name },
    });
    return true;
  } catch {
    return false;
  }
}

// ==================== REGISTRATION ====================

export async function generatePasskeyRegistrationOptions(
  userEmail: string,
  userName: string,
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }> {
  const { rpName, rpID } = getRpConfig();
  const existingCreds = await getCredentialsByEmail(userEmail);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userEmail,
    userDisplayName: userName || userEmail,
    excludeCredentials: existingCreds.map((c) => ({
      id: c.credential_id,
      transports: c.transports,
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    attestationType: 'none',
  });

  const challengeId = await storeChallenge(options.challenge, 'registration', userEmail);
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

const SECRET_KEY = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');

export async function createPasskeyLoginToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: 'passkey-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2m')
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
  const names = ['Passkey', 'พาสคีย์'];
  return names[0];
}
