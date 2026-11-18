import { Client, Receiver } from '@upstash/qstash';
import { SITE_URL } from '@/lib/site';

let _qstash: Client | null = null;
let _qstashToken: string | null = null;

function isConfiguredSecret(value?: string): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed && !trimmed.includes('placeholder'));
}

export function hasQStashSigningKeys(): boolean {
  return (
    isConfiguredSecret(process.env.QSTASH_CURRENT_SIGNING_KEY) &&
    isConfiguredSecret(process.env.QSTASH_NEXT_SIGNING_KEY)
  );
}

export function getQStashReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!isConfiguredSecret(currentSigningKey) || !isConfiguredSecret(nextSigningKey)) {
    return null;
  }
  return new Receiver({
    currentSigningKey,
    nextSigningKey,
    devMode: false,
  });
}

export function getQStashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!isConfiguredSecret(token) || !hasQStashSigningKeys()) {
    return null;
  }
  if (_qstash && _qstashToken === token) {
    return _qstash;
  }
  _qstash = new Client({ token });
  _qstashToken = token;
  return _qstash;
}

export function getOrderWorkerUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    SITE_URL;
  try {
    const parsed = new URL(candidate);
    return `${parsed.origin}/api/workers/process-order`;
  } catch {
    return `${SITE_URL}/api/workers/process-order`;
  }
}
