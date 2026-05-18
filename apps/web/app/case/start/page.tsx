'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SITUATIONS = [
  { id: 'disciplinary', icon: '📋', label: 'Disciplinary Hearing', desc: 'Formal process started' },
  { id: 'dismissal', icon: '🚪', label: 'Dismissal / Redundancy', desc: 'Job termination' },
  { id: 'discrimination', icon: '⚖️', label: 'Discrimination', desc: 'Unfair treatment' },
  { id: 'suspension', icon: '🛑', label: 'Suspension', desc: 'Temporary suspension' },
  { id: 'grievance', icon: '📢', label: 'Grievance', desc: 'Formal complaint' },
  { id: 'whistleblowing', icon: '🔔', label: 'Whistleblowing', desc: 'Protected disclosure' },
];

const JURISDICTIONS = ['England & Wales', 'Scotland', 'Northern Ireland'];

export default function CaseStartPage() {
  const router = useRouter();
  const [step, setStep] = useState<'situation' | 'details'>('situation');
  const [situation, setSituation] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState<string | null>(null);
  const [serviceMonths, setServiceMonths] = useState('');
  const [freetext, setFreetext] = useState('');

  if (step === 'situation') {
    return (
      <main className="min-h-screen bg-night">
        <Header />
        <Container className="max-w-2xl py-10">
          <h1 className="font-fraunces text-3xl text-text-primary">What&apos;s happening to you?</h1>
          <p className="mt-2 text-text-secondary">
            Choose the situation that best describes your workplace issue.
          </p>
          <ul className="mt-8 space-y-4">
            {SITUATIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSituation(s.id);
                    setStep('details');
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    situation === s.id ? 'border-gold bg-gold/20' : 'border-steel bg-steel hover:border-gold/50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-3xl">{s.icon}</span>
                    <span>
                      <span className="block font-bold text-text-primary">{s.label}</span>
                      <span className="text-xs text-text-secondary">{s.desc}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Container>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-night">
      <Header />
      <Container className="max-w-2xl py-10">
        <h1 className="font-fraunces text-2xl text-text-primary">Tell us more</h1>

        <p className="mt-8 font-bold text-text-primary">Which jurisdiction?</p>
        <ul className="mt-3 space-y-2">
          {JURISDICTIONS.map((j) => (
            <li key={j}>
              <button
                type="button"
                onClick={() => setJurisdiction(j)}
                className={`w-full rounded-md border p-4 text-left ${
                  jurisdiction === j ? 'border-gold bg-gold/20 text-gold' : 'border-steel bg-slate text-text-primary'
                }`}
              >
                {j}
              </button>
            </li>
          ))}
        </ul>

        <section className="mt-8">
          <Input
            type="number"
            label="How long have you worked there? (months)"
            placeholder="e.g. 24"
            value={serviceMonths}
            onChange={(e) => setServiceMonths(e.target.value)}
          />
        </section>

        <section className="mt-6">
          <Input
            type="textarea"
            label="What is your main concern?"
            placeholder="E.g. My manager said I would be dismissed without a proper hearing"
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            rows={4}
          />
        </section>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-8"
          disabled={!jurisdiction || !serviceMonths}
          onClick={() => router.push(`/answer?situation=${situation ?? 'general'}`)}
        >
          Get answer
        </Button>
      </Container>
    </main>
  );
}
