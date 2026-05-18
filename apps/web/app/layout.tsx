import type { Metadata } from 'next';
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { ReduxProvider } from '@/components/providers/ReduxProvider';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['300', '400', '600'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'RightsNow — UK employment law, when you need it',
  description: 'Official UK Government sources first. Know your rights. Right now.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${fraunces.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
