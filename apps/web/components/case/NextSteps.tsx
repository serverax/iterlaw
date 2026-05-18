import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type DisputeStage = 'initial' | 'formal' | 'hearing' | 'appeal' | 'tribunal';

export const STAGE_GUIDANCE: Record<
  DisputeStage,
  { title: string; action: string; steps: string[] }
> = {
  initial: {
    title: 'Initial Concerns',
    action: 'Document Everything',
    steps: [
      'Note dates, times, and witnesses',
      'Gather written evidence (emails, messages)',
      'Review your employment contract',
    ],
  },
  formal: {
    title: 'Formal Process',
    action: 'Prepare Response',
    steps: [
      'Get formal letter in writing',
      'Understand all allegations',
      'Prepare detailed response',
    ],
  },
  hearing: {
    title: 'Hearing Scheduled',
    action: 'Prepare for Hearing',
    steps: ['Notify your representative', 'Write your statement', 'Plan questions for witnesses'],
  },
  appeal: {
    title: 'Appeal Lodged',
    action: 'Submit Appeal',
    steps: ['Provide new evidence', 'Identify procedural errors', 'Prepare appeal statement'],
  },
  tribunal: {
    title: 'Tribunal Consideration',
    action: 'File ET1 Form',
    steps: ['Note ACAS contact details', 'Gather all evidence', 'File within 3-month deadline'],
  },
};

export function NextSteps({ stage = 'initial' }: { stage?: DisputeStage }) {
  const guidance = STAGE_GUIDANCE[stage] ?? STAGE_GUIDANCE.initial;

  return (
    <>
      <Card variant="alert" className="mb-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <section>
            <h2 className="font-fraunces text-h2 text-text-primary">{guidance.title}</h2>
            <p className="mt-2 text-text-secondary">Recommended action for this stage</p>
          </section>
          <Badge label={guidance.action} variant="warning" size="md" />
        </header>
      </Card>

      <h3 className="mb-4 font-dm-sans text-h3 text-text-primary">Steps to take</h3>
      <ol className="space-y-3">
        {guidance.steps.map((step, idx) => (
          <Card key={step} variant="interactive">
            <p className="flex items-center gap-3">
              <span className="font-bold text-gold">{idx + 1}.</span>
              <span className="text-text-primary">{step}</span>
            </p>
          </Card>
        ))}
      </ol>
    </>
  );
}
