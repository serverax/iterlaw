#!/usr/bin/env node
// Sprint 19A — Multi-tier retrieval benchmark harness (mock data only).
//
// Safety:
//   - No network call. No DB call. No external LLM.
//   - Uses synthetic mock candidates and synchronous lookup functions.
//   - Does NOT claim production speed improvement.
//   - Writes an optional report to reports/logs/ when --write-report is passed.
//
// Usage:
//   node scripts/bench/iterlaw-retrieval-benchmark.mjs
//   node scripts/bench/iterlaw-retrieval-benchmark.mjs --write-report
//
// The harness exercises the planner against three mock scenarios and emits
// metrics. Exit 0 when all scenarios complete. Exit 1 only on harness error.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

// Load the compiled planner from the orchestrator's dist tree if present;
// otherwise dynamically import the TS source via tsx is out of scope for this
// harness. We use the dist build.
const DIST_PLANNER_PATH = join(REPO_ROOT, "apps", "legal-orchestrator", "dist", "retrieval", "retrievalPlanner.js");

const args = new Set(process.argv.slice(2));
const writeReport = args.has("--write-report");

if (!existsSync(DIST_PLANNER_PATH)) {
  console.error(
    "Bench harness requires the orchestrator dist build. Run `npm run build` in apps/legal-orchestrator first.",
  );
  process.exit(2);
}

const planner = await import("file://" + DIST_PLANNER_PATH);

// --- Mock data ---------------------------------------------------------------

function mkCandidate({
  id,
  text = "Synthetic statutory text.",
  qa = "approved",
  superseded = null,
  effectiveTo = null,
  authority = 1,
  keywordRank = null,
  vectorRank = null,
} = {}) {
  return {
    candidate_id: id,
    source_type: "statutory_source",
    source_id: "MOCK-" + id,
    source_title: "Mock Source " + id,
    source_url: "https://example.test/mock/" + id,
    text,
    effective_from: "2020-01-01",
    effective_to: effectiveTo,
    last_verified_at: "2026-01-01",
    superseded_by: superseded,
    qa_status: qa,
    authority_level: authority,
    keyword_rank: keywordRank,
    vector_rank: vectorRank,
    reason_codes: [],
  };
}

const scenarios = [
  {
    label: "scenario:no_adapters",
    request: { question: "any legal question", queryType: "legal_question" },
    deps: {},
  },
  {
    label: "scenario:exact_short_circuit",
    request: { question: "unfair dismissal", queryType: "legal_question" },
    deps: {
      exactApprovedLookup: () => ({
        canonicalQuestion: "unfair dismissal",
        answerSummary: "ERA 1996 s94.",
        candidate: mkCandidate({ id: "exact-1" }),
      }),
    },
  },
  {
    label: "scenario:full_text_plus_vector_with_trust_and_freshness_filters",
    request: { question: "redundancy pay calculation", queryType: "legal_question" },
    deps: {
      fullTextSearch: () => [
        mkCandidate({ id: "ft-1", keywordRank: 1 }),
        mkCandidate({ id: "ft-2-stale", keywordRank: 2, superseded: "ft-2-new" }),
        mkCandidate({ id: "ft-3-blocked", keywordRank: 3, qa: "failed" }),
      ],
      vectorSearch: () => [
        mkCandidate({ id: "vec-1", vectorRank: 1 }),
        mkCandidate({ id: "vec-2-expired", vectorRank: 2, effectiveTo: "2020-01-01" }),
      ],
    },
  },
];

// --- Run benchmark -----------------------------------------------------------

const reportLines = [
  "# IterLaw Multi-tier Retrieval Benchmark (mock data only)",
  "",
  "> No production speed claim. Mock harness only. No DB, no network, no external LLM.",
  "",
  `Generated at: ${new Date().toISOString()}`,
  "",
  "| Scenario | Tiers selected | Final candidates | Excluded (trust/freshness/metadata) | Elapsed ms |",
  "|---|---|---|---|---|",
];

let allOk = true;
for (const sc of scenarios) {
  const t0 = performance.now();
  let result;
  try {
    result = await planner.planAndExecuteMultiTier(sc.request, sc.deps);
  } catch (err) {
    allOk = false;
    console.error(`[BENCH FAIL] ${sc.label}: ${err && err.message ? err.message : err}`);
    continue;
  }
  const elapsed = (performance.now() - t0).toFixed(2);
  const selected = result.tierResults.filter((t) => t.status === "selected").map((t) => t.tier);
  console.log(`[BENCH] ${sc.label}`);
  console.log(`  selected_tiers   = ${JSON.stringify(selected)}`);
  console.log(`  final_count      = ${result.finalCandidates.length}`);
  console.log(`  excluded_trust   = ${result.excludedByTrust.length}`);
  console.log(`  excluded_freshness = ${result.excludedByFreshness.length}`);
  console.log(`  excluded_metadata  = ${result.excludedByMetadata.length}`);
  console.log(`  context_pack_size  = ${result.finalCandidates.length}`);
  console.log(`  elapsed_ms       = ${elapsed}`);
  reportLines.push(
    `| ${sc.label} | ${JSON.stringify(selected)} | ${result.finalCandidates.length} | T=${result.excludedByTrust.length} / F=${result.excludedByFreshness.length} / M=${result.excludedByMetadata.length} | ${elapsed} |`,
  );
}

if (writeReport) {
  const reportDir = join(REPO_ROOT, "reports", "logs");
  mkdirSync(reportDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportDir, `iterlaw-retrieval-benchmark-${ts}.md`);
  reportLines.push("");
  reportLines.push("## Safety properties");
  reportLines.push("- Pure functions, no DB, no network, no external LLM.");
  reportLines.push("- Mock candidates only. No production-speed claim.");
  writeFileSync(reportPath, reportLines.join("\n"), "utf8");
  console.log(`[BENCH] report written: ${reportPath}`);
}

process.exit(allOk ? 0 : 1);
