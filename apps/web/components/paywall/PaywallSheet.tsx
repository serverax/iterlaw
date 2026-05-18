'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface PaywallSheetProps {
  onSubscribe?: () => void;
  open?: boolean;
  onClose?: () => void;
  variant?: 'inline' | 'modal';
}

const PLANS = {
  essential: {
    name: 'Essential',
    price: '£4.99',
    period: '/month',
    features: ['30 questions per month', '5 document uploads', 'Deadline alerts', 'Case timeline'],
  },
  active: {
    name: 'Active Case',
    price: '£9.99',
    period: '/month',
    features: [
      'Unlimited questions',
      'Unlimited uploads',
      'Solicitor referral',
      'Case summary PDF',
    ],
  },
} as const;

type PlanId = keyof typeof PLANS;

export function PaywallSheet({
  onSubscribe,
  open = true,
  onClose,
  variant = 'inline',
}: PaywallSheetProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('essential');

  if (!open) return null;

  const content = (
    <Card className="border-gold/50">
      <header className="mb-8">
        <h3 className="font-fraunces text-2xl font-bold text-text-primary">Upgrade to continue</h3>
        <p className="mt-2 text-text-secondary">You have used your free questions for this month</p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(([key, plan]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedPlan(key)}
            className={`rounded-lg border p-6 text-left transition-all ${
              selectedPlan === key
                ? 'border-gold bg-gold/10'
                : 'border-steel bg-slate hover:border-gold/50'
            }`}
          >
            <header className="mb-4 flex items-start justify-between">
              <h4 className="text-lg font-bold text-text-primary">{plan.name}</h4>
              {selectedPlan === key ? <Badge label="Selected" variant="success" size="sm" /> : null}
            </header>
            <p className="mb-4">
              <span className="text-3xl font-bold text-gold">{plan.price}</span>
              <span className="ml-2 text-text-secondary">{plan.period}</span>
            </p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="text-signal-green">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </section>

      <Button variant="primary" size="lg" fullWidth onClick={onSubscribe ?? onClose}>
        Continue with {PLANS[selectedPlan].name}
      </Button>
      <p className="mt-6 text-center text-xs text-text-tertiary">
        Secure payment via Stripe · Cancel any time · No lock-in
      </p>
    </Card>
  );

  if (variant === 'modal') {
    return (
      <section className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-4 sm:items-center">
        {content}
      </section>
    );
  }

  return content;
}
