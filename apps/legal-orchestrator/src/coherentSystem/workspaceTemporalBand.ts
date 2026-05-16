/** Half-open visibility: active when queryMs in [validFrom, validTo) or validTo null means open-ended. */
export function caseVisibleAt(validFromMs: number, validToMs: number | null, queryMs: number): boolean {
  if (queryMs < validFromMs) {
    return false;
  }
  if (validToMs === null) {
    return true;
  }
  return queryMs < validToMs;
}

/** Temporal overlap on half-open ranges [a0,a1) and [b0,b1). */
export function temporalHalfOpenOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}
