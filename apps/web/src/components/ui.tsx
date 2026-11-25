import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-3xl px-4 ${className}`}>
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
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← {back.label}
        </Link>
      )}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-zinc-600">{subtitle}</p>}
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
    info: 'border-zinc-200 bg-white text-zinc-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border p-3 text-sm ${styles}`}
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
    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
      Cancelled
    </span>
  );
}
