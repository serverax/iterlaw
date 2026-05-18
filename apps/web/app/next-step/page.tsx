import Link from 'next/link';

const STEPS = [
  { title: 'Record the facts', detail: 'Write dates, names, and what was said in meetings.' },
  { title: 'Check deadlines', detail: 'Employment tribunal limits are strict — note dismissal date.' },
  { title: 'Gather documents', detail: 'Contract, letters, payslips, and any disciplinary notes.' },
  { title: 'Consider ACAS', detail: 'Early conciliation is usually required before a tribunal claim.' },
];

export default function NextStepPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Your next steps</h1>
      <p className="mt-2 text-sm text-gray-600">
        Practical actions for tonight. This is general guidance, not legal advice.
      </p>
      <ol className="mt-6 space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-lg border border-gray-200 p-4">
            <span className="text-xs font-medium text-indigo-600">Step {i + 1}</span>
            <h2 className="mt-1 font-medium text-gray-900">{step.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{step.detail}</p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm">
        <Link href="/answer" className="text-indigo-600 underline">
          Back to Q&amp;A
        </Link>
      </p>
    </main>
  );
}
