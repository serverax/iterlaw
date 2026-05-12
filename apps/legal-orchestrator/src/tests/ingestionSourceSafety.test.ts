// Sprint 11 — TrustedSource validation + URL belongs-to-source.
// Pure unit tests. No network.

import { describe, it, expect } from "vitest";
import {
  validateTrustedSource,
  assertUrlBelongsToSource,
} from "../ingestion/sourceRegistry";
import type { TrustedSource } from "../ingestion/types";

const VALID: TrustedSource = {
  id: "legislation_gov_uk",
  name: "legislation.gov.uk",
  sourceType: "legislation",
  baseUrl: "https://www.legislation.gov.uk",
  jurisdiction: "uk",
  trustLevel: "primary_statute",
  enabled: true,
};

describe("validateTrustedSource", () => {
  it("accepts a well-formed enabled source (Sprint 10-style)", () => {
    const r = validateTrustedSource(VALID);
    expect(r.ok).toBe(true);
  });

  it("rejects a disabled source", () => {
    const r = validateTrustedSource({ ...VALID, enabled: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("disabled");
  });

  it("rejects an unknown source_type", () => {
    const r = validateTrustedSource({
      ...VALID,
      sourceType: "wikipedia" as unknown as TrustedSource["sourceType"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_source_type");
  });

  it("rejects an unknown trust_level", () => {
    const r = validateTrustedSource({
      ...VALID,
      trustLevel: "platinum" as unknown as TrustedSource["trustLevel"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_trust_level");
  });

  it("rejects http:// (must be https)", () => {
    const r = validateTrustedSource({ ...VALID, baseUrl: "http://www.legislation.gov.uk" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("non_https_base_url");
  });

  it("rejects URLs with embedded credentials", () => {
    const r = validateTrustedSource({
      ...VALID,
      baseUrl: "https://user:pass@www.legislation.gov.uk",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("credential_url");
  });

  it("rejects forbidden URL schemes (javascript:, file:, data:, ftp:)", () => {
    for (const scheme of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/plain,hi",
      "ftp://ftp.example.com/",
    ]) {
      const r = validateTrustedSource({ ...VALID, baseUrl: scheme });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(["forbidden_scheme", "non_https_base_url"]).toContain(r.code);
      }
    }
  });
});

describe("assertUrlBelongsToSource", () => {
  it("accepts a URL identical to baseUrl", () => {
    const r = assertUrlBelongsToSource("https://www.legislation.gov.uk", VALID);
    expect(r.ok).toBe(true);
  });

  it("accepts a path under baseUrl origin", () => {
    const r = assertUrlBelongsToSource(
      "https://www.legislation.gov.uk/ukpga/1996/18/contents",
      VALID
    );
    expect(r.ok).toBe(true);
  });

  it("rejects a URL on a different origin", () => {
    const r = assertUrlBelongsToSource("https://www.example.com/x", VALID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("out_of_domain");
  });

  it("rejects credential URLs", () => {
    const r = assertUrlBelongsToSource(
      "https://user:pass@www.legislation.gov.uk/ukpga/1996/18",
      VALID
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("credentials");
  });

  it("rejects javascript:, file:, data:, ftp:", () => {
    for (const u of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/plain,hi",
      "ftp://ftp.example.com/",
    ]) {
      const r = assertUrlBelongsToSource(u, VALID);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(["scheme_blocked", "invalid_url"]).toContain(r.code);
      }
    }
  });

  it("normalises trailing slashes safely on both sides", () => {
    const sourceWithSlash: TrustedSource = { ...VALID, baseUrl: "https://www.legislation.gov.uk/" };
    expect(assertUrlBelongsToSource("https://www.legislation.gov.uk", sourceWithSlash).ok).toBe(true);
    expect(
      assertUrlBelongsToSource("https://www.legislation.gov.uk/ukpga/1996/18", sourceWithSlash).ok
    ).toBe(true);
  });

  it("rejects http:// (caller's URL must also be https)", () => {
    const r = assertUrlBelongsToSource("http://www.legislation.gov.uk/x", VALID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_url");
  });
});
