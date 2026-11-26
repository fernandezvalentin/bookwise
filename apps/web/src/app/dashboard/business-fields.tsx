import type { MyBusiness } from '@/lib/types';

/** Every IANA time zone the runtime knows, for the time zone picker. */
function timezones(current?: string): string[] {
  const all = Intl.supportedValuesOf('timeZone');
  return current && !all.includes(current) ? [current, ...all] : all;
}

/**
 * Default for new businesses. ICU lists Buenos Aires under its legacy
 * canonical name (`America/Buenos_Aires`), so use whichever one the list has:
 * a default missing from the options makes the select fall back to the first.
 */
function defaultTimezone(): string {
  const all = Intl.supportedValuesOf('timeZone');
  return (
    ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'].find((tz) =>
      all.includes(tz),
    ) ?? 'UTC'
  );
}

/** Name, slug and time zone: shared by "create business" and "settings". */
export function BusinessFields({
  business,
  disabled = false,
}: {
  business?: MyBusiness;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          className="input"
          required
          minLength={2}
          maxLength={100}
          defaultValue={business?.name}
          placeholder="Barbería Centro"
        />
      </div>
      <div>
        <label className="label" htmlFor="slug">
          Booking page address
        </label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-zinc-500">/b/</span>
          <input
            id="slug"
            name="slug"
            className="input"
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lowercase letters, numbers and dashes"
            defaultValue={business?.slug}
            placeholder={business ? undefined : 'Generated from the name'}
            required={Boolean(business)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="timezone">
          Time zone
        </label>
        <select
          id="timezone"
          name="timezone"
          className="input"
          required
          defaultValue={business?.timezone ?? defaultTimezone()}
        >
          {timezones(business?.timezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Working hours and the agenda use this time zone.
        </p>
      </div>
    </fieldset>
  );
}
