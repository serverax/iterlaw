export type AiModelId = 'gemini-flash' | 'claude-sonnet' | 'gate-gemini';

export interface AiCostLog {
  model: AiModelId;
  questionType: 'classification' | 'answer_simple' | 'answer_complex';
  promptTokens?: number;
  completionTokens?: number;
  /** Rough GBP estimate for observability (not invoicing). */
  estCostGbp: number;
}

const logs: AiCostLog[] = [];

/** Very rough marginal costs for logging / dashboards (spec order-of-magnitude). */
export const COST_PER_SIMPLE_CALL_GBP = 0.00018;
export const COST_PER_COMPLEX_CALL_GBP = 0.0056;

export function logAiCall(entry: AiCostLog): void {
  logs.push(entry);
  console.info('[ai-cost]', entry);
}

export function resetAiCostLogs(): void {
  logs.length = 0;
}

export function getAiCostLogs(): readonly AiCostLog[] {
  return logs;
}

export function getMonthlyAiCostSummary(): {
  calls: number;
  totalEstGbp: number;
  byModel: Record<string, number>;
} {
  const byModel: Record<string, number> = {};
  let total = 0;
  for (const l of logs) {
    total += l.estCostGbp;
    byModel[l.model] = (byModel[l.model] ?? 0) + l.estCostGbp;
  }
  return { calls: logs.length, totalEstGbp: Number(total.toFixed(6)), byModel };
}
