/**
 * One JSON object per line (structured logs for ingestion).
 */
export function logJsonRecord(record: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify(record));
  } catch {
    const rid =
      typeof record.requestId === "string" ? record.requestId : undefined;
    console.log(
      JSON.stringify({
        level: "error",
        message: "json_log_serialize_failed",
        requestId: rid,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
