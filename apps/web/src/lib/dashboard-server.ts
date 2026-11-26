import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { api } from './api';
import { requireUser } from './session';
import type { MyBusiness } from './types';

/** Businesses the signed-in user belongs to. Memoized per request. */
export const getMyBusinesses = cache(() =>
  api<MyBusiness[]>('/businesses', { auth: true }),
);

/**
 * The business of a dashboard route and the user's role in it. Every
 * dashboard page calls this itself (layouts don't protect pages on their own),
 * and thanks to `cache` the layout and the page share one API call.
 *
 * The role only decides what the UI shows: the API enforces it again on every
 * request (`BusinessAccessGuard`), so hiding a button is never the protection.
 */
export async function getBusinessContext(
  businessId: string,
): Promise<MyBusiness> {
  await requireUser(`/dashboard/${businessId}`);
  const business = (await getMyBusinesses()).find((b) => b.id === businessId);
  if (!business) notFound();
  return business;
}
