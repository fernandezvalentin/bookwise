'use client';

import { useState } from 'react';
import {
  flattenWeek,
  groupByWeekday,
  WEEKDAYS,
  type TimeRange,
} from '@/lib/schedule';
import type { WorkingInterval } from '@/lib/types';

const DEFAULT_RANGE: TimeRange = { start: '09:00', end: '18:00' };

/**
 * Weekly hours editor. It only edits local state; the whole week travels as
 * JSON in a hidden input and the API replaces the schedule in one transaction.
 * Times and overlaps are validated by the API, which returns clear messages.
 */
export function ScheduleFields({
  initial,
  disabled = false,
}: {
  initial: WorkingInterval[];
  disabled?: boolean;
}) {
  const [days, setDays] = useState(() => groupByWeekday(initial));

  const update = (day: number, ranges: TimeRange[]) =>
    setDays((prev) => prev.map((r, i) => (i === day ? ranges : r)));

  const copyMondayToWeekdays = () =>
    setDays((prev) => prev.map((r, i) => (i >= 1 && i <= 4 ? prev[0] : r)));

  return (
    <fieldset disabled={disabled}>
      <input
        type="hidden"
        name="schedule"
        value={JSON.stringify(flattenWeek(days))}
      />
      <ul className="divide-y divide-stone-100">
        {WEEKDAYS.map((name, day) => {
          const ranges = days[day];
          return (
            <li
              key={name}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3"
            >
              <span className="w-24 pt-2 text-sm font-medium">{name}</span>
              <div className="flex-1 space-y-2">
                {ranges.length === 0 && (
                  <p className="pt-2 text-sm text-stone-400">Closed</p>
                )}
                {ranges.map((range, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input
                      type="time"
                      step={300}
                      aria-label={`${name} from`}
                      className="input w-32"
                      value={range.start}
                      required
                      onChange={(e) =>
                        update(
                          day,
                          ranges.map((r, j) =>
                            j === k ? { ...r, start: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <span className="text-stone-400">–</span>
                    <input
                      type="time"
                      step={300}
                      aria-label={`${name} to`}
                      className="input w-32"
                      value={range.end}
                      required
                      onChange={(e) =>
                        update(
                          day,
                          ranges.map((r, j) =>
                            j === k ? { ...r, end: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          day,
                          ranges.filter((_, j) => j !== k),
                        )
                      }
                      className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
                      aria-label={`Remove ${name} ${range.start}–${range.end}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  update(day, [
                    ...ranges,
                    // A second range defaults to after the previous one.
                    ranges.length
                      ? { start: ranges.at(-1)!.end, end: '20:00' }
                      : DEFAULT_RANGE,
                  ])
                }
                className="rounded-lg px-2 py-2 text-sm font-medium text-brand hover:bg-brand-soft"
              >
                + Add hours
              </button>
            </li>
          );
        })}
      </ul>
      {!disabled && (
        <button
          type="button"
          onClick={copyMondayToWeekdays}
          className="mt-2 text-sm text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
        >
          Copy Monday’s hours to Tuesday–Friday
        </button>
      )}
    </fieldset>
  );
}
