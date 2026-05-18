import { AnswerValidator } from "../src/formatting/answer-validator";
import { ResponseFormatter } from "../src/formatting/response-formatter";

describe("Sprint 2: Answer Formatter", () => {
  let validator: AnswerValidator;
  let formatter: ResponseFormatter;

  beforeEach(() => {
    validator = new AnswerValidator();
    formatter = new ResponseFormatter();
  });

  describe("AnswerValidator", () => {
    it("should accept valid three-part answer", () => {
      const rawAnswer = `
        WHAT THE LAW SAYS:
        The Employment Rights Act 1996, Section 94 gives you the right to
        claim unfair dismissal if you've worked for your employer for at least
        two years and they dismiss you without proper reason or process.

        WHAT THIS MEANS FOR YOU:
        In your case, since you have worked for 3 years, you would have the right
        to claim unfair dismissal if your employer dismissed you without a fair
        disciplinary process.

        WHAT TO DO TONIGHT:
        Write down the exact date you were dismissed and save any emails or letters
        from your employer about the dismissal.
      `;

      const result = validator.validate(rawAnswer);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.law_section).toContain("Employment Rights Act 1996");
      expect(result.meaning).toContain("In your case");
      expect(result.action).toContain("Write down");
    });

    it("should reject missing legislation", () => {
      const rawAnswer = `
        WHAT THE LAW SAYS:
        Dismissal happens when you lose your job.

        WHAT THIS MEANS FOR YOU:
        In your situation this means you were terminated.

        WHAT TO DO TONIGHT:
        Contact ACAS.
      `;

      const result = validator.validate(rawAnswer);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("legislation"))).toBe(true);
    });

    it("should reject generic meaning", () => {
      const rawAnswer = `
        WHAT THE LAW SAYS:
        Section 94 of the Employment Rights Act 1996 protects employees.

        WHAT THIS MEANS FOR YOU:
        Employees have rights under the law.

        WHAT TO DO TONIGHT:
        Contact ACAS.
      `;

      const result = validator.validate(rawAnswer);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Meaning must be applied"))).toBe(true);
    });

    it("should reject action that is a list", () => {
      const rawAnswer = `
        WHAT THE LAW SAYS:
        Section 94 Employment Rights Act 1996.

        WHAT THIS MEANS FOR YOU:
        In your case, you can claim.

        WHAT TO DO TONIGHT:
        - Contact ACAS
        - Write to employer
        - File tribunal claim
      `;

      const result = validator.validate(rawAnswer);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("list"))).toBe(true);
    });

    it("should reject banned language", () => {
      const rawAnswer = `
        WHAT THE LAW SAYS:
        Section 94 Employment Rights Act 1996.

        WHAT THIS MEANS FOR YOU:
        You can claim unfair dismissal.

        WHAT TO DO TONIGHT:
        I advise you to contact ACAS.
      `;

      const result = validator.validate(rawAnswer);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Banned phrase"))).toBe(true);
    });
  });

  describe("ResponseFormatter", () => {
    it("should format consistently", () => {
      const validated = {
        valid: true,
        law_section: "Law text",
        meaning: "Meaning text",
        action: "Action text",
        errors: [],
        warnings: [],
        confidence_score: 0.95,
      };

      const source = {
        citation: "ERA 1996",
        url: "http://example.com",
        type: "legislation" as const,
      };

      const metadata = {
        question_id: "q1",
        case_id: "c1",
        model_used: "ollama" as const,
        response_time_ms: 120,
      };

      const formatted = formatter.format(validated, source, metadata);

      expect(formatted.law.text).toBe("Law text");
      expect(formatted.law.label).toBe("WHAT THE LAW SAYS");
      expect(formatted.law.icon).toBe("⚖️");
      expect(formatted.metadata.citations_locked).toBe(true);
    });
  });
});
