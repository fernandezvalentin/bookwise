import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { api, ApiError } from './api';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  sessionCookies,
} from './session-cookies';
import type { CurrentUser, TokenPair } from './types';

/** Stores a token pair. Only callable from Server Functions or Route Handlers. */
export async function saveSession(pair: TokenPair) {
  const store = await cookies();
  for (const cookie of sessionCookies(pair)) store.set(cookie);
}

export async function clearSession() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/**
 * The signed-in user, or null. Memoized per request with React's `cache`, so
 * the header and the page can both ask for it with a single API call.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!(await cookies()).has(ACCESS_COOKIE)) return null;
  try {
    return await api<CurrentUser>('/me', { auth: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/** For pages that need a user: sends guests to the login page and back. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Only relative paths, so `?next=` can't send people to another site. */
export function safeNext(value: unknown, fallback = '/'): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : fallback;
}
