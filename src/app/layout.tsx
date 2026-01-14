import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from './AppShell';
import { TrackingScripts } from '@/components/TrackingScripts';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ágape',
  },
  icons: {
    icon: [
      { url: '/agapefy-favicon.png', type: 'image/png' },
      { url: '/agapefy-pwa-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/agapefy-pwa-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/agapefy-pwa-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <TrackingScripts />
      </head>
      <body className={`${inter.className} bg-black text-white min-h-screen`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
