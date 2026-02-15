import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ข้อกำหนดการใช้งาน | Terms of Service',
  description: 'ข้อกำหนดและเงื่อนไขการใช้งาน SCC Shop ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
  openGraph: {
    title: 'Terms of Service — SCC Shop',
    description: 'Terms of Service for SCC Shop, Science Computer Club, Faculty of Science, Prince of Songkla University.',
    url: '/terms',
    type: 'website',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
