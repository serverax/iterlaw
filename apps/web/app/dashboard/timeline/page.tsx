'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui';

type TimelineEntry = {
  description: string;
  created_at: string;
};

const DEMO_TIMELINE: TimelineEntry[] = [
  { description: 'Received disciplinary invitation letter', created_at: '2026-05-10T09:00:00Z' },
  { description: 'Attended disciplinary hearing', created_at: '2026-05-12T14:00:00Z' },
  { description: 'Dismissal confirmed in writing', created_at: '2026-05-14T16:30:00Z' },
];

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    void fetchTimeline();
  }, []);

  async function fetchTimeline() {
    try {
      const response = await fetch('/api/case/timeline');
      if (response.ok) {
        const data = (await response.json()) as TimelineEntry[];
        setTimeline(Array.isArray(data) ? data : []);
        return;
      }
    } catch {
      // API route may not exist yet
    }
    setTimeline(DEMO_TIMELINE);
  }

  return (
    <main className="min-h-screen bg-night">
      <Header />

      <Container className="max-w-4xl py-12">
        <h1 className="mb-12 font-fraunces text-4xl font-bold text-text-primary">Case Timeline</h1>

        {timeline.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-text-secondary">No timeline events yet</p>
          </Card>
        ) : (
          <ul className="space-y-6">
            {timeline.map((entry, idx) => (
              <li key={`${entry.created_at}-${idx}`}>
                <Card variant="interactive">
                  <section className="flex gap-6">
                    <section className="flex flex-col items-center">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold">
                        {idx + 1}
                      </span>
                      {idx < timeline.length - 1 ? (
                        <span className="mt-2 h-16 w-px bg-steel" />
                      ) : null}
                    </section>
                    <section className="flex-1 pb-4">
                      <p className="font-semibold text-text-primary">{entry.description}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {new Date(entry.created_at).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </section>
                  </section>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
