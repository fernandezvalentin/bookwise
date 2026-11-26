import type { Metadata } from 'next';
import { ActionForm } from '@/components/action-form';
import { api } from '@/lib/api';
import { centsToInput } from '@/lib/dashboard';
import { getBusinessContext } from '@/lib/dashboard-server';
import { formatDuration, formatPrice } from '@/lib/format';
import type { Service } from '@/lib/types';
import { createService, setServiceActive, updateService } from '../../actions';

export const metadata: Metadata = { title: 'Services' };

export default async function ServicesPage({
  params,
}: PageProps<'/dashboard/[businessId]/services'>) {
  const { businessId } = await params;
  const business = await getBusinessContext(businessId);
  const isOwner = business.role === 'OWNER';
  const services = await api<Service[]>(`/businesses/${business.id}/services`, {
    auth: true,
    query: { includeArchived: 'true' },
  });
  // Active first, then archived; both already sorted by name.
  const sorted = [...services].sort(
    (a, b) => Number(b.active) - Number(a.active),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">Services</h2>
        {sorted.length === 0 ? (
          <p className="card p-5 text-sm text-zinc-500">
            No services yet. Add the first one to open bookings.
          </p>
        ) : (
          <ul className="card divide-y divide-zinc-100">
            {sorted.map((s) => (
              <li key={s.id} className={s.active ? '' : 'bg-zinc-50'}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 hover:bg-zinc-50">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-medium ${s.active ? '' : 'text-zinc-500'}`}
                      >
                        {s.name}
                        {!s.active && (
                          <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            Archived
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {formatDuration(s.durationMin)}
                        {s.bufferMin > 0 &&
                          ` + ${s.bufferMin} min buffer`} ·{' '}
                        {formatPrice(s.priceCents)}
                      </p>
                    </div>
                    {isOwner && (
                      <span className="text-sm text-zinc-500 group-open:hidden">
                        Edit
                      </span>
                    )}
                  </summary>
                  {isOwner && (
                    <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
                      <ActionForm
                        action={updateService.bind(null, business.id, s.id)}
                        submitLabel="Save changes"
                      >
                        <ServiceFields service={s} />
                      </ActionForm>
                      <ActionForm
                        action={setServiceActive.bind(
                          null,
                          business.id,
                          s.id,
                          !s.active,
                        )}
                        submitLabel={
                          s.active ? 'Archive service' : 'Restore service'
                        }
                        pendingLabel="One moment…"
                        submitClassName={
                          s.active ? 'btn-danger' : 'btn-secondary'
                        }
                        className="space-y-2 border-t border-zinc-100 pt-4"
                      >
                        <p className="text-sm text-zinc-500">
                          {s.active
                            ? 'Archived services can’t be booked. Existing bookings are kept.'
                            : 'Restoring makes it bookable again.'}
                        </p>
                      </ActionForm>
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-700">
            Add a service
          </h2>
          <div className="card p-5">
            <ActionForm
              action={createService.bind(null, business.id)}
              submitLabel="Add service"
              pendingLabel="Adding…"
              resetOnSuccess
            >
              <ServiceFields />
            </ActionForm>
          </div>
        </section>
      )}
    </div>
  );
}

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60];

/** Options with the current value included, even if it isn't a preset. */
function withValue(options: number[], value?: number) {
  return value === undefined || options.includes(value)
    ? options
    : [...options, value].sort((a, b) => a - b);
}

function ServiceFields({ service }: { service?: Service }) {
  const prefix = service?.id ?? 'new';
  return (
    <>
      <div>
        <label className="label" htmlFor={`${prefix}-name`}>
          Name
        </label>
        <input
          id={`${prefix}-name`}
          name="name"
          className="input"
          required
          maxLength={100}
          defaultValue={service?.name}
          placeholder="Haircut"
        />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-description`}>
          Description{' '}
          <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id={`${prefix}-description`}
          name="description"
          className="input"
          rows={2}
          maxLength={500}
          defaultValue={service?.description ?? ''}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor={`${prefix}-duration`}>
            Duration
          </label>
          <select
            id={`${prefix}-duration`}
            name="durationMin"
            className="input"
            defaultValue={service?.durationMin ?? 30}
          >
            {withValue(DURATIONS, service?.durationMin).map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-buffer`}>
            Buffer
          </label>
          <select
            id={`${prefix}-buffer`}
            name="bufferMin"
            className="input"
            defaultValue={service?.bufferMin ?? 0}
          >
            {withValue(BUFFERS, service?.bufferMin).map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'None' : `${m} min`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-price`}>
            Price ($)
          </label>
          <input
            id={`${prefix}-price`}
            name="price"
            className="input"
            inputMode="decimal"
            required
            pattern="\d+([.,]\d{1,2})?"
            title="A number, with up to 2 decimals"
            defaultValue={service ? centsToInput(service.priceCents) : ''}
            placeholder="15000"
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        The buffer is free time blocked after each appointment (cleaning,
        setup).
      </p>
    </>
  );
}
