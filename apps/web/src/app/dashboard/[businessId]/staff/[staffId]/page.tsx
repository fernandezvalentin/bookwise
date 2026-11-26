import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { api, ApiError } from '@/lib/api';
import { formatInstant } from '@/lib/dashboard';
import { getBusinessContext } from '@/lib/dashboard-server';
import { timezoneLabel } from '@/lib/format';
import { describeDay, groupByWeekday, WEEKDAYS } from '@/lib/schedule';
import type {
  Service,
  StaffMember,
  TimeOff,
  WorkingInterval,
} from '@/lib/types';
import {
  addTimeOff,
  removeTimeOff,
  saveSchedule,
  setStaffActive,
  updateStaff,
} from '../../../actions';
import { ServiceCheckboxes } from '../service-checkboxes';
import { ScheduleFields } from './schedule-editor';

export const metadata: Metadata = { title: 'Staff member' };

export default async function StaffMemberPage({
  params,
}: PageProps<'/dashboard/[businessId]/staff/[staffId]'>) {
  const { businessId, staffId } = await params;
  const business = await getBusinessContext(businessId);
  const isOwner = business.role === 'OWNER';
  const base = `/businesses/${business.id}/staff/${encodeURIComponent(staffId)}`;

  const [staff, services, hours, timeOff] = await Promise.all([
    api<StaffMember[]>(`/businesses/${business.id}/staff`, {
      auth: true,
      query: { includeInactive: 'true' },
    }),
    api<Service[]>(`/businesses/${business.id}/services`, { auth: true }),
    api<WorkingInterval[]>(`${base}/working-hours`, { auth: true }).catch(
      notFoundOn404,
    ),
    api<TimeOff[]>(`${base}/time-off`, { auth: true }).catch(notFoundOn404),
  ]);
  const member = staff.find((s) => s.id === staffId);
  if (!member) notFound();
  const tz = business.timezone;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/${business.id}/staff`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Staff
        </Link>
        <h2 className="text-xl font-semibold">{member.name}</h2>
        {!member.active && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Inactive
          </span>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Weekly hours */}
        <section>
          <h3 className="mb-2 text-sm font-medium text-zinc-700">
            Weekly hours{' '}
            <span className="font-normal text-zinc-500">
              ({timezoneLabel(tz)})
            </span>
          </h3>
          <div className="card px-5 py-3">
            {isOwner ? (
              <ActionForm
                action={saveSchedule.bind(null, business.id, member.id)}
                submitLabel="Save hours"
              >
                <ScheduleFields initial={hours} />
              </ActionForm>
            ) : (
              <ReadOnlyWeek hours={hours} />
            )}
          </div>
        </section>

        <div className="space-y-8">
          {/* Profile */}
          {isOwner && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-zinc-700">
                Profile
              </h3>
              <div className="card space-y-4 p-5">
                <ActionForm
                  action={updateStaff.bind(null, business.id, member.id)}
                  submitLabel="Save"
                >
                  <div>
                    <label className="label" htmlFor="staff-name">
                      Name
                    </label>
                    <input
                      id="staff-name"
                      name="name"
                      className="input"
                      required
                      maxLength={100}
                      defaultValue={member.name}
                    />
                  </div>
                  <ServiceCheckboxes
                    services={services}
                    selected={member.serviceIds}
                  />
                </ActionForm>
                <ActionForm
                  action={setStaffActive.bind(
                    null,
                    business.id,
                    member.id,
                    !member.active,
                  )}
                  submitLabel={member.active ? 'Deactivate' : 'Reactivate'}
                  pendingLabel="One moment…"
                  submitClassName={
                    member.active ? 'btn-danger' : 'btn-secondary'
                  }
                  className="space-y-2 border-t border-zinc-100 pt-4"
                >
                  <p className="text-sm text-zinc-500">
                    {member.active
                      ? 'Inactive staff can’t be booked. Their past bookings are kept.'
                      : 'Reactivating makes them bookable again.'}
                  </p>
                </ActionForm>
              </div>
            </section>
          )}

          {/* Time off */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-700">Time off</h3>
            <div className="card divide-y divide-zinc-100">
              {timeOff.length === 0 ? (
                <p className="p-5 text-sm text-zinc-500">
                  No upcoming time off.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {timeOff.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start gap-3 px-5 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="tabular-nums">
                          {formatInstant(t.startsAt, tz)} →{' '}
                          {formatInstant(t.endsAt, tz)}
                        </p>
                        {t.reason && (
                          <p className="text-zinc-500">{t.reason}</p>
                        )}
                      </div>
                      {isOwner && (
                        <ActionForm
                          action={removeTimeOff.bind(
                            null,
                            business.id,
                            member.id,
                            t.id,
                          )}
                          submitLabel="Remove"
                          pendingLabel="…"
                          submitClassName="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                          className="flex flex-col items-end gap-1"
                        >
                          {null}
                        </ActionForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isOwner && (
                <div className="p-5">
                  <ActionForm
                    action={addTimeOff.bind(null, business.id, member.id, tz)}
                    submitLabel="Add time off"
                    pendingLabel="Adding…"
                    submitClassName="btn-secondary"
                    resetOnSuccess
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label" htmlFor="off-start">
                          From
                        </label>
                        <input
                          id="off-start"
                          name="startsAt"
                          type="datetime-local"
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="off-end">
                          To
                        </label>
                        <input
                          id="off-end"
                          name="endsAt"
                          type="datetime-local"
                          className="input"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="off-reason">
                        Reason{' '}
                        <span className="font-normal text-zinc-400">
                          (optional)
                        </span>
                      </label>
                      <input
                        id="off-reason"
                        name="reason"
                        className="input"
                        maxLength={200}
                        placeholder="Holidays"
                      />
                    </div>
                    <p className="text-xs text-zinc-500">
                      Times are in {timezoneLabel(tz)}. Existing bookings in
                      that period are not cancelled automatically.
                    </p>
                  </ActionForm>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyWeek({ hours }: { hours: WorkingInterval[] }) {
  const days = groupByWeekday(hours);
  return (
    <dl className="divide-y divide-zinc-100 text-sm">
      {WEEKDAYS.map((name, i) => (
        <div key={name} className="flex gap-4 py-2">
          <dt className="w-24 font-medium">{name}</dt>
          <dd className="text-zinc-600 tabular-nums">{describeDay(days[i])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A staff id from another business (or made up) shows the 404 page. */
function notFoundOn404(error: unknown): never {
  if (
    error instanceof ApiError &&
    (error.status === 404 || error.status === 400)
  )
    notFound();
  throw error;
}
