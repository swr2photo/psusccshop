import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'คำถามที่พบบ่อย | FAQ — SCC Shop',
  description:
    'คำถามที่พบบ่อยเกี่ยวกับการสั่งซื้อ การชำระเงิน PromptPay การจัดส่ง/รับสินค้า และนโยบายของ SCC Shop',
  openGraph: {
    title: 'FAQ — SCC Shop',
    description:
      'Frequently asked questions about ordering, PromptPay payment, shipping/pickup, and policies at SCC Shop.',
    url: '/faq',
    type: 'website',
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
