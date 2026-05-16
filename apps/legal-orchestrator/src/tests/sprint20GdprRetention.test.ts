import { describe, it, expect } from "vitest";
import {
  GDPR_REQUEST_TYPES,
  GDPR_REQUEST_STATUSES,
  isGdprRequestType,
  isGdprRequestStatus,
} from "../gdprRetention/dsrTypes.js";
import {
  utcDayStartMs,
  retentionDeadlineMs,
  isRetentionExpired,
  wholeDaysUntilRetentionDeadline,
} from "../gdprRetention/retentionSchedule.js";

describe("Sprint 20 — dsrTypes", () => {
  it("exports fixed request types", () => {
    expect(GDPR_REQUEST_TYPES).toEqual(["EXPORT", "ERASURE", "RECTIFICATION"]);
  });

  it("exports fixed statuses", () => {
    expect(GDPR_REQUEST_STATUSES).toEqual(["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"]);
  });

  it.each(["EXPORT", "ERASURE", "RECTIFICATION"])("isGdprRequestType(%s)", (v) => {
    expect(isGdprRequestType(v)).toBe(true);
  });

  it.each(["export", "DELETE", ""])("isGdprRequestType rejects %j", (v) => {
    expect(isGdprRequestType(v)).toBe(false);
  });

  it.each(["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"])("isGdprRequestStatus(%s)", (v) => {
    expect(isGdprRequestStatus(v)).toBe(true);
  });

  it.each(["pending", "DONE", ""])("isGdprRequestStatus rejects %j", (v) => {
    expect(isGdprRequestStatus(v)).toBe(false);
  });
});

describe("Sprint 20 — retentionSchedule", () => {
  it("utcDayStartMs normalises to UTC midnight", () => {
    const t = utcDayStartMs("2024-06-15T14:33:22.000Z");
    expect(new Date(t).toISOString()).toBe("2024-06-15T00:00:00.000Z");
  });

  it("retentionDeadlineMs adds whole UTC days from creation day start", () => {
    const d = retentionDeadlineMs("2024-01-10T03:00:00.000Z", 7);
    expect(new Date(d).toISOString()).toBe("2024-01-17T00:00:00.000Z");
  });

  it("isRetentionExpired false before deadline", () => {
    expect(isRetentionExpired("2024-01-01T00:00:00.000Z", 30, Date.parse("2024-01-15T00:00:00.000Z"))).toBe(false);
  });

  it("isRetentionExpired true on deadline instant", () => {
    const created = "2024-01-01T12:00:00.000Z";
    const deadline = retentionDeadlineMs(created, 1);
    expect(isRetentionExpired(created, 1, deadline)).toBe(true);
  });

  it("isRetentionExpired true after deadline", () => {
    expect(isRetentionExpired("2020-01-01T00:00:00.000Z", 1, Date.parse("2030-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("wholeDaysUntilRetentionDeadline returns 0 when expired", () => {
    expect(
      wholeDaysUntilRetentionDeadline("2020-01-01T00:00:00.000Z", 1, Date.parse("2025-01-01T00:00:00.000Z")),
    ).toBe(0);
  });

  it("wholeDaysUntilRetentionDeadline ceil for partial last day", () => {
    const created = "2024-06-01T00:00:00.000Z";
    const now = Date.parse("2024-06-05T12:00:00.000Z");
    const days = wholeDaysUntilRetentionDeadline(created, 10, now);
    expect(days).toBe(6);
  });

  it("retentionDeadlineMs rejects non-positive retention", () => {
    expect(() => retentionDeadlineMs("2024-01-01T00:00:00.000Z", 0)).toThrow(/positive/);
    expect(() => retentionDeadlineMs("2024-01-01T00:00:00.000Z", -1)).toThrow(/positive/);
  });

  it("large retention window", () => {
    const deadline = retentionDeadlineMs("2024-01-01T00:00:00.000Z", 2555);
    expect(isRetentionExpired("2024-01-01T00:00:00.000Z", 2555, deadline)).toBe(true);
  });

  it("year boundary UTC", () => {
    const deadline = retentionDeadlineMs("2023-12-31T22:00:00.000Z", 2);
    expect(new Date(deadline).getUTCFullYear()).toBe(2024);
  });
});

describe("Sprint 20 — gdprRetention barrel", () => {
  it("re-exports dsr + retention helpers from index", async () => {
    const mod = await import("../gdprRetention/index.js");
    expect(mod.isGdprRequestType("EXPORT")).toBe(true);
    expect(mod.retentionDeadlineMs("2024-01-01T00:00:00.000Z", 1)).toBe(Date.parse("2024-01-02T00:00:00.000Z"));
    expect(mod.isRetentionExpired("2024-01-01T00:00:00.000Z", 1, Date.parse("2024-01-02T00:00:00.000Z"))).toBe(true);
  });
});
