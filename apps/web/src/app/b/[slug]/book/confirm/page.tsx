import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container, PageTitle } from '@/components/ui';
import { bookingHref, getPublicBusiness } from '@/lib/business';
import {
  formatDuration,
  formatLongDay,
  formatPrice,
  localParts,
  timezoneLabel,
} from '@/lib/format';
import { requireUser } from '@/lib/session';
import { ConfirmForm } from './confirm-form';

export const metadata: Metadata = { title: 'Confirm booking' };

/** Step 2: review and confirm. Guests are sent to sign in and brought back here. */
export default async function ConfirmPage({
  params,
  searchParams,
}: PageProps<'/b/[slug]/book/confirm'>) {
  const { slug } = await params;
  const query = await searchParams;
  const param = (key: string) =>
    typeof query[key] === 'string' ? (query[key] as string) : undefined;

  const business = await getPublicBusiness(slug);
  const service = business.services.find((s) => s.id === param('service'));
  const start = param('start');
  if (!service || !start || Number.isNaN(Date.parse(start)))
    redirect(`/b/${slug}`);

  const step = {
    service: service.id,
    staff: param('staff') ?? 'any',
    start,
    reschedule: param('reschedule'),
  };
  const user = await requireUser(bookingHref(slug, 'confirm', step));

  const { localDate, localTime } = localParts(start, business.timezone);
  const staffName =
    step.staff === 'any'
      ? 'The first available staff member'
      : (business.staff.find((s) => s.id === step.staff)?.name ??
        'Any staff member');
  const backHref = bookingHref(slug, 'book', {
    ...step,
    start: undefined,
    date: localDate,
  });

  return (
    <Container className="max-w-lg">
      <PageTitle
        title={
          step.reschedule ? 'Confirm the new time' : 'Confirm your booking'
        }
        back={{ href: backHref, label: 'Back to times' }}
      />
      <div className="card mb-6 divide-y divide-zinc-100">
        <Row
          label="Service"
          value={`${service.name} · ${formatDuration(service.durationMin)}`}
        />
        <Row label="With" value={staffName} />
        <Row
          label="When"
          value={`${formatLongDay(localDate)} at ${localTime}`}
          hint={timezoneLabel(business.timezone)}
        />
        <Row label="Where" value={business.name} />
        <Row label="Price" value={formatPrice(service.priceCents)} />
        <Row label="Booked by" value={`${user.name} (${user.email})`} />
      </div>
      <ConfirmForm
        rescheduling={Boolean(step.reschedule)}
        backHref={backHref}
        fields={{ slug, ...step }}
      />
    </Container>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex gap-4 px-5 py-3 text-sm">
      <span className="w-24 shrink-0 text-zinc-500">{label}</span>
      <span className="font-medium">
        {value}
        {hint && (
          <span className="block text-xs font-normal text-zinc-500">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}
