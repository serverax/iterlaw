/**
 * Sprint 18 — in-memory admin case review queue (web tier).
 *
 * Mirrors the shape of `legal_case_records` + approval workflow until
 * routes are wired to PostgreSQL `legal_case_approvals` (migration 109).
 */

export type AdminCaseWorkflowStatus =
  | "awaiting_approval"
  | "approved"
  | "rejected";

export interface AdminCaseSummary {
  id: string;
  title: string;
  primaryIssue: string;
  workspaceId: string;
  workflowStatus: AdminCaseWorkflowStatus;
}

export interface ApprovalHistoryEntry {
  id: string;
  caseId: string;
  approverId: string;
  status: "APPROVED" | "REJECTED";
  reason: string | null;
  createdAt: string;
}

const cases = new Map<string, AdminCaseSummary>();
const history: ApprovalHistoryEntry[] = [];
let idSeq = 0;

function nextHistoryId(): string {
  idSeq += 1;
  return `hist-${idSeq}`;
}

export function resetCaseApprovalQueueForTests(): void {
  cases.clear();
  history.length = 0;
}

export function seedDefaultAdminCases(): void {
  if (cases.size > 0) {
    return;
  }
  const demo: AdminCaseSummary[] = [
    {
      id: "case-demo-1",
      title: "Redundancy selection pool",
      primaryIssue: "redundancy",
      workspaceId: "ws-demo-1",
      workflowStatus: "awaiting_approval",
    },
    {
      id: "case-demo-2",
      title: "Grievance — bullying allegation",
      primaryIssue: "grievance",
      workspaceId: "ws-demo-2",
      workflowStatus: "awaiting_approval",
    },
    {
      id: "case-demo-3",
      title: "Settlement agreement review",
      primaryIssue: "settlement_agreement",
      workspaceId: "ws-demo-1",
      workflowStatus: "approved",
    },
  ];
  for (const c of demo) {
    cases.set(c.id, { ...c });
  }
}

export function listAdminCases(filter: "pending" | "all" = "all"): AdminCaseSummary[] {
  seedDefaultAdminCases();
  const all = [...cases.values()];
  if (filter === "pending") {
    return all.filter((c) => c.workflowStatus === "awaiting_approval");
  }
  return all.sort((a, b) => a.title.localeCompare(b.title));
}

export function getAdminCase(id: string): AdminCaseSummary | null {
  seedDefaultAdminCases();
  return cases.get(id) ?? null;
}

export function approveCase(caseId: string, approverId: string): AdminCaseSummary | null {
  seedDefaultAdminCases();
  const row = cases.get(caseId);
  if (!row || row.workflowStatus !== "awaiting_approval") {
    return null;
  }
  const updated: AdminCaseSummary = { ...row, workflowStatus: "approved" };
  cases.set(caseId, updated);
  history.unshift({
    id: nextHistoryId(),
    caseId,
    approverId,
    status: "APPROVED",
    reason: null,
    createdAt: new Date().toISOString(),
  });
  return updated;
}

export function rejectCase(caseId: string, approverId: string, reason: string): AdminCaseSummary | null {
  seedDefaultAdminCases();
  const row = cases.get(caseId);
  if (!row || row.workflowStatus !== "awaiting_approval") {
    return null;
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    return null;
  }
  const updated: AdminCaseSummary = { ...row, workflowStatus: "rejected" };
  cases.set(caseId, updated);
  history.unshift({
    id: nextHistoryId(),
    caseId,
    approverId,
    status: "REJECTED",
    reason: trimmed,
    createdAt: new Date().toISOString(),
  });
  return updated;
}

export function listApprovalHistory(): ApprovalHistoryEntry[] {
  seedDefaultAdminCases();
  return [...history];
}
