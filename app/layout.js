import { Baloo_Bhaijaan_2, Readex_Pro } from 'next/font/google';
import './globals.css';

const display = Baloo_Bhaijaan_2({ subsets: ['arabic', 'latin'], weight: ['600', '800'], variable: '--font-display', display: 'swap' });
const body = Readex_Pro({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'بيري سويرل بارفيه | منز',
  description: 'بارفيه منز المميز: آيس كريم فانيلا وكومبوت توت وكرامبل مقرمش وكريمة مخفوقة وحبة كرز. افتح الطبقات وتعرّف على كل واحدة.',
  icons: { icon: '/brand/favicon.svg' },
};

export const viewport = {
  themeColor: '#30133c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
