import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, PageTitle } from '@/components/ui';
import { getMyBusinesses } from '@/lib/dashboard-server';
import { timezoneLabel } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { BusinessFields } from './business-fields';
import { ActionForm } from '@/components/action-form';
import { createBusiness } from './actions';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  await requireUser('/dashboard');
  const businesses = await getMyBusinesses();

  return (
    <Container>
      <PageTitle
        title="Your businesses"
        subtitle={
          businesses.length === 0
            ? 'Create your business to start taking bookings.'
            : 'Pick a business to see its agenda and settings.'
        }
      />

      {businesses.length > 0 && (
        <ul className="card mb-8 divide-y divide-zinc-100">
          {businesses.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/${b.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="truncate text-sm text-zinc-500">
                    /b/{b.slug} · {timezoneLabel(b.timezone)}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {b.role === 'OWNER' ? 'Owner' : 'Staff'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">
          {businesses.length === 0 ? 'New business' : 'Add another business'}
        </h2>
        <div className="card p-6">
          <ActionForm
            action={createBusiness}
            submitLabel="Create business"
            pendingLabel="Creating…"
          >
            <BusinessFields />
          </ActionForm>
        </div>
      </section>
    </Container>
  );
}
