import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { getCurrentUser } from '@/lib/session';

const navLink =
  'rounded-full px-3.5 py-2 font-medium text-stone-700 transition hover:bg-stone-900/5 hover:text-stone-900';

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full bg-brand font-display text-lg leading-none text-cream"
          >
            b
          </span>
          <span className="font-display text-xl font-medium tracking-tight">
            bookwise
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className={navLink}>
                Dashboard
              </Link>
              <Link href="/me/bookings" className={navLink}>
                My bookings
              </Link>
              <span className="hidden px-2 text-stone-500 sm:inline">
                {user.name}
              </span>
              <form action={signOut}>
                <button className={navLink}>Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-secondary py-2">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
