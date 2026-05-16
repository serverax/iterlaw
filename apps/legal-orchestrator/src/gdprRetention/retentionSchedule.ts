const MS_PER_DAY = 86_400_000;

/**
 * End of UTC calendar day for an ISO timestamp (stable for retention math).
 */
export function utcDayStartMs(isoDate: string): number {
  const d = new Date(isoDate);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * First instant at which a row created at `createdAtIso` is eligible for purge
 * under a simple N-calendar-day retention from UTC day of creation.
 */
export function retentionDeadlineMs(createdAtIso: string, retentionDays: number): number {
  if (retentionDays <= 0 || !Number.isFinite(retentionDays)) {
    throw new Error("retentionDays must be a positive finite number");
  }
  return utcDayStartMs(createdAtIso) + retentionDays * MS_PER_DAY;
}

/** True when `nowMs` is at or after the retention deadline (inclusive). */
export function isRetentionExpired(createdAtIso: string, retentionDays: number, nowMs: number): boolean {
  return nowMs >= retentionDeadlineMs(createdAtIso, retentionDays);
}

/** Whole days remaining until deadline; 0 if expired or at boundary. */
export function wholeDaysUntilRetentionDeadline(createdAtIso: string, retentionDays: number, nowMs: number): number {
  const deadline = retentionDeadlineMs(createdAtIso, retentionDays);
  if (nowMs >= deadline) {
    return 0;
  }
  return Math.ceil((deadline - nowMs) / MS_PER_DAY);
}
