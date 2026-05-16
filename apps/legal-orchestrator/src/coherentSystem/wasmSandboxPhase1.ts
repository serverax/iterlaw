import { createHash, randomUUID } from "node:crypto";
import type { Zone2WasmService } from "./zone2WasmTypes.js";

/** Per-execution linear memory ceiling (64 KiB). */
export const WASM_SANDBOX_MEMORY_LIMIT_KB = 64;

export interface WasmSandboxState {
  readonly sandboxId: string;
  readonly memoryLimitKb: number;
  readonly isolated: boolean;
}

/**
 * Sprint 35 — WASM sandbox bootstrap, binary validation, memory cap.
 */
export class WasmSandboxPhase1Band {
  private readonly sandboxes = new Map<string, number>();

  constructor(private readonly zone2: Zone2WasmService) {}

  initializeSandbox(memoryLimitKb = WASM_SANDBOX_MEMORY_LIMIT_KB): WasmSandboxState {
    const limit = this.setMemoryLimit(randomUUID(), memoryLimitKb);
    return { sandboxId: limit.sandboxId, memoryLimitKb: limit.memoryLimitKb, isolated: true };
  }

  setMemoryLimit(sandboxId: string, memoryLimitKb: number): { readonly sandboxId: string; readonly memoryLimitKb: number } {
    const capped = Math.min(WASM_SANDBOX_MEMORY_LIMIT_KB, Math.max(1, Math.floor(memoryLimitKb)));
    this.sandboxes.set(sandboxId, capped);
    return { sandboxId, memoryLimitKb: capped };
  }

  async validateWasmBinary(bytecode: Uint8Array): Promise<{ readonly valid: boolean; readonly reason: string }> {
    const sig = await this.zone2.validateWasmSignature(bytecode);
    if (!sig.valid) {
      return sig;
    }
    if (bytecode.length > WASM_SANDBOX_MEMORY_LIMIT_KB * 1024 * 4) {
      return { valid: false, reason: "bytecode exceeds sandbox size budget" };
    }
    return { valid: true, reason: "ok" };
  }

  getMemoryLimitKb(sandboxId: string): number | null {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  moduleHash(bytecode: Uint8Array): string {
    return createHash("sha256").update(bytecode).digest("hex");
  }
}
