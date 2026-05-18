'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PaywallSheet } from '@/components/paywall/PaywallSheet';

const FREE_QUESTION_LIMIT = 3;

export default function AnswerPage() {
  const [question, setQuestion] = useState('');
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const submit = () => {
    if (!question.trim()) return;
    if (questionsUsed >= FREE_QUESTION_LIMIT) {
      setPaywallOpen(true);
      return;
    }
    setQuestionsUsed((n) => n + 1);
    setAnswer(
      'This is a preview answer. Official sources are queried first; upgrade for full case guidance.'
    );
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
      <PaywallSheet
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onUpgrade={() => {
          setPaywallOpen(false);
          window.location.href = '/dashboard';
        }}
      />
    </main>
  );
}
