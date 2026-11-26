'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Section tabs. Client-side only to highlight the current one. */
export function DashboardTabs({
  tabs,
}: {
  tabs: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  // The agenda is the base path, so match it exactly; the others by prefix.
  const isActive = (href: string, i: number) =>
    i === 0 ? pathname === href : pathname.startsWith(href);

  return (
    // The divider is an inset shadow, not a border: a `-mb-px` overlap on the
    // tabs would overflow the scroll container and show a vertical scrollbar.
    <nav className="mb-6 flex gap-1 overflow-x-auto text-sm shadow-[inset_0_-1px_0] shadow-zinc-200">
      {tabs.map((tab, i) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={isActive(tab.href, i) ? 'page' : undefined}
          className="border-b-2 border-transparent px-3 py-2 font-medium whitespace-nowrap text-zinc-500 hover:text-zinc-800 aria-[current=page]:border-brand aria-[current=page]:text-zinc-900"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
