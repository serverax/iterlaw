import { describe, it, expect } from "vitest";
import { classifyRequest } from "../pipeline/classifyRequest";

describe("classifyRequest", () => {
  it("classifies suspension questions", () => {
    const c = classifyRequest({ question: "Can my employer suspend me without telling me why?" });
    expect(c.area_of_law).toBe("suspension");
    expect(c.question_type).toBe("legal_advice");
  });

  it("classifies unfair dismissal", () => {
    const c = classifyRequest({ question: "I was dismissed after 18 months. Can I claim unfair dismissal?" });
    expect(c.area_of_law).toBe("unfair_dismissal");
    expect(c.requires_deadline_check).toBe(true);
  });

  it("classifies discrimination without requiring service", () => {
    const c = classifyRequest({ question: "Can I bring a discrimination claim without two years service?" });
    expect(c.area_of_law).toBe("discrimination");
  });

  it("classifies grievance drafting", () => {
    const c = classifyRequest({ question: "Draft a grievance about my manager" });
    expect(c.question_type).toBe("grievance_draft");
    expect(c.recommended_model_role).toBe("uk_employment_drafting");
  });

  it("classifies deadline questions", () => {
    const c = classifyRequest({ question: "What is the time limit for an employment tribunal claim?" });
    expect(c.question_type).toBe("deadline_check");
    expect(c.requires_deadline_check).toBe(true);
  });

  it("returns unknown safely for nonsense", () => {
    const c = classifyRequest({ question: "what's the weather like" });
    expect(c.area_of_law).toBe("unknown");
    expect(c.question_type).toBe("unknown");
    expect(c.requires_citations).toBe(true);
  });

  it("classifies constructive dismissal", () => {
    const c = classifyRequest({ question: "Can I resign and claim constructive dismissal?" });
    expect(c.area_of_law).toBe("constructive_dismissal");
  });

  it("falls back to legal_advice for unmapped questions in ask mode", () => {
    const c = classifyRequest({ question: "What about pay?", mode: "ask" });
    expect(c.question_type).toBe("legal_advice");
  });
});
