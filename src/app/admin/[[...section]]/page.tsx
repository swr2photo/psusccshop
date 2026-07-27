import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import AdminConsole from '@/components/admin/AdminConsole';
import { AdminLoadingShell } from '@/components/admin/AdminLoadingShell';
import { isAdminSection } from '@/lib/admin-tabs';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ section?: string[] }>;
};

export default async function AdminSectionPage({ params }: PageProps) {
  const { section: parts } = await params;
  const section = parts?.[0];

  if (section && !isAdminSection(section)) {
    notFound();
  }

  return (
    <Suspense fallback={<AdminLoadingShell />}>
      <AdminConsole section={section || 'dashboard'} />
    </Suspense>
  );
}
