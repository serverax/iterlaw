import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminCase } from "@/lib/admin/caseApprovalQueue";

export default async function AdminCaseDetailPage(props: { params: Promise<{ id: string }> }): Promise<JSX.Element> {
  if (process.env.ITERLAW_ADMIN_UI_ENABLED !== "1") {
    notFound();
  }
  const { id } = await props.params;
  const row = getAdminCase(decodeURIComponent(id));
  if (!row) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-slate-100">
      <nav className="text-sm text-slate-400">
        <Link href="/admin/cases" className="text-sky-400 underline">
          Cases
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">{row.title}</h1>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-slate-500">Id</dt>
        <dd className="font-mono text-xs">{row.id}</dd>
        <dt className="text-slate-500">Primary issue</dt>
        <dd>{row.primaryIssue}</dd>
        <dt className="text-slate-500">Workspace</dt>
        <dd className="font-mono text-xs">{row.workspaceId}</dd>
        <dt className="text-slate-500">Workflow</dt>
        <dd>{row.workflowStatus}</dd>
      </dl>
      <p className="text-xs text-slate-500">
        Approve or reject via secured API routes (`POST /api/cases/:id/approve` or `.../reject`) using
        `Authorization: Bearer` and `ITERLAW_ADMIN_API_TOKEN`.
      </p>
    </main>
  );
}
