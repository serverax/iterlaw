import type { Metadata } from 'next';
import { ReduxProvider } from '@/components/providers/ReduxProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'IterLaw',
  description: 'UK employment law assistant — official sources first.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
