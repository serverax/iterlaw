'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';
import { trackEvent } from '@/lib/analytics';

const FREE_QUESTION_LIMIT = 3;

export default function AnswerPage() {
  const [question, setQuestion] = useState('');
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerDisplayed, setAnswerDisplayed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const submit = () => {
    if (!question.trim()) return;

    const preview =
      'This is a preview answer. Official sources are queried first; upgrade for full case guidance.';
    setAnswer(preview);
    setAnswerDisplayed(true);
    trackEvent('answer_submitted', { question_length: question.length });

    setQuestionsUsed((n) => n + 1);
    if (questionsUsed + 1 > FREE_QUESTION_LIMIT) {
      setTimeout(() => {
        setShowPaywall(true);
        trackEvent('paywall_shown', { reason: 'free_limit' });
      }, 500);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Ask a question</h1>
      <p className="mt-1 text-sm text-gray-600">
        Free questions remaining: {Math.max(0, FREE_QUESTION_LIMIT - questionsUsed)}
      </p>
      <textarea
        className="mt-4 w-full rounded-lg border border-gray-300 p-3 text-sm"
        rows={4}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Describe your employment situation…"
      />
      <button
        type="button"
        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
        onClick={submit}
      >
        Get answer
      </button>

      {answer ? (
        <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
          {answer}
          <p className="mt-4">
            <Link href="/next-step" className="text-indigo-600 underline">
              What should I do next?
            </Link>
          </p>
        </section>
      ) : null}

      {answerDisplayed && showPaywall ? (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <PaywallSheet
            open
            onClose={() => setShowPaywall(false)}
            onUpgrade={() => {
              setShowPaywall(false);
              window.location.href = '/dashboard';
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
