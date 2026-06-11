import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmailAsync } from '@/lib/auth';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect('/?login=admin');
  }

  const isAdmin = await isAdminEmailAsync(session.user.email);
  if (!isAdmin) {
    redirect('/?error=admin_forbidden');
  }

  return children;
}
