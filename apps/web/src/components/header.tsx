import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { getCurrentUser } from '@/lib/session';

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          <span className="text-brand">Book</span>wise
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {user ? (
            <>
              <Link
                href="/me/bookings"
                className="rounded-lg px-3 py-2 font-medium hover:bg-zinc-100"
              >
                My bookings
              </Link>
              <span className="hidden px-2 text-zinc-500 sm:inline">
                {user.name}
              </span>
              <form action={signOut}>
                <button className="rounded-lg px-3 py-2 font-medium text-zinc-600 hover:bg-zinc-100">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 font-medium hover:bg-zinc-100"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
