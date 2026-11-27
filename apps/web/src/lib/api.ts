import 'server-only';
import { cookies, headers as requestHeaders } from 'next/headers';
import { ACCESS_COOKIE } from './session-cookies';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/** An error answered by the API, with its status and messages. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join(', '));
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Send the signed-in user's access token (from the httpOnly cookie). */
  auth?: boolean;
}

/**
 * Calls the Bookwise API from the Next.js server. The browser never talks to
 * the API directly, so the tokens never reach client-side JavaScript.
 */
export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  // The API rate-limits sign-in per IP. Every call comes from this server, so
  // pass on the visitor's address (set by the reverse proxy); the API trusts
  // it only from private network addresses (TRUST_PROXY).
  const forwardedFor = (await requestHeaders()).get('x-forwarded-for');
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;
  if (options.auth) {
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(res.status, errorMessages(data, res.statusText));
  return data as T;
}

function errorMessages(data: unknown, fallback: string): string[] {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.map(String);
  if (typeof message === 'string') return [message];
  return [fallback || 'Request failed'];
}
