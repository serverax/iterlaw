type Level = "info" | "error";

function line(level: Level, msg: string, meta?: unknown): void {
  const ts = new Date().toISOString();
  const suffix = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  const out = `[${ts}] [orchestrator] [${level.toUpperCase()}] ${msg}${suffix}`;
  if (level === "error") {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const logger = {
  info(msg: string, meta?: unknown): void {
    line("info", msg, meta);
  },
  error(msg: string, meta?: unknown): void {
    line("error", msg, meta);
  },
};
