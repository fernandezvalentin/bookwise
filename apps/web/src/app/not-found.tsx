import Link from 'next/link';
import { Container } from '@/components/ui';

export default function NotFound() {
  return (
    <Container className="py-12 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-600">
        The business or booking you are looking for doesn’t exist.
      </p>
      <Link href="/" className="btn-secondary mt-6">
        Go home
      </Link>
    </Container>
  );
}
