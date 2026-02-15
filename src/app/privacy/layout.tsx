import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว | Privacy Policy',
  description: 'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคล (PDPA) ของ SCC Shop ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
  openGraph: {
    title: 'Privacy Policy — SCC Shop',
    description: 'Privacy Policy and Personal Data Protection (PDPA) of SCC Shop, Science Computer Club, Faculty of Science, Prince of Songkla University.',
    url: '/privacy',
    type: 'website',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
