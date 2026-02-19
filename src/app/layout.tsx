import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from './AppShell';
import { TrackingScripts } from '@/components/TrackingScripts';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.agapefy.com'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Agapefy',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Agapefy',
    siteName: 'Agapefy',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Agapefy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agapefy',
    images: ['/og-image.png'],
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
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Sans+3:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} bg-black text-white min-h-screen`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
