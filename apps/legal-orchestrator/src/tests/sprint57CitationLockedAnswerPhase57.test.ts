import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CitationLockedAnswerPhase57Band } from "../coherentSystem/citationLockedAnswerPhase57.js";
import { Zone2DocumentServiceStub } from "../coherentSystem/zone2DocumentStub.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql153 = readFileSync(join(__dirname, "../../db/migrations/153_sprint57_cited_answers.sql"), "utf8");
const band = new CitationLockedAnswerPhase57Band(new Zone2DocumentServiceStub());

describe("migration 153 sprint 57", () => {
  it("cited_answers table", () => expect(sql153).toMatch(/CREATE TABLE IF NOT EXISTS public\.cited_answers/i));
  it("law meaning action columns", () => {
    expect(sql153).toMatch(/law_section/i);
    expect(sql153).toMatch(/meaning/i);
    expect(sql153).toMatch(/action/i);
  });
  it("citation_data jsonb", () => expect(sql153).toMatch(/citation_data/i));
  it("owner policies", () => expect(sql153).toMatch(/cited_answers_owner_insert/i));
});

describe("CitationLockedAnswerPhase57Band", () => {
  it("buildCitations", () => {
    const c = band.buildCitations(["c1"], ["chunk text"]);
    expect(c[0]!.endChar).toBe("chunk text".length);
  });
  it("validateCitations requires citations", () => {
    expect(band.validateCitations({
      answerText: "a",
      lawSection: "L",
      meaning: "M",
      action: "A",
      citations: [],
      confidenceScore: 0.5,
    }).valid).toBe(false);
  });
  it("generateAnswer", async () => {
    const answer = await band.generateAnswer("What is my appeal deadline?", ["Appeal within 7 days"], ["c1"]);
    expect(answer.lawSection).toBeTruthy();
    expect(answer.citations).toHaveLength(1);
  });
});
