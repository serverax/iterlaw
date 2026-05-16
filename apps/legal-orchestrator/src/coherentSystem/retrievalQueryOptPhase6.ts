import type { Zone2OptimizedQueryPlan, Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export interface PlanActualCompare {
  readonly estRows: number;
  readonly actualRows: number;
  readonly ratio: number | null;
}

/**
 * Sprint 31 — Query plan analysis, index hints, and in-memory optimal-plan cache.
 */
export class RetrievalQueryOptPhase6Band {
  private readonly planByFingerprint = new Map<string, Zone2OptimizedQueryPlan>();

  constructor(private readonly zone2: Zone2RetrievalService) {}

  async analyzeQueryPlan(query: string): Promise<Zone2OptimizedQueryPlan> {
    return this.zone2.optimizeQueryRemote(query);
  }

  suggestIndexes(estRows: number, actualRows: number): readonly string[] {
    if (estRows <= 0) {
      return ["idx_retrieval_unknown_cardinality"];
    }
    if (actualRows > estRows * 1.2) {
      return ["idx_retrieval_lane_time", "idx_retrieval_embedding_partial"];
    }
    return [];
  }

  comparePlanVsActual(estRows: number, actualRows: number): PlanActualCompare {
    const ratio = estRows <= 0 ? null : actualRows / estRows;
    return { estRows, actualRows, ratio };
  }

  async cacheOptimalPlan(query: string): Promise<{ readonly fingerprint: string; readonly cacheHit: boolean }> {
    const plan = await this.analyzeQueryPlan(query);
    const cacheHit = this.planByFingerprint.has(plan.fingerprint);
    this.planByFingerprint.set(plan.fingerprint, plan);
    return { fingerprint: plan.fingerprint, cacheHit };
  }

  clearPlanCache(): void {
    this.planByFingerprint.clear();
  }
}
