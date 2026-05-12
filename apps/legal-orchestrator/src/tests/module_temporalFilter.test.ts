// Unit tests for the temporal-filter helper.
// Pure function — no fixtures, no I/O.

import { describe, it, expect } from "vitest";
import { deriveApplicableLegalDate } from "../rag/temporalFilter";

describe("deriveApplicableLegalDate — happy paths", () => {
  it("returns undefined for empty facts (does not block retrieval)", () => {
    const r = deriveApplicableLegalDate({ facts: {} });
    expect(r.applicableDate).toBeUndefined();
    expect(r.sourceField).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("picks dismissal_date when present", () => {
    const r = deriveApplicableLegalDate({ facts: { dismissal_date: "2024-04-06" } });
    expect(r.applicableDate).toBe("2024-04-06");
    expect(r.sourceField).toBe("dismissal_date");
  });

  it("prefers dismissal_date over incident_date when both present", () => {
    const r = deriveApplicableLegalDate({
      facts: { dismissal_date: "2024-04-06", incident_date: "2023-01-01" },
    });
    expect(r.applicableDate).toBe("2024-04-06");
    expect(r.sourceField).toBe("dismissal_date");
  });

  it("prefers resignation_date over discrimination_act_date", () => {
    const r = deriveApplicableLegalDate({
      facts: {
        resignation_date: "2025-02-15",
        discrimination_act_date: "2025-01-01",
      },
    });
    expect(r.applicableDate).toBe("2025-02-15");
    expect(r.sourceField).toBe("resignation_date");
  });

  it("falls all the way through to incident_date when only it is present", () => {
    const r = deriveApplicableLegalDate({ facts: { incident_date: "2022-11-30" } });
    expect(r.applicableDate).toBe("2022-11-30");
    expect(r.sourceField).toBe("incident_date");
  });

  it("normalises a date-time string down to YYYY-MM-DD", () => {
    const r = deriveApplicableLegalDate({
      facts: { dismissal_date: "2024-04-06T13:45:00.000Z" },
    });
    expect(r.applicableDate).toBe("2024-04-06");
  });
});

describe("deriveApplicableLegalDate — defensive parsing", () => {
  it("skips fields with empty-string values", () => {
    const r = deriveApplicableLegalDate({
      facts: { dismissal_date: "", incident_date: "2024-01-01" },
    });
    expect(r.applicableDate).toBe("2024-01-01");
    expect(r.sourceField).toBe("incident_date");
  });

  it("skips fields with null values", () => {
    const r = deriveApplicableLegalDate({
      facts: { dismissal_date: null as unknown, incident_date: "2024-01-01" },
    });
    expect(r.applicableDate).toBe("2024-01-01");
  });

  it("emits a warning when a date field is present but malformed", () => {
    const r = deriveApplicableLegalDate({
      facts: { dismissal_date: "April 2024", incident_date: "2023-05-01" },
    });
    expect(r.applicableDate).toBe("2023-05-01");
    expect(r.sourceField).toBe("incident_date");
    expect(r.warnings.some((w) => w.includes("dismissal_date"))).toBe(true);
  });

  it("returns undefined when every supplied date is malformed", () => {
    const r = deriveApplicableLegalDate({
      facts: {
        dismissal_date: "yesterday",
        incident_date: "Q2 2024",
      },
    });
    expect(r.applicableDate).toBeUndefined();
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects 'YYYY' or 'YYYY-MM' (not specific enough)", () => {
    const r = deriveApplicableLegalDate({ facts: { dismissal_date: "2024" } });
    expect(r.applicableDate).toBeUndefined();
    expect(r.warnings.some((w) => w.includes("dismissal_date"))).toBe(true);
  });
});

describe("deriveApplicableLegalDate — purity", () => {
  it("is synchronous and does not throw on unknown extra fields", () => {
    const r = deriveApplicableLegalDate({
      facts: {
        dismissal_date: "2024-04-06",
        unrelated_field: { x: 1 },
        another_unrelated: [1, 2, 3],
      },
    });
    expect(r.applicableDate).toBe("2024-04-06");
  });
});
