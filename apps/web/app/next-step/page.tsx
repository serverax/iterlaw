import Link from 'next/link';
import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { NextSteps } from '@/components/case/NextSteps';

export default function NextStepPage() {
  return (
    <main className="min-h-screen bg-night">
      <Header />

      <Container className="max-w-2xl py-10">
        <p className="mb-2 text-body-sm text-text-tertiary">General guidance — not legal advice</p>
        <h1 className="font-fraunces text-h1 text-text-primary">Your next steps</h1>

        <section className="mt-8">
          <NextSteps stage="formal" />
        </section>

        <footer className="mt-10">
          <Button variant="primary" size="lg" fullWidth href="/answer">
            Ask a question about this
          </Button>
          <p className="mt-6 text-center text-body-sm">
            <Link href="/answer" className="text-gold hover:underline">
              ← Back to Q&amp;A
            </Link>
          </p>
        </footer>
      </Container>
    </main>
  );
}
