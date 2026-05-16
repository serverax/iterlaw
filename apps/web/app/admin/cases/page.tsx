import Link from "next/link";
import { notFound } from "next/navigation";
import { listAdminCases } from "@/lib/admin/caseApprovalQueue";

export default function AdminCasesPage(): JSX.Element {
  if (process.env.ITERLAW_ADMIN_UI_ENABLED !== "1") {
    notFound();
  }
  const pending = listAdminCases("pending");
  const all = listAdminCases("all");
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-100">
      <nav className="text-sm text-slate-400">
        <Link href="/admin/dashboard" className="text-sky-400 underline">
          Dashboard
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Case approval queue</h1>
      <section>
        <h2 className="mb-2 text-lg text-slate-200">Pending</h2>
        <ul className="space-y-2 rounded border border-slate-800 bg-slate-950 p-3">
          {pending.length === 0 ? (
            <li className="text-sm text-slate-500">No cases awaiting approval.</li>
          ) : (
            pending.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/cases/${encodeURIComponent(c.id)}`} className="text-sky-400 hover:underline">
                  {c.title}
                </Link>
                <span className="ml-2 text-xs text-slate-500">
                  {c.primaryIssue} · {c.id}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg text-slate-200">All cases (read-only)</h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {all.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/cases/${encodeURIComponent(c.id)}`} className="text-sky-400 hover:underline">
                {c.title}
              </Link>{" "}
              <span className="text-slate-500">({c.workflowStatus})</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
