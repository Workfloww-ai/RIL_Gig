import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SahYogi Finance Dashboard',
  description: 'SahYogi Finance Management Dashboard',
  icons: {
    icon: '/images/logo.jpeg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-sand text-slate min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
