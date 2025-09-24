import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from './AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-black text-white min-h-screen`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}