'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { confirmBooking, type ConfirmState } from '@/app/bookings/actions';
import { Alert } from '@/components/ui';

export function ConfirmForm({
  fields,
  rescheduling,
  backHref,
}: {
  fields: Record<string, string | undefined>;
  rescheduling: boolean;
  backHref: string;
}) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(
    confirmBooking,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {Object.entries(fields).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      {!rescheduling && (
        <div>
          <label className="label" htmlFor="notes">
            Notes for the business{' '}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            className="input"
          />
        </div>
      )}
      {state.error && (
        <Alert tone="error">
          {state.error}{' '}
          <Link href={backHref} className="font-medium underline">
            See other times
          </Link>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending
            ? 'Confirming…'
            : rescheduling
              ? 'Confirm new time'
              : 'Confirm booking'}
        </button>
        <Link href={backHref} className="btn-secondary">
          Change time
        </Link>
      </div>
    </form>
  );
}
