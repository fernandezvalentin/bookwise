'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import {
  clearSession,
  getRefreshToken,
  safeNext,
  saveSession,
} from '@/lib/session';
import type { TokenPair } from '@/lib/types';

export interface AuthFormState {
  error?: string;
}

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    await saveSession(
      await api<TokenPair>('/auth/login', {
        method: 'POST',
        body: parsed.data,
      }),
    );
  } catch (error) {
    return { error: authErrorMessage(error) };
  }
  // redirect() throws on purpose, so it goes outside the try/catch.
  redirect(safeNext(formData.get('next'), '/me/bookings'));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    await saveSession(
      await api<TokenPair>('/auth/register', {
        method: 'POST',
        body: parsed.data,
      }),
    );
  } catch (error) {
    return { error: authErrorMessage(error) };
  }
  redirect(safeNext(formData.get('next'), '/me/bookings'));
}

export async function signOut() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    // Revoke the session in the API too; signing out locally works even if this fails.
    await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(
      () => undefined,
    );
  }
  await clearSession();
  redirect('/');
}

/**
 * Signs in as the owner of the demo business, so visitors can try the
 * dashboard without creating an account. The credentials stay on the server;
 * the demo data is reset regularly (stage 8), so edits there are harmless.
 */
export async function tryDemo() {
  const email = process.env.DEMO_OWNER_EMAIL;
  const password = process.env.DEMO_OWNER_PASSWORD;
  if (!email || !password) redirect('/');

  // Replacing another session: revoke it in the API instead of orphaning it.
  const previous = await getRefreshToken();
  if (previous) {
    await api('/auth/logout', {
      method: 'POST',
      body: { refreshToken: previous },
    }).catch(() => undefined);
  }

  try {
    await saveSession(
      await api<TokenPair>('/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    );
  } catch {
    redirect('/login?next=/dashboard');
  }
  redirect('/dashboard');
}

function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'Something went wrong. Please try again.';
  switch (error.status) {
    case 401:
      return 'Invalid email or password.';
    case 409:
      return 'An account with that email already exists.';
    case 429:
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return error.messages[0] ?? 'Something went wrong. Please try again.';
  }
}
