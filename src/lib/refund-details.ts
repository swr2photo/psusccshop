/** Structured payload stored in orders.refund_details (JSON). */

export type RefundPayoutMethod = 'promptpay' | 'bank';

export type RefundSelectedItem = {
  index: number;
  name: string;
  size?: string;
  qty: number;
  amount: number;
};

export type RefundDetailsPayload = {
  text?: string;
  evidenceUrls?: string[];
  payoutMethod?: RefundPayoutMethod;
  items?: RefundSelectedItem[];
};

const STRUCTURED_PREFIX = '__RFJSON__:';

export function packRefundDetails(payload: RefundDetailsPayload): string {
  const hasExtra =
    (payload.evidenceUrls && payload.evidenceUrls.length > 0) ||
    (payload.items && payload.items.length > 0) ||
    Boolean(payload.payoutMethod);
  if (!hasExtra) return String(payload.text || '').trim();
  return STRUCTURED_PREFIX + JSON.stringify({
    text: String(payload.text || '').trim(),
    evidenceUrls: payload.evidenceUrls || [],
    payoutMethod: payload.payoutMethod || 'bank',
    items: payload.items || [],
  } satisfies RefundDetailsPayload);
}

export function parseRefundDetails(raw: string | null | undefined): RefundDetailsPayload {
  const value = String(raw || '');
  if (value.startsWith(STRUCTURED_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(STRUCTURED_PREFIX.length)) as RefundDetailsPayload;
      return {
        text: parsed.text || '',
        evidenceUrls: Array.isArray(parsed.evidenceUrls) ? parsed.evidenceUrls.filter(Boolean) : [],
        payoutMethod: parsed.payoutMethod === 'promptpay' ? 'promptpay' : 'bank',
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      return { text: value };
    }
  }
  return { text: value };
}

export function refundLineAmount(item: Record<string, unknown>): number {
  const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
  const unit = Number(item.unitPrice ?? item.price ?? 0) || 0;
  const explicit = Number(item.subtotal ?? item.total ?? 0) || 0;
  if (explicit > 0) return explicit;
  return unit * qty;
}
