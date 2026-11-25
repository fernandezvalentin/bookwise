import type { TokenPair } from './types';

/**
 * Cookie names and options for the session. Shared by Server Functions
 * (`cookies()`) and the proxy (`request`/`response` cookies), so it has no
 * server-only imports.
 *
 * Both tokens live in httpOnly cookies: page scripts can't read them, so an
 * XSS bug can't steal the session. SameSite=Lax blocks cross-site POSTs.
 */
export const ACCESS_COOKIE = 'bw_access';
export const REFRESH_COOKIE = 'bw_refresh';

const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // matches REFRESH_TOKEN_TTL_DAYS

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function sessionCookies(pair: TokenPair) {
  return [
    {
      name: ACCESS_COOKIE,
      value: pair.accessToken,
      ...base,
      maxAge: pair.expiresIn,
    },
    {
      name: REFRESH_COOKIE,
      value: pair.refreshToken,
      ...base,
      maxAge: REFRESH_MAX_AGE,
    },
  ];
}

/** Seconds until a JWT expires, read from its payload (no signature check: the API verifies it). */
export function secondsUntilExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: number };
    return payload.exp ? payload.exp - Date.now() / 1000 : 0;
  } catch {
    return 0;
  }
}
