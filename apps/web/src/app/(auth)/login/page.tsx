import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container, PageTitle } from '@/components/ui';
import { getCurrentUser, safeNext } from '@/lib/session';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const nextPath = safeNext(next, '/me/bookings');
  if (await getCurrentUser()) redirect(nextPath);

  const registerHref = `/register?next=${encodeURIComponent(nextPath)}`;
  return (
    <Container className="max-w-sm">
      <PageTitle
        title="Sign in"
        subtitle={
          <>
            No account?{' '}
            <Link
              href={registerHref}
              className="font-medium text-brand hover:underline"
            >
              Create one
            </Link>
          </>
        }
      />
      <AuthForm mode="login" next={nextPath} />
    </Container>
  );
}
