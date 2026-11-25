import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container, PageTitle } from '@/components/ui';
import { getCurrentUser, safeNext } from '@/lib/session';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage({
  searchParams,
}: PageProps<'/register'>) {
  const { next } = await searchParams;
  const nextPath = safeNext(next, '/me/bookings');
  if (await getCurrentUser()) redirect(nextPath);

  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  return (
    <Container className="max-w-sm">
      <PageTitle
        title="Create your account"
        subtitle={
          <>
            Already have one?{' '}
            <Link
              href={loginHref}
              className="font-medium text-brand hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      />
      <AuthForm mode="register" next={nextPath} />
    </Container>
  );
}
