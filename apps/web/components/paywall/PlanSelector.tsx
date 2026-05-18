'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export type PlanId = 'essential' | 'active';

const PLANS = {
  essential: {
    name: 'Essential',
    price: '£4.99',
    period: '/month',
    features: ['30 questions per month', '5 document uploads', 'Deadline alerts'],
  },
  active: {
    name: 'Active Case',
    price: '£9.99',
    period: '/month',
    features: ['Unlimited questions', 'Unlimited uploads', 'Solicitor referral', 'Case summary PDF'],
  },
} as const;

export interface PlanSelectorProps {
  selected: PlanId;
  onSelect: (plan: PlanId) => void;
}

export function PlanSelector({ selected, onSelect }: PlanSelectorProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(([id, plan]) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            'rounded-lg border p-6 text-left transition',
            selected === id ? 'border-gold bg-gold/10' : 'border-steel bg-slate hover:border-gold/50'
          )}
        >
          <header className="mb-3 flex items-start justify-between">
            <span className="text-body-lg font-semibold text-text-primary">{plan.name}</span>
            {selected === id ? <Badge label="Selected" variant="success" /> : null}
          </header>
          <p className="mb-3">
            <span className="font-fraunces text-3xl font-bold text-gold">{plan.price}</span>
            <span className="text-text-secondary">{plan.period}</span>
          </p>
          <ul className="space-y-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-body-sm text-text-secondary">
                <span className="text-signal-green">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </button>
      ))}
    </section>
  );
}

export { PLANS };
