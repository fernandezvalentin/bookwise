'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { ActionState } from '@/lib/action-state';
import { Alert } from './ui';

/**
 * A form wired to a Server Action that returns `{ error }` or `{ success }`.
 *
 * React resets a `<form action>` after every submission, which would wipe what
 * the user typed when the API rejects it. Submitting through `onSubmit` keeps
 * the fields; `resetOnSuccess` clears them only when the action worked (for
 * "add" forms).
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = 'Saving…',
  resetOnSuccess = false,
  submitClassName = 'btn-primary',
  className = 'space-y-4',
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  submitClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className}>
      {children}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && !pending && (
        <Alert tone="success">{state.success}</Alert>
      )}
      <button className={submitClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
