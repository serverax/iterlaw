import Link from "next/link";
import { notFound } from "next/navigation";

export default function AdminDashboardPage(): JSX.Element {
  if (process.env.ITERLAW_ADMIN_UI_ENABLED !== "1") {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-slate-100">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <p className="text-sm text-slate-400">Sprint 18 — legal review surfaces (Zone 1).</p>
      <ul className="list-inside list-disc text-sky-300">
        <li>
          <Link href="/admin/cases" className="underline hover:text-sky-200">
            Case approval queue
          </Link>
        </li>
        <li>
          <Link href="/admin/history" className="underline hover:text-sky-200">
            Approval history
          </Link>
        </li>
      </ul>
    </main>
  );
}
