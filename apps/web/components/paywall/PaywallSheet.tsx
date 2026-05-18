'use client';

type PaywallSheetProps = {
  open: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
};

export function PaywallSheet({ open, onClose, onUpgrade }: PaywallSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-label="Upgrade to continue"
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-gray-900">Continue with Essential</h2>
        <p className="mt-2 text-sm text-gray-600">
          You have reached the free question limit. Upgrade for unlimited guided answers and case
          tools.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm"
            onClick={onClose}
          >
            Not now
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
            onClick={onUpgrade ?? onClose}
          >
            View plans
          </button>
        </div>
      </div>
    </div>
  );
}
