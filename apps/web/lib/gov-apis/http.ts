import axios, { type AxiosInstance } from 'axios';

const rawRetries = Number(process.env.GOV_API_RETRY_COUNT ?? 1);
const RETRIES = Number.isFinite(rawRetries) ? Math.max(0, Math.floor(rawRetries)) : 1;

export function createTimeoutClient(timeoutMs: number): AxiosInstance {
  return axios.create({
    timeout: timeoutMs,
    validateStatus: (s) => s >= 200 && s < 400,
    headers: {
      Accept: 'application/json, text/plain;q=0.9,*/*;q=0.8',
      'User-Agent': 'IterLaw/0.1 (+https://github.com/serverax/iterlaw)',
    },
  });
}

/** At most `GOV_API_RETRY_COUNT` retries after the first attempt (default: 1 retry = 2 tries total). */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxAttempts = RETRIES + 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('withRetry failed');
}
