import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { Header } from '@/components/header';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
// Serif for titles (font-display). Variable font: any weight, with optical sizing.
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: { default: 'Bookwise', template: '%s · Bookwise' },
  description: 'Online booking for small businesses.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="flex-1 py-10">{children}</main>
        <footer className="border-t border-stone-200/80 py-8 text-center text-xs text-stone-500">
          <span className="font-display text-sm text-stone-700">Bookwise</span>{' '}
          · a portfolio project
        </footer>
      </body>
    </html>
  );
}
