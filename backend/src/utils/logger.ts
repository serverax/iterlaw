export class Logger {
  constructor(private readonly scope: string) {}

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', scope: this.scope, message, ...meta }));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 'warn', scope: this.scope, message, ...meta }));
  }

  error(message: string, err?: unknown): void {
    console.error(JSON.stringify({ level: 'error', scope: this.scope, message, err: String(err) }));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(JSON.stringify({ level: 'debug', scope: this.scope, message, ...meta }));
    }
  }
}
