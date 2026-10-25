import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { VisitorTracker } from '@/components/visitor-tracker';
const sans = localFont({ src: '../../public/fonts/manrope.ttf', variable: '--font-sans', display: 'swap' });
const editorial = localFont({ src: '../../public/fonts/editorial-italic.ttf', variable: '--font-editorial', weight: '400', style: 'italic', display: 'swap' });
const title = 'LOTHUUS — Een huis voor cultuur en ontmoeting';
const description = 'Een huis voor cultuur en ontmoeting. Ontdek het levende archief van LOTHUUS VINTAGE: bijzondere objecten, verzameld met gevoel.';
const socialImage = {
  url: '/social/lothuus-social-v1.jpg',
  width: 1200,
  height: 630,
  alt: 'LOTHUUS — Een huis voor cultuur en ontmoeting, met de zonovergoten okergele gevel en karakteristieke zwarte voordeur.',
};
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.lothuus.be')),
  title,
  description,
  openGraph: {
    type: 'website',
    locale: 'nl_BE',
    siteName: 'LOTHUUS',
    title,
    description,
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [socialImage],
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl" className={`${sans.variable} ${editorial.variable}`}><body><VisitorTracker />{children}</body></html>;
}
