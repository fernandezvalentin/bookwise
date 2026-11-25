'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui';
import { signIn, signUp, type AuthFormState } from './actions';

export function AuthForm({
  mode,
  next,
}: {
  mode: 'login' | 'register';
  next?: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === 'login' ? signIn : signUp,
    {},
  );

  return (
    <form action={action} className="card space-y-4 p-6">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === 'register' && (
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            className="input"
            required
            autoComplete="name"
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'register' && (
          <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
        )}
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending
          ? 'One moment…'
          : mode === 'login'
            ? 'Sign in'
            : 'Create account'}
      </button>
    </form>
  );
}
