import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const sans = localFont({ src: '../../public/fonts/manrope.ttf', variable: '--font-sans', display: 'swap' });
const editorial = localFont({ src: '../../public/fonts/editorial-italic.ttf', variable: '--font-editorial', weight: '400', style: 'italic', display: 'swap' });
export const metadata: Metadata = {
  title: 'LOTHUUS — Een huis voor cultuur en ontmoeting',
  description: 'Een huis voor cultuur en ontmoeting. Ontdek het levende archief van LOTHUUS VINTAGE: bijzondere objecten, verzameld met gevoel.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl" className={`${sans.variable} ${editorial.variable}`}><body>{children}</body></html>;
}
