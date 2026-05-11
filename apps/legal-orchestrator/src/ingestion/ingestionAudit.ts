export type AuditEvent =
  | { type: "plan"; sourceKey?: string; urls: string[] }
  | { type: "fetch_error"; url: string; message: string }
  | { type: "persist_skipped"; reason: string }
  | { type: "persist_completed"; jobId: string; chunksWritten: number; jobSaved: boolean };

export class IngestionAudit {
  private readonly events: AuditEvent[] = [];

  constructor(private readonly mode: "off" | "memory" | "stdout") {}

  isEnabled(): boolean {
    return this.mode !== "off";
  }

  record(e: AuditEvent): void {
    if (this.mode === "off") return;
    this.events.push(e);
    if (this.mode === "stdout") {
      process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n");
    }
  }

  snapshot(): readonly AuditEvent[] {
    return this.events;
  }

  static fromEnv(): IngestionAudit {
    const a = process.env.INGESTION_AUDIT?.trim().toLowerCase();
    if (a === "1" || a === "true" || a === "stdout") return new IngestionAudit("stdout");
    if (a === "memory") return new IngestionAudit("memory");
    return new IngestionAudit("off");
  }
}
