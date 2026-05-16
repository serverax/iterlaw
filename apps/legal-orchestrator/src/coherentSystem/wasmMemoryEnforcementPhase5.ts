import { randomUUID } from "node:crypto";
import { WASM_SANDBOX_MEMORY_LIMIT_KB } from "./wasmSandboxPhase1.js";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

export interface MemoryExecutionState {
  readonly executionId: string;
  readonly memoryLimitKb: number;
  readonly memoryAllocatedKb: number;
  readonly memoryPeakKb: number;
  readonly gasRemaining: number;
  readonly halted: boolean;
}

/**
 * Sprint 39 — Memory ceiling (64 KiB) + gas meter enforcement.
 */
export class WasmMemoryEnforcementPhase5Band {
  constructor(private readonly zone2: Zone2WasmService) {}

  enforceMemoryLimit(requestedKb: number): number {
    return Math.min(WASM_SANDBOX_MEMORY_LIMIT_KB, Math.max(0, Math.floor(requestedKb)));
  }

  async trackMemoryUsage(executionId: string, allocatedKb: number, operationCount: number): Promise<MemoryExecutionState> {
    const budget = await this.zone2.computeGasBudget(operationCount);
    const limit = this.enforceMemoryLimit(WASM_SANDBOX_MEMORY_LIMIT_KB);
    const alloc = Math.min(limit, Math.max(0, allocatedKb));
    const peak = alloc;
    return {
      executionId,
      memoryLimitKb: limit,
      memoryAllocatedKb: alloc,
      memoryPeakKb: peak,
      gasRemaining: budget.gasUnits,
      halted: false,
    };
  }

  detectOutOfMemory(peakKb: number, limitKb = WASM_SANDBOX_MEMORY_LIMIT_KB): boolean {
    return peakKb > limitKb;
  }

  consumeGas(state: MemoryExecutionState, cost: number): MemoryExecutionState {
    const gasRemaining = Math.max(0, state.gasRemaining - Math.max(0, cost));
    return { ...state, gasRemaining, halted: gasRemaining === 0 };
  }

  auditMemoryAccess(state: MemoryExecutionState, nowMs = Date.now()): Record<string, unknown> {
    const oom = this.detectOutOfMemory(state.memoryPeakKb, state.memoryLimitKb);
    return {
      execution_id: state.executionId,
      memory_allocated_kb: state.memoryAllocatedKb,
      memory_peak_kb: state.memoryPeakKb,
      oom_triggered: oom,
      audited_at: new Date(nowMs).toISOString(),
      gas_remaining: state.gasRemaining,
      halted: state.halted,
    };
  }

  newExecutionId(): string {
    return randomUUID();
  }
}
