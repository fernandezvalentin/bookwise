import Link from 'next/link';
import { Container } from '@/components/ui';
import { getBusinessContext } from '@/lib/dashboard-server';
import { DashboardTabs } from './tabs';

export default async function BusinessDashboardLayout({
  children,
  params,
}: LayoutProps<'/dashboard/[businessId]'>) {
  const { businessId } = await params;
  const business = await getBusinessContext(businessId);
  const base = `/dashboard/${business.id}`;

  return (
    <Container wide>
      <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ← Your businesses
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {business.name}
          </h1>
        </div>
        <Link
          href={`/b/${business.slug}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          View booking page ↗
        </Link>
      </div>
      <DashboardTabs
        tabs={[
          { href: base, label: 'Agenda' },
          { href: `${base}/services`, label: 'Services' },
          { href: `${base}/staff`, label: 'Staff & hours' },
          { href: `${base}/settings`, label: 'Settings' },
        ]}
      />
      {business.role === 'STAFF' && (
        <p className="mb-4 text-sm text-zinc-500">
          You are a staff member here: you can see everything, but only owners
          can make changes.
        </p>
      )}
      {children}
    </Container>
  );
}
