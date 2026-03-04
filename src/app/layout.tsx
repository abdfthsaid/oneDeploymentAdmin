import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Initializer from '@/components/Initializer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Danab Power Admin',
  description: 'Power Bank Rental Management Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Initializer>{children}</Initializer>
      </body>
    </html>
  );
}
