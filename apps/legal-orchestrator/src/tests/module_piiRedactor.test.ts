import { describe, it, expect } from "vitest";
import { piiRedactor } from "../modules/piiRedactor";

describe("piiRedactor", () => {
  it("redacts a simple email", () => {
    const r = piiRedactor({ text: "Contact me at jane.doe@example.co.uk for details." });
    expect(r.redacted_text).toBe("Contact me at [EMAIL_1] for details.");
    expect(r.redactions).toHaveLength(1);
    expect(r.redactions[0]?.type).toBe("email");
  });

  it("redacts a UK phone number", () => {
    const r = piiRedactor({ text: "Call +44 7700 900123 or 0207 946 0000 anytime." });
    expect(r.redacted_text).toMatch(/\[PHONE_1\]/);
    expect(r.redactions.filter((x) => x.type === "phone").length).toBeGreaterThan(0);
  });

  it("redacts a UK National Insurance number", () => {
    // Use a structurally valid prefix. Real UK NI prefixes cannot start with
    // D, F, I, Q, U, or V; second letter cannot be D, F, I, O, Q, U, or V.
    // 'AB' is valid; 'QQ' is not and the redactor correctly leaves it alone.
    const r = piiRedactor({ text: "My NI is AB123456C and the rest is fine." });
    expect(r.redacted_text).toBe("My NI is [NI_NUMBER_1] and the rest is fine.");
  });

  it("does NOT redact strings that look like NI numbers but use invalid prefixes", () => {
    // QQ123456C has an invalid second letter (Q) — must not be redacted as NI.
    const r = piiRedactor({ text: "Case reference QQ123456C is unrelated." });
    expect(r.redacted_text).toBe("Case reference QQ123456C is unrelated.");
    expect(r.redactions.filter((x) => x.type === "ni_number")).toEqual([]);
  });

  it("redacts a UK postcode", () => {
    const r = piiRedactor({ text: "Address at SW1A 1AA must be excluded." });
    expect(r.redactions.some((x) => x.type === "postcode")).toBe(true);
    expect(r.redacted_text).toMatch(/\[POSTCODE_1\]/);
  });

  it("numbers placeholders left to right within the same type", () => {
    const r = piiRedactor({
      text: "Reach jane@a.com or john@b.com — and also alice@c.org.",
    });
    expect(r.redacted_text).toContain("[EMAIL_1]");
    expect(r.redacted_text).toContain("[EMAIL_2]");
    expect(r.redacted_text).toContain("[EMAIL_3]");
  });

  it("does not redact when nothing matches", () => {
    const r = piiRedactor({ text: "Nothing personally identifying here." });
    expect(r.redacted_text).toBe("Nothing personally identifying here.");
    expect(r.redactions).toEqual([]);
  });

  it("records redaction spans against the redacted_text", () => {
    const r = piiRedactor({ text: "Email: a@b.co" });
    const red = r.redactions[0]!;
    expect(r.redacted_text.slice(red.start, red.end)).toBe(red.placeholder);
  });
});
