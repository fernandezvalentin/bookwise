import { describe, expect, it } from 'vitest';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  secondsUntilExpiry,
  sessionCookies,
} from './session-cookies';

function jwtWithExp(exp: number) {
  const payload = Buffer.from(JSON.stringify({ sub: 'user', exp })).toString(
    'base64url',
  );
  return `header.${payload}.signature`;
}

describe('session cookies', () => {
  it('stores both tokens as httpOnly, SameSite=Lax cookies', () => {
    const cookies = sessionCookies({
      tokenType: 'Bearer',
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    });

    expect(cookies).toEqual([
      expect.objectContaining({
        name: ACCESS_COOKIE,
        value: 'access',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 900,
      }),
      expect.objectContaining({
        name: REFRESH_COOKIE,
        value: 'refresh',
        httpOnly: true,
        sameSite: 'lax',
      }),
    ]);
  });

  it('reads the remaining lifetime of a JWT', () => {
    const inTenMinutes = Math.floor(Date.now() / 1000) + 600;
    expect(secondsUntilExpiry(jwtWithExp(inTenMinutes))).toBeGreaterThan(590);
    expect(secondsUntilExpiry(jwtWithExp(1))).toBeLessThan(0);
  });

  it('treats a malformed token as already expired', () => {
    expect(secondsUntilExpiry('not-a-jwt')).toBe(0);
  });
});
