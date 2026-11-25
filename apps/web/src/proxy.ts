import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  secondsUntilExpiry,
  sessionCookies,
} from './lib/session-cookies';
import type { TokenPair } from './lib/types';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/** Renew the access token when it has less than this left. */
const REFRESH_MARGIN_SECONDS = 60;

/**
 * Runs before every page. Keeps the session alive: when the access token is
 * missing or about to expire, it is renewed with the refresh token, and the new
 * cookies are applied both to this request (so the page sees them) and to the
 * response (so the browser stores them).
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  const needsRefresh =
    refresh && (!access || secondsUntilExpiry(access) < REFRESH_MARGIN_SECONDS);
  if (!needsRefresh) return NextResponse.next();

  const pair = await refreshOnce(refresh);
  if (pair) {
    const cookies = sessionCookies(pair);
    for (const c of cookies) request.cookies.set(c.name, c.value);
    const response = NextResponse.next({ request });
    for (const c of cookies) response.cookies.set(c);
    return response;
  }

  // The refresh token is invalid, expired or revoked: sign out.
  request.cookies.delete(ACCESS_COOKIE);
  request.cookies.delete(REFRESH_COOKIE);
  const response = NextResponse.next({ request });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

/**
 * The API rotates refresh tokens and treats a reused one as stolen (it revokes
 * the whole session). The browser often sends several requests at once
 * (prefetches), all with the same expiring cookies; refreshing once per request
 * would reuse the token and sign the user out. So concurrent refreshes of the
 * same token share one API call, and the result is kept for a few seconds for
 * requests that arrive right after.
 */
const inFlight = new Map<string, Promise<TokenPair | null>>();
const RESULT_TTL_MS = 10_000;

function refreshOnce(refreshToken: string): Promise<TokenPair | null> {
  let pending = inFlight.get(refreshToken);
  if (!pending) {
    pending = callRefresh(refreshToken);
    inFlight.set(refreshToken, pending);
    void pending.finally(() =>
      setTimeout(() => inFlight.delete(refreshToken), RESULT_TTL_MS),
    );
  }
  return pending;
}

async function callRefresh(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(new URL('/auth/refresh', API_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    return res.ok ? ((await res.json()) as TokenPair) : null;
  } catch {
    return null;
  }
}

export const config = {
  // Pages only: skip static files, images and the favicon.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)',
  ],
};
