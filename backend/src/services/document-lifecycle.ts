/**
 * Document image lifecycle — schedule original image/blob deletion after 24 hours.
 */

export type PendingDeletion = {
  id: string;
  deleteAt: number;
  onDelete: () => void | Promise<void>;
};

const pending = new Map<string, PendingDeletion>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function scheduleDocumentImageDeletion(
  documentId: string,
  onDelete: () => void | Promise<void>,
  uploadedAt: Date = new Date()
): void {
  const deleteAt = uploadedAt.getTime() + TWENTY_FOUR_HOURS_MS;
  const delay = Math.max(0, deleteAt - Date.now());

  const existing = timers.get(documentId);
  if (existing) clearTimeout(existing);

  pending.set(documentId, { id: documentId, deleteAt, onDelete });

  const timer = setTimeout(() => {
    void runDeletion(documentId);
  }, delay);
  timers.set(documentId, timer);
}

export async function runDeletion(documentId: string): Promise<boolean> {
  const entry = pending.get(documentId);
  if (!entry) return false;
  try {
    await entry.onDelete();
  } finally {
    pending.delete(documentId);
    const t = timers.get(documentId);
    if (t) clearTimeout(t);
    timers.delete(documentId);
  }
  return true;
}

export function getPendingDeletionCount(): number {
  return pending.size;
}

export function startDocumentLifecycleSweep(intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of pending) {
      if (entry.deleteAt <= now) void runDeletion(id);
    }
  }, intervalMs);
}
