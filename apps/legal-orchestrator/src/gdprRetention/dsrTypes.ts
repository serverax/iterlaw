export const GDPR_REQUEST_TYPES = ["EXPORT", "ERASURE", "RECTIFICATION"] as const;
export type GdprRequestType = (typeof GDPR_REQUEST_TYPES)[number];

export const GDPR_REQUEST_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const;
export type GdprRequestStatus = (typeof GDPR_REQUEST_STATUSES)[number];

export function isGdprRequestType(v: string): v is GdprRequestType {
  return (GDPR_REQUEST_TYPES as readonly string[]).includes(v);
}

export function isGdprRequestStatus(v: string): v is GdprRequestStatus {
  return (GDPR_REQUEST_STATUSES as readonly string[]).includes(v);
}
