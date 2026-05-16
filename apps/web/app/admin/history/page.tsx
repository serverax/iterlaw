import Link from "next/link";
import { notFound } from "next/navigation";
import { listApprovalHistory } from "@/lib/admin/caseApprovalQueue";
import { ApprovalHistoryList } from "@/components/admin/ApprovalHistoryList";

export default function AdminHistoryPage(): JSX.Element {
  if (process.env.ITERLAW_ADMIN_UI_ENABLED !== "1") {
    notFound();
  }
  const entries = listApprovalHistory();
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6 text-slate-100">
      <nav className="text-sm text-slate-400">
        <Link href="/admin/dashboard" className="text-sky-400 underline">
          Dashboard
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Approval history</h1>
      <ApprovalHistoryList entries={entries} />
    </main>
  );
}
