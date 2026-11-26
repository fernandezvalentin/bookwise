'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/lib/action-state';
import { api, ApiError } from '@/lib/api';
import { localInputToInstant, parsePriceToCents } from '@/lib/dashboard';
import type { MyBusiness } from '@/lib/types';

/*
 * Server Actions of the business dashboard. Ids come bound from the page
 * (`action.bind(null, businessId)`); they are not trusted: every call goes to
 * the API with the user's token, and the API checks membership and role.
 * After a change, `refresh()` re-renders the current page with fresh data.
 */

const id = z.uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)
    .optional();

// ---------------------------------------------------------------------
//  Business
// ---------------------------------------------------------------------

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(100),
  slug: optionalText(60),
  timezone: z.string().min(1, 'Pick a time zone'),
});

export async function createBusiness(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  let business: MyBusiness;
  try {
    business = await api<MyBusiness>('/businesses', {
      method: 'POST',
      auth: true,
      body: parsed.data,
    });
  } catch (error) {
    return failure(error);
  }
  redirect(`/dashboard/${business.id}`);
}

export async function updateBusiness(
  businessId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  return mutate('Business updated.', () =>
    api(`/businesses/${id.parse(businessId)}`, {
      method: 'PATCH',
      auth: true,
      body: parsed.data,
    }),
  );
}

// ---------------------------------------------------------------------
//  Services
// ---------------------------------------------------------------------

const minutes = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).multipleOf(5, 'Use steps of 5');

const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  description: z.string().trim().max(500),
  durationMin: minutes(5, 480),
  bufferMin: minutes(0, 240),
  price: z.string(),
});

function parseService(formData: FormData) {
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: invalid(parsed.error) };
  const priceCents = parsePriceToCents(parsed.data.price);
  if (priceCents === null)
    return { error: { error: 'Enter a valid price, like 15000 or 15000.50' } };
  const { name, description, durationMin, bufferMin } = parsed.data;
  return {
    data: {
      name,
      description: description || null,
      durationMin,
      bufferMin,
      priceCents,
    },
  };
}

export async function createService(
  businessId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const service = parseService(formData);
  if (service.error) return service.error;
  return mutate(`Added “${service.data.name}”.`, () =>
    api(`/businesses/${id.parse(businessId)}/services`, {
      method: 'POST',
      auth: true,
      body: service.data,
    }),
  );
}

export async function updateService(
  businessId: string,
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const service = parseService(formData);
  if (service.error) return service.error;
  return mutate('Saved.', () =>
    api(`/businesses/${id.parse(businessId)}/services/${id.parse(serviceId)}`, {
      method: 'PATCH',
      auth: true,
      body: service.data,
    }),
  );
}

/** Archive (can't be booked anymore) or restore a service. */
export async function setServiceActive(
  businessId: string,
  serviceId: string,
  active: boolean,
): Promise<ActionState> {
  const path = `/businesses/${id.parse(businessId)}/services/${id.parse(serviceId)}`;
  return mutate(undefined, () =>
    active
      ? api(path, { method: 'PATCH', auth: true, body: { active: true } })
      : api(path, { method: 'DELETE', auth: true }),
  );
}

// ---------------------------------------------------------------------
//  Staff
// ---------------------------------------------------------------------

const staffSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  serviceIds: z.array(id),
});

function parseStaff(formData: FormData) {
  return staffSchema.safeParse({
    name: formData.get('name'),
    serviceIds: formData.getAll('serviceIds'),
  });
}

export async function createStaff(
  businessId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseStaff(formData);
  if (!parsed.success) return invalid(parsed.error);
  return mutate(`Added ${parsed.data.name}. Now set their working hours.`, () =>
    api(`/businesses/${id.parse(businessId)}/staff`, {
      method: 'POST',
      auth: true,
      body: parsed.data,
    }),
  );
}

export async function updateStaff(
  businessId: string,
  staffId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseStaff(formData);
  if (!parsed.success) return invalid(parsed.error);
  return mutate('Saved.', () =>
    api(`/businesses/${id.parse(businessId)}/staff/${id.parse(staffId)}`, {
      method: 'PATCH',
      auth: true,
      body: parsed.data,
    }),
  );
}

/** Deactivate (hidden from booking, keeps the history) or reactivate. */
export async function setStaffActive(
  businessId: string,
  staffId: string,
  active: boolean,
): Promise<ActionState> {
  const path = `/businesses/${id.parse(businessId)}/staff/${id.parse(staffId)}`;
  return mutate(undefined, () =>
    active
      ? api(path, { method: 'PATCH', auth: true, body: { active: true } })
      : api(path, { method: 'DELETE', auth: true }),
  );
}

const scheduleSchema = z.array(
  z.object({
    weekday: z.number().int().min(1).max(7),
    start: z.string(),
    end: z.string(),
  }),
);

/** Replaces the whole weekly schedule (the editor sends it as JSON). */
export async function saveSchedule(
  businessId: string,
  staffId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let schedule: z.infer<typeof scheduleSchema>;
  try {
    schedule = scheduleSchema.parse(
      JSON.parse(String(formData.get('schedule'))),
    );
  } catch {
    return { error: 'Something is wrong with the schedule. Reload the page.' };
  }
  // Times and overlaps are validated by the API, with clear messages.
  return mutate('Working hours saved.', () =>
    api(
      `/businesses/${id.parse(businessId)}/staff/${id.parse(staffId)}/working-hours`,
      { method: 'PUT', auth: true, body: schedule },
    ),
  );
}

export async function addTimeOff(
  businessId: string,
  staffId: string,
  timezone: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const startsAt = localInputToInstant(formData.get('startsAt'), timezone);
  const endsAt = localInputToInstant(formData.get('endsAt'), timezone);
  if (!startsAt || !endsAt) return { error: 'Enter a start and an end.' };
  const reason = String(formData.get('reason') ?? '').trim() || undefined;

  return mutate('Time off added.', () =>
    api(
      `/businesses/${id.parse(businessId)}/staff/${id.parse(staffId)}/time-off`,
      { method: 'POST', auth: true, body: { startsAt, endsAt, reason } },
    ),
  );
}

export async function removeTimeOff(
  businessId: string,
  staffId: string,
  timeOffId: string,
): Promise<ActionState> {
  return mutate(undefined, () =>
    api(
      `/businesses/${id.parse(businessId)}/staff/${id.parse(staffId)}/time-off/${id.parse(timeOffId)}`,
      { method: 'DELETE', auth: true },
    ),
  );
}

// ---------------------------------------------------------------------
//  Agenda
// ---------------------------------------------------------------------

/** Members can cancel any booking of their business; the customer gets an email. */
export async function cancelAgendaBooking(
  bookingId: string,
): Promise<ActionState> {
  return mutate(undefined, () =>
    api(`/bookings/${id.parse(bookingId)}/cancel`, {
      method: 'POST',
      auth: true,
    }),
  );
}

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

/** Runs an API call, refreshes the page on success, and turns errors into a message. */
async function mutate(
  success: string | undefined,
  call: () => Promise<unknown>,
): Promise<ActionState> {
  try {
    await call();
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { success };
}

function invalid(error: z.ZodError): ActionState {
  return { error: error.issues[0]?.message ?? 'Check the form.' };
}

function failure(error: unknown): ActionState {
  if (!(error instanceof ApiError))
    return { error: 'Something went wrong. Please try again.' };
  switch (error.status) {
    case 401:
      redirect('/login?next=/dashboard');
    case 403:
      return { error: 'Only owners of the business can change this.' };
    case 404:
      return { error: 'Not found. It may have been removed; reload the page.' };
    default:
      // 400 (validation) and 409 (conflicts) carry messages meant for people.
      return { error: error.messages.join('. ') };
  }
}
