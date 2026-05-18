export type AnalyticsEvent =
  | { name: 'answer_submitted'; properties?: { question_length: number } }
  | { name: 'paywall_shown'; properties?: { reason: string } }
  | { name: 'next_step_viewed'; properties?: Record<string, never> };

export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  const payload = { ...event, ts: new Date().toISOString() };
  console.debug('[analytics]', payload);
  try {
    window.localStorage.setItem(`analytics:${event.name}`, JSON.stringify(payload));
  } catch {
    // ignore quota errors in stub
  }
}
