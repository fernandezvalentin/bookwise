import { Prisma } from '../generated/prisma/client.js';

/** P2002: a unique constraint was violated (e.g. a slug or email already exists). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
