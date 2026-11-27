import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({
  children,
  wide = false,
  className = '',
}: {
  children: ReactNode;
  /** Wider layout for the dashboard (agenda, tables). */
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full px-4 ${wide ? 'max-w-6xl' : 'max-w-3xl'} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link
          href={back.href}
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          ← {back.label}
        </Link>
      )}
      <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-stone-600">{subtitle}</p>}
    </div>
  );
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'error';
  children: ReactNode;
}) {
  const styles = {
    info: 'border-stone-200 bg-white text-stone-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border p-3.5 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: 'CONFIRMED' | 'CANCELLED' }) {
  return status === 'CONFIRMED' ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Confirmed
    </span>
  ) : (
    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
      Cancelled
    </span>
  );
}
