import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { api } from '@/lib/api';
import { getBusinessContext } from '@/lib/dashboard-server';
import type { Service, StaffMember } from '@/lib/types';
import { createStaff } from '../../actions';
import { ServiceCheckboxes } from './service-checkboxes';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage({
  params,
}: PageProps<'/dashboard/[businessId]/staff'>) {
  const { businessId } = await params;
  const business = await getBusinessContext(businessId);
  const isOwner = business.role === 'OWNER';
  const [staff, services] = await Promise.all([
    api<StaffMember[]>(`/businesses/${business.id}/staff`, {
      auth: true,
      query: { includeInactive: 'true' },
    }),
    api<Service[]>(`/businesses/${business.id}/services`, { auth: true }),
  ]);
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const sorted = [...staff].sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="mb-2 text-sm font-medium text-stone-700">Staff</h2>
        {sorted.length === 0 ? (
          <p className="card p-5 text-sm text-stone-500">
            No staff yet. Add the people who take appointments.
          </p>
        ) : (
          <ul className="card divide-y divide-stone-100">
            {sorted.map((s) => {
              const names = s.serviceIds
                .map((id) => serviceName.get(id))
                .filter(Boolean);
              return (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/${business.id}/staff/${s.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-medium ${s.active ? '' : 'text-stone-500'}`}
                      >
                        {s.name}
                        {!s.active && (
                          <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-stone-500">
                        {names.length > 0
                          ? names.join(', ')
                          : 'No services assigned'}
                      </p>
                    </div>
                    <span className="text-sm text-stone-500">
                      Hours & time off →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOwner && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-stone-700">
            Add a staff member
          </h2>
          <div className="card p-5">
            <ActionForm
              action={createStaff.bind(null, business.id)}
              submitLabel="Add staff member"
              pendingLabel="Adding…"
              resetOnSuccess
            >
              <div>
                <label className="label" htmlFor="new-staff-name">
                  Name
                </label>
                <input
                  id="new-staff-name"
                  name="name"
                  className="input"
                  required
                  maxLength={100}
                />
              </div>
              <ServiceCheckboxes services={services} />
            </ActionForm>
          </div>
        </section>
      )}
    </div>
  );
}
