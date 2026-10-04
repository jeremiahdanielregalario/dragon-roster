import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Dragon Roster · Your collection, ranked',
  description: 'Track the Dragon City dragons you own, acquire, or can summon using Ditlep rankings.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Dragon Roster' }
};
export const viewport: Viewport = {width: 'device-width', initialScale: 1, themeColor: '#0c121e'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
