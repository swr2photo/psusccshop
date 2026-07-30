import { Client } from '@upstash/qstash';

let _qstash: Client | null = null;

export function getQStashClient(): Client | null {
  if (_qstash) return _qstash;
  const token = process.env.QSTASH_TOKEN;
  if (!token || token.includes('placeholder')) {
    return null;
  }
  _qstash = new Client({ token });
  return _qstash;
}
