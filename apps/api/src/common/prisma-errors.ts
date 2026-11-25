import { Prisma } from '../generated/prisma/client.js';

/** P2002: a unique constraint was violated (e.g. a slug or email already exists). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** P2025: an update/delete matched no row (e.g. its `where` filter no longer holds). */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

/**
 * P2034: Postgres aborted the statement because of a deadlock (40P01) or a
 * serialization failure (40001). Safe to retry: nothing was written.
 */
export function isRetryableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

/**
 * Runs `operation`, retrying it a few times if Postgres aborted it because of a
 * deadlock. Concurrent inserts that compete for the same exclusion constraint
 * can deadlock each other; Postgres detects it and aborts one of them.
 */
export async function retryOnDeadlock<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableConflict(error) || attempt >= attempts) throw error;
      // Small random pause so the retried transactions don't collide again.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 20 * attempt),
      );
    }
  }
}

/**
 * SQLSTATE 23P01: an exclusion constraint was violated (e.g. two overlapping
 * bookings). Prisma has no dedicated code for it; with the `pg` driver adapter
 * the original Postgres error travels in `meta.driverAdapterError.cause`.
 */
export function isExclusionViolation(
  error: unknown,
  constraint?: string,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const cause = (
    error.meta?.driverAdapterError as
      { cause?: { code?: string; message?: string } } | undefined
  )?.cause;
  if (cause?.code !== '23P01') return false;
  return !constraint || (cause.message ?? '').includes(`"${constraint}"`);
}
