'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnswerCard } from '@/components/answer/AnswerCard';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { trackEvent } from '@/lib/analytics';

const DEMO_ANSWER = {
  law: 'The Employment Rights Act 1996 gives employees with at least two years of service the right not to be unfairly dismissed.',
  meaning:
    'If you have worked for your employer for two years or more, a dismissal may be unfair without a fair reason and process.',
  action: 'Write down the exact date of dismissal and save every letter from your employer.',
  source: 'legislation.gov.uk — ERA 1996',
  sourceUrl: 'https://www.legislation.gov.uk/ukpga/1996/18/contents',
  confidence: 0.92,
};

function AnswerPageContent() {
  const searchParams = useSearchParams();
  const questionId = searchParams.get('q');

  const [answer, setAnswer] = useState<typeof DEMO_ANSWER | null>(null);
  const [loading, setLoading] = useState(Boolean(questionId));
  const [answerDisplayed, setAnswerDisplayed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (questionId) void fetchAnswer(questionId);
    else setLoading(false);
  }, [questionId]);

  async function fetchAnswer(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/answer/${id}`);
      if (response.ok) {
        const data = (await response.json()) as typeof DEMO_ANSWER;
        setAnswer(data);
      } else {
        setAnswer(DEMO_ANSWER);
      }
    } catch {
      setAnswer(DEMO_ANSWER);
    } finally {
      setLoading(false);
    }
  }

  function handleHelpful() {
    setAnswerDisplayed(true);
    trackEvent('answer_submitted', { question_id: questionId ?? 'demo' });
    setTimeout(() => setShowPaywall(true), 500);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night">
        <section className="text-center">
          <p className="animate-spin text-4xl">⟳</p>
          <p className="mt-4 text-text-secondary">Loading your answer…</p>
        </section>
      </main>
    );
  }

  const display = answer ?? DEMO_ANSWER;

  return (
    <main className="min-h-screen bg-night">
      <Header />

      <Container className="max-w-3xl py-12">
        <header className="mb-4 flex items-center gap-2">
          <Badge label="ANSWER" variant="success" />
          <span className="text-xs text-text-tertiary">Just now</span>
        </header>

        <AnswerCard {...display} onHelpful={handleHelpful} />

        <section className="mb-8 mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Button variant="primary" size="lg" fullWidth href="/dashboard">
            Save to Case
          </Button>
          <Button variant="secondary" size="lg" fullWidth href="/case/start">
            Ask Another Question
          </Button>
        </section>

        <p className="text-center">
          <Link href="/next-step" className="text-gold hover:underline">
            What should I do next? →
          </Link>
        </p>

        {answerDisplayed && showPaywall ? (
          <section className="mt-8">
            <PaywallSheet onSubscribe={() => setShowPaywall(false)} />
          </section>
        ) : null}

        {!questionId ? (
          <section className="mt-12 rounded-lg border border-steel bg-slate p-6">
            <p className="text-text-secondary">
              Demo answer shown. Start from{' '}
              <Link href="/case/start" className="text-gold underline">
                case intake
              </Link>{' '}
              or pass <code>?q=</code> with an answer id.
            </p>
            <Button variant="primary" className="mt-4" href="/case/start">
              Start case intake
            </Button>
          </section>
        ) : null}
      </Container>
    </main>
  );
}

export default function AnswerPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-night">
          <p className="text-text-secondary">Loading…</p>
        </main>
      }
    >
      <AnswerPageContent />
    </Suspense>
  );
}
