export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  console.log(`[Analytics] ${event}`, properties);
}
