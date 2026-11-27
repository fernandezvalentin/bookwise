import type { Service } from '@/lib/types';

/** Which services a staff member provides (sent as repeated `serviceIds`). */
export function ServiceCheckboxes({
  services,
  selected = [],
}: {
  services: Service[];
  selected?: string[];
}) {
  return (
    <fieldset>
      <legend className="label">Services they provide</legend>
      {services.length === 0 ? (
        <p className="text-sm text-stone-500">
          Add services first, then assign them here.
        </p>
      ) : (
        <div className="space-y-1">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="serviceIds"
                value={s.id}
                defaultChecked={selected.includes(s.id)}
                className="size-4 accent-brand"
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
