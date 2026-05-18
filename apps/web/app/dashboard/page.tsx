'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Button, Card, Badge } from '@/components/ui';

type CaseData = {
  situation_type: string;
  service_months: number;
  stage: string;
  created_at: string;
  questions_asked?: number;
  documents_uploaded?: number;
  timeline_events?: number;
};

export default function DashboardPage() {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchCaseData();
  }, []);

  async function fetchCaseData() {
    try {
      const response = await fetch('/api/case');
      if (response.ok) {
        const data = (await response.json()) as CaseData;
        setCaseData(data);
      }
    } catch {
      setCaseData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night">
        <p className="text-text-secondary">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-night">
      <Header />

      <Container className="py-12">
        <header className="mb-12">
          <h1 className="font-fraunces text-4xl font-bold text-text-primary">Your Case</h1>
          <p className="mt-2 text-text-secondary">
            {caseData
              ? `${caseData.situation_type} · ${caseData.service_months} months service`
              : 'No active case — start below'}
          </p>
        </header>

        {caseData ? (
          <>
            <Card className="mb-8">
              <header className="mb-6 flex items-start justify-between">
                <section>
                  <h2 className="mb-2 text-2xl font-bold text-text-primary">{caseData.situation_type}</h2>
                  <p className="text-text-secondary">
                    Started {new Date(caseData.created_at).toLocaleDateString('en-GB')}
                  </p>
                </section>
                <Badge label={caseData.stage} variant="info" />
              </header>
              <section className="grid grid-cols-3 gap-4 border-t border-steel pt-6">
                <article>
                  <p className="text-4xl font-bold text-gold">{caseData.questions_asked ?? 0}</p>
                  <p className="mt-1 text-sm text-text-secondary">Questions Asked</p>
                </article>
                <article>
                  <p className="text-4xl font-bold text-gold">{caseData.documents_uploaded ?? 0}</p>
                  <p className="mt-1 text-sm text-text-secondary">Documents</p>
                </article>
                <article>
                  <p className="text-4xl font-bold text-gold">{caseData.timeline_events ?? 0}</p>
                  <p className="mt-1 text-sm text-text-secondary">Timeline Events</p>
                </article>
              </section>
            </Card>

            <Card className="mb-8 border-gold/50 bg-gold/5">
              <section className="flex flex-wrap items-start justify-between gap-4">
                <section>
                  <h3 className="mb-2 font-bold text-text-primary">Next Step</h3>
                  <p className="text-text-secondary">Prepare your response statement</p>
                </section>
                <Button variant="primary" href="/next-step">
                  View Details →
                </Button>
              </section>
            </Card>

            <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Button variant="primary" size="lg" fullWidth href="/answer">
                Ask a Question
              </Button>
              <Button variant="secondary" size="lg" fullWidth href="/dashboard/documents">
                Upload Document
              </Button>
              <Button variant="secondary" size="lg" fullWidth href="/dashboard/timeline">
                View Timeline
              </Button>
            </section>

            <Card>
              <h3 className="mb-6 text-xl font-bold text-text-primary">Recent Activity</h3>
              <ul className="space-y-4">
                {['Asked about unfair dismissal rights', 'Uploaded disciplinary letter', 'Timeline updated'].map(
                  (text, i) => (
                    <li key={text} className="border-b border-steel pb-4 last:border-0">
                      <section className="flex items-start justify-between gap-4">
                        <section>
                          <p className="font-semibold text-text-primary">{text}</p>
                          <p className="text-sm text-text-secondary">{i + 1} days ago</p>
                        </section>
                        <Badge label="Recorded" variant="success" size="sm" />
                      </section>
                    </li>
                  )
                )}
              </ul>
            </Card>
          </>
        ) : (
          <Card className="p-12 text-center">
            <p className="mb-4 text-6xl">📋</p>
            <h2 className="mb-2 text-2xl font-bold text-text-primary">No active case</h2>
            <p className="mb-8 text-text-secondary">Start by telling us what is happening at work</p>
            <Button variant="primary" size="lg" href="/case/start">
              Start New Case
            </Button>
          </Card>
        )}
      </Container>
    </main>
  );
}
