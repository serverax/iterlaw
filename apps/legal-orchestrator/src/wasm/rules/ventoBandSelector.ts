// Deterministic Vento band selector for injury-to-feelings awards.
//
// The Vento bands are uprated periodically by the Presidents of the
// Employment Tribunals. The bands applicable to a claim are determined
// by the date the claim was presented ("event_date"), evaluated against
// each band's effective-from date.
//
// The bands table below is a placeholder ladder. Callers MAY override it
// via `bands_table` — the table is treated as data, not as a hard-coded
// rate. This keeps the rule deterministic while leaving the live rates
// to a separate uprate process.

import type { LegalRuleModule } from "../ruleModule.types";

export interface VentoBand {
  effective_from_iso: string;
  effective_to_iso?: string; // exclusive; omit for the current ladder
  lower_min: number;
  lower_max: number;
  middle_min: number;
  middle_max: number;
  upper_min: number;
  upper_max: number;
  exceptional_min: number;
}

export interface VentoBandInput {
  event_date_iso: string;
  severity: "lower" | "middle" | "upper" | "exceptional";
  bands_table?: VentoBand[];
}

export interface VentoBandOutput {
  effective_band: {
    effective_from_iso: string;
    effective_to_iso?: string;
  };
  severity: VentoBandInput["severity"];
  range_min: number;
  range_max: number | null; // null for exceptional (open-ended)
}

const DEFAULT_BANDS: VentoBand[] = [
  // Placeholder ladder. NOT a legal rate source.
  {
    effective_from_iso: "2024-04-06",
    effective_to_iso: "2025-04-06",
    lower_min: 1200,
    lower_max: 11700,
    middle_min: 11700,
    middle_max: 35200,
    upper_min: 35200,
    upper_max: 58700,
    exceptional_min: 58700,
  },
  {
    effective_from_iso: "2025-04-06",
    lower_min: 1300,
    lower_max: 12100,
    middle_min: 12100,
    middle_max: 36400,
    upper_min: 36400,
    upper_max: 60700,
    exceptional_min: 60700,
  },
];

function parseDate(iso: string): Date {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return d;
}

function isWithin(event: Date, b: VentoBand): boolean {
  const from = parseDate(b.effective_from_iso);
  if (event.getTime() < from.getTime()) return false;
  if (b.effective_to_iso) {
    const to = parseDate(b.effective_to_iso);
    if (event.getTime() >= to.getTime()) return false;
  }
  return true;
}

export const ventoBandSelector: LegalRuleModule<VentoBandInput, VentoBandOutput> = {
  id: "vento_band_selector",
  wasmPath: "vento_band_selector.wasm",

  validateInput(input: unknown): VentoBandInput {
    if (!input || typeof input !== "object") {
      throw new Error("ventoBandSelector: input must be an object");
    }
    const r = input as Record<string, unknown>;
    if (typeof r.event_date_iso !== "string" || r.event_date_iso.length === 0) {
      throw new Error("ventoBandSelector: event_date_iso is required");
    }
    parseDate(r.event_date_iso);
    if (
      r.severity !== "lower" &&
      r.severity !== "middle" &&
      r.severity !== "upper" &&
      r.severity !== "exceptional"
    ) {
      throw new Error("ventoBandSelector: severity must be lower|middle|upper|exceptional");
    }
    if (r.bands_table !== undefined) {
      if (!Array.isArray(r.bands_table) || r.bands_table.length === 0) {
        throw new Error("ventoBandSelector: bands_table must be a non-empty array when provided");
      }
    }
    return {
      event_date_iso: r.event_date_iso,
      severity: r.severity,
      bands_table: r.bands_table as VentoBand[] | undefined,
    };
  },

  fallback(input: VentoBandInput): VentoBandOutput {
    const table = input.bands_table ?? DEFAULT_BANDS;
    const event = parseDate(input.event_date_iso);

    // Sort defensively in ascending order so the first match is the
    // earliest applicable ladder. Callers may pre-sort; we do not assume.
    const sorted = [...table].sort(
      (a, b) => parseDate(a.effective_from_iso).getTime() - parseDate(b.effective_from_iso).getTime()
    );
    const band = sorted.find((b) => isWithin(event, b));
    if (!band) {
      throw new Error(
        `ventoBandSelector: no Vento band covers event_date_iso=${input.event_date_iso}`
      );
    }

    let rangeMin: number;
    let rangeMax: number | null;
    switch (input.severity) {
      case "lower":
        rangeMin = band.lower_min;
        rangeMax = band.lower_max;
        break;
      case "middle":
        rangeMin = band.middle_min;
        rangeMax = band.middle_max;
        break;
      case "upper":
        rangeMin = band.upper_min;
        rangeMax = band.upper_max;
        break;
      case "exceptional":
        rangeMin = band.exceptional_min;
        rangeMax = null;
        break;
    }

    return {
      effective_band: {
        effective_from_iso: band.effective_from_iso,
        effective_to_iso: band.effective_to_iso,
      },
      severity: input.severity,
      range_min: rangeMin,
      range_max: rangeMax,
    };
  },

  summarise(output: VentoBandOutput): string {
    const maxPart = output.range_max === null ? "+" : `..${output.range_max}`;
    return `vento_band_selector:from=${output.effective_band.effective_from_iso}:severity=${output.severity}:range=${output.range_min}${maxPart}`;
  },
};
