'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export interface AnswerCardProps {
  law: string;
  meaning: string;
  action: string;
  source: string;
  sourceUrl: string;
  confidence: number;
  onHelpful?: () => void;
}

export function AnswerCard({
  law,
  meaning,
  action,
  source,
  sourceUrl,
  confidence,
  onHelpful,
}: AnswerCardProps) {
  return (
    <Card className="space-y-8">
      <section>
        <header className="mb-3 flex items-center gap-2">
          <Badge label="WHAT THE LAW SAYS" variant="info" />
        </header>
        <p className="text-base leading-relaxed text-text-primary">{law}</p>
      </section>

      <hr className="h-px border-0 bg-steel" />

      <section>
        <header className="mb-3 flex items-center gap-2">
          <Badge label="WHAT THIS MEANS FOR YOU" variant="success" />
        </header>
        <p className="text-base leading-relaxed text-text-primary">{meaning}</p>
      </section>

      <hr className="h-px border-0 bg-steel" />

      <section>
        <header className="mb-3 flex items-center gap-2">
          <Badge label="WHAT TO DO TONIGHT" variant="warning" />
        </header>
        <p className="text-base font-semibold text-text-primary">{action}</p>
      </section>

      <footer className="flex items-center justify-between border-t border-steel pt-6">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-gold transition-colors hover:text-gold/80"
        >
          <span aria-hidden>📖</span>
          <span>{source}</span>
          <span aria-hidden>→</span>
        </a>
        <span className="text-xs text-text-tertiary">
          Confidence: {Math.round(confidence * 100)}%
        </span>
      </footer>

      {onHelpful ? (
        <footer className="border-t border-steel pt-4">
          <button
            type="button"
            onClick={onHelpful}
            className="text-sm text-text-secondary transition-colors hover:text-gold"
          >
            Was this helpful?
          </button>
        </footer>
      ) : null}
    </Card>
  );
}
