import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { api, ApiError } from './api';
import type { PublicBusiness } from './types';

/** The public profile of a business, or a 404 page. Memoized per request. */
export const getPublicBusiness = cache(
  async (slug: string): Promise<PublicBusiness> => {
    try {
      return await api<PublicBusiness>(
        `/public/businesses/${encodeURIComponent(slug)}`,
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 400)
      )
        notFound();
      throw error;
    }
  },
);

export interface BookingStep {
  service?: string;
  staff?: string;
  date?: string;
  start?: string;
  /** Id of the booking being moved, when rescheduling. */
  reschedule?: string;
}

/** URL of a step of the booking flow, keeping the choices made so far. */
export function bookingHref(
  slug: string,
  step: 'book' | 'confirm',
  params: BookingStep,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const path = step === 'book' ? `/b/${slug}/book` : `/b/${slug}/book/confirm`;
  return `${path}?${query}`;
}
