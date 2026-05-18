import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';
import { MobileNav } from '@/components/nav/MobileNav';

export interface HeaderProps {
  brand?: string;
}

export function Header({ brand = 'RightsNow' }: HeaderProps) {
  return (
    <nav className="sticky top-0 z-40 border-b border-steel bg-slate/80 backdrop-blur">
      <Container className="relative flex items-center justify-between py-4">
        <Link href="/" className="font-fraunces text-2xl font-bold text-gold">
          {brand}
        </Link>
        <section className="hidden items-center gap-4 md:flex">
          <Link href="/auth/login" className="text-text-secondary hover:text-text-primary">
            Sign In
          </Link>
          <Button variant="primary" href="/dashboard">
            Get Started
          </Button>
        </section>
        <MobileNav />
      </Container>
    </nav>
  );
}
