import type { ApprovalHistoryEntry } from "@/lib/admin/caseApprovalQueue";

export interface ApprovalHistoryListProps {
  entries: ApprovalHistoryEntry[];
}

export function ApprovalHistoryList({ entries }: ApprovalHistoryListProps): JSX.Element {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500" data-testid="approval-history-empty">No approvals yet.</p>;
  }
  return (
    <table className="w-full text-left text-sm text-slate-200" data-testid="approval-history-table">
      <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
        <tr>
          <th className="py-2 pr-2">When</th>
          <th className="py-2 pr-2">Case</th>
          <th className="py-2 pr-2">Approver</th>
          <th className="py-2 pr-2">Status</th>
          <th className="py-2">Reason</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id} className="border-b border-slate-800">
            <td className="py-2 pr-2 font-mono text-xs text-slate-400">{e.createdAt}</td>
            <td className="py-2 pr-2 font-mono text-xs">{e.caseId}</td>
            <td className="py-2 pr-2">{e.approverId}</td>
            <td className="py-2 pr-2">{e.status}</td>
            <td className="py-2 text-slate-400">{e.reason ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
