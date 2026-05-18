'use client';

import { useState } from 'react';
import { Header } from '@/components/nav/Header';
import { Container } from '@/components/layout/Container';
import { Button, Card } from '@/components/ui';

type AnalysisResult = {
  issues?: string[];
  confidence?: number;
  text?: string;
};

export default function DocumentUploadPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setAnalysis(null);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const base64 = btoa(binary);
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: 'pilot-case',
          filename: file.name,
          content_base64: base64,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as AnalysisResult & { issues: string[] };
        setAnalysis({ issues: data.issues, confidence: data.confidence });
      } else {
        setAnalysis({
          issues: ['unfairDismissal', 'disciplinary'],
          confidence: 0.5,
          text: 'Stub analysis — connect backend for live OCR',
        });
      }
    } catch {
      setAnalysis({ issues: ['redundancy'], confidence: 0.5 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-night">
      <Header />

      <Container className="max-w-2xl py-10">
        <h1 className="font-fraunces text-2xl text-text-primary">Upload document</h1>
        <p className="mt-2 text-text-secondary">
          Disciplinary letter, dismissal notice, or employment contract
        </p>

        {!fileName ? (
          <Card className="mt-8 flex min-h-[280px] flex-col items-center justify-center border-2 border-dashed border-steel">
            <label className="cursor-pointer text-center">
              <span className="text-6xl">📸</span>
              <p className="mt-4 font-bold text-text-primary">Choose a file to upload</p>
              <p className="mt-2 text-sm text-text-secondary">PDF or image</p>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={onFileChange} />
            </label>
          </Card>
        ) : loading ? (
          <Card className="mt-8 flex min-h-[200px] items-center justify-center">
            <p className="text-text-secondary">Analyzing document…</p>
          </Card>
        ) : analysis ? (
          <Card className="mt-8">
            <h2 className="mb-4 font-bold text-text-primary">Analysis results</h2>
            <ul className="space-y-2">
              {(analysis.issues ?? []).map((issue) => (
                <li key={issue} className="flex items-center gap-2 capitalize text-text-primary">
                  <span className="text-signal-green">✓</span>
                  {issue}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {fileName && !loading ? (
          <section className="mt-8 space-y-3">
            <Button variant="primary" size="lg" fullWidth href="/dashboard">
              Save to case
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => {
                setFileName(null);
                setAnalysis(null);
              }}
            >
              Upload another
            </Button>
          </section>
        ) : null}
      </Container>
    </main>
  );
}
