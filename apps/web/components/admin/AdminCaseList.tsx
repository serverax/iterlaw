import type { AdminCaseSummary } from "@/lib/admin/caseApprovalQueue";

export interface AdminCaseListProps {
  cases: AdminCaseSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AdminCaseList({ cases, selectedId, onSelect }: AdminCaseListProps): JSX.Element {
  return (
    <ul className="divide-y rounded border border-slate-700 bg-slate-950" data-testid="admin-case-list">
      {cases.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-900 ${
              selectedId === c.id ? "bg-slate-900 ring-1 ring-amber-600/60" : ""
            }`}
            onClick={() => onSelect(c.id)}
          >
            <span className="font-medium text-slate-100">{c.title}</span>
            <span className="text-xs text-slate-400">
              {c.primaryIssue} · {c.workflowStatus}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
