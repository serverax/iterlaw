// Deterministic UK ET limitation-window calculator.
//
// Rule (UK_EW): primary limitation window for most ET claims is
// three months less one day from the triggering act. Implemented here
// as a fixed 91-day floor with an "imminent" warning when <= 14 days
// remain. This file is the TypeScript fallback that the WASM runner
// calls when no .wasm binary is loaded.

import type { LegalRuleModule } from "../ruleModule.types";

export interface DeadlineCalcInput {
  jurisdiction: "uk_ew" | "se";
  trigger_date_iso: string; // e.g. dismissal date
  now_iso?: string;
  limitation_window_days?: number;
}

export interface DeadlineCalcOutput {
  jurisdiction: "uk_ew" | "se";
  trigger_date_iso: string;
  deadline_iso: string;
  days_remaining: number;
  status: "ok" | "imminent" | "expired";
  limitation_window_days: number;
  warning?: string;
}

const DEFAULT_WINDOW_DAYS: Record<DeadlineCalcInput["jurisdiction"], number> = {
  uk_ew: 91,
  se: 60,
};

function parseDate(iso: string): Date {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return d;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function dayDiff(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export const deadlineCalculator: LegalRuleModule<DeadlineCalcInput, DeadlineCalcOutput> = {
  id: "deadline_calculator",
  wasmPath: "deadline_calculator.wasm",

  validateInput(input: unknown): DeadlineCalcInput {
    if (!input || typeof input !== "object") {
      throw new Error("deadlineCalculator: input must be an object");
    }
    const r = input as Record<string, unknown>;
    const jurisdiction = r.jurisdiction;
    if (jurisdiction !== "uk_ew" && jurisdiction !== "se") {
      throw new Error("deadlineCalculator: jurisdiction must be 'uk_ew' or 'se'");
    }
    if (typeof r.trigger_date_iso !== "string" || r.trigger_date_iso.length === 0) {
      throw new Error("deadlineCalculator: trigger_date_iso is required");
    }
    // Probe parse — throws on invalid date.
    parseDate(r.trigger_date_iso);
    if (r.now_iso !== undefined) {
      if (typeof r.now_iso !== "string") {
        throw new Error("deadlineCalculator: now_iso must be a string when provided");
      }
      parseDate(r.now_iso);
    }
    if (r.limitation_window_days !== undefined) {
      if (
        typeof r.limitation_window_days !== "number" ||
        !Number.isFinite(r.limitation_window_days) ||
        r.limitation_window_days <= 0
      ) {
        throw new Error("deadlineCalculator: limitation_window_days must be a positive number");
      }
    }
    return {
      jurisdiction,
      trigger_date_iso: r.trigger_date_iso,
      now_iso: r.now_iso as string | undefined,
      limitation_window_days: r.limitation_window_days as number | undefined,
    };
  },

  fallback(input: DeadlineCalcInput): DeadlineCalcOutput {
    const window =
      input.limitation_window_days ?? DEFAULT_WINDOW_DAYS[input.jurisdiction];
    const trigger = parseDate(input.trigger_date_iso);
    const now = input.now_iso ? parseDate(input.now_iso) : new Date();
    const deadline = addDays(trigger, window);
    const daysRemaining = dayDiff(deadline, now);

    let status: DeadlineCalcOutput["status"];
    let warning: string | undefined;
    if (daysRemaining < 0) {
      status = "expired";
      warning = `Statutory limitation likely expired (${input.jurisdiction.toUpperCase()} window: ${window} days).`;
    } else if (daysRemaining <= 14) {
      status = "imminent";
      warning = `Statutory limitation is imminent (${daysRemaining} day(s) remain in the ${window}-day ${input.jurisdiction.toUpperCase()} window).`;
    } else {
      status = "ok";
    }

    return {
      jurisdiction: input.jurisdiction,
      trigger_date_iso: input.trigger_date_iso,
      deadline_iso: deadline.toISOString().slice(0, 10),
      days_remaining: daysRemaining,
      status,
      limitation_window_days: window,
      warning,
    };
  },

  summarise(output: DeadlineCalcOutput): string {
    return `deadline_calculator:${output.jurisdiction}:status=${output.status}:days=${output.days_remaining}:window=${output.limitation_window_days}`;
  },
};
