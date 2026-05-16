import type { AdminCaseSummary } from "@/lib/admin/caseApprovalQueue";

export interface AdminCaseDetailProps {
  caseRow: AdminCaseSummary | null;
  onApprove: () => void;
  onRequestReject: () => void;
}

export function AdminCaseDetail({ caseRow, onApprove, onRequestReject }: AdminCaseDetailProps): JSX.Element {
  if (!caseRow) {
    return (
      <div className="rounded border border-dashed border-slate-600 p-4 text-sm text-slate-400" data-testid="admin-case-detail-empty">
        Select a case to review.
      </div>
    );
  }
  const canAct = caseRow.workflowStatus === "awaiting_approval";
  return (
    <div className="space-y-3 rounded border border-slate-700 bg-slate-950 p-4" data-testid="admin-case-detail">
      <h2 className="text-lg font-semibold text-slate-100">{caseRow.title}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm text-slate-300">
        <dt className="text-slate-500">Case id</dt>
        <dd className="font-mono text-xs">{caseRow.id}</dd>
        <dt className="text-slate-500">Primary issue</dt>
        <dd>{caseRow.primaryIssue}</dd>
        <dt className="text-slate-500">Workspace</dt>
        <dd className="font-mono text-xs">{caseRow.workspaceId}</dd>
        <dt className="text-slate-500">Workflow</dt>
        <dd data-testid="workflow-status">{caseRow.workflowStatus}</dd>
      </dl>
      {canAct ? (
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
            onClick={onApprove}
            data-testid="btn-approve"
          >
            Approve
          </button>
          <button
            type="button"
            className="rounded bg-rose-900 px-3 py-1.5 text-sm text-white hover:bg-rose-800"
            onClick={onRequestReject}
            data-testid="btn-reject"
          >
            Reject…
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No approval actions for this state.</p>
      )}
    </div>
  );
}
