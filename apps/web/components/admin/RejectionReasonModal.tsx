"use client";

import { useState } from "react";

export interface RejectionReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectionReasonModal({ open, onClose, onConfirm }: RejectionReasonModalProps): JSX.Element | null {
  const [reason, setReason] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="rejection-modal">
      <div className="w-full max-w-md rounded border border-slate-600 bg-slate-950 p-4 shadow-xl">
        <h3 className="text-base font-semibold text-slate-100">Reject case</h3>
        <p className="mt-1 text-sm text-slate-400">Provide a short reason for the audit log.</p>
        <textarea
          className="mt-3 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          data-testid="rejection-reason-input"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-rose-800 px-3 py-1.5 text-sm text-white hover:bg-rose-700"
            data-testid="rejection-confirm"
            onClick={() => {
              onConfirm(reason);
              setReason("");
            }}
          >
            Confirm reject
          </button>
        </div>
      </div>
    </div>
  );
}
