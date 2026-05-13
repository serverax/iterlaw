#!/usr/bin/env node
// IterLaw production readiness gate verifier.
//
// Reads docs/iterlaw/project/PRODUCTION_READINESS_GATE.json and exits non-zero
// if any required gate is not PASS.
//
// Rules:
//   - Pure file read; no network, no DB, no kubectl, no LLM, no shell-out.
//   - Single source of truth for "is IterLaw production-ready?".
//   - Exits 0 only when every gate has status === "PASS".
//   - Exits 2 if the JSON is missing/invalid; exits 1 if any gate is not PASS.
//
// Usage:
//   node scripts/verify-production-readiness-gate.mjs
//   node scripts/verify-production-readiness-gate.mjs --json    (machine-readable summary)

import { readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const GATE_PATH = join(REPO_ROOT, "docs", "iterlaw", "project", "PRODUCTION_READINESS_GATE.json");

const args = new Set(process.argv.slice(2));
const wantJson = args.has("--json");

function loadGate() {
  let raw;
  try {
    raw = readFileSync(GATE_PATH, "utf8");
  } catch (err) {
    return { error: `Could not read ${GATE_PATH}: ${err.message}` };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { error: `Invalid JSON at ${GATE_PATH}: ${err.message}` };
  }
  if (!parsed || typeof parsed !== "object") {
    return { error: "Gate JSON root must be an object." };
  }
  if (!Array.isArray(parsed.gates)) {
    return { error: "Gate JSON must contain an array 'gates'." };
  }
  return { gate: parsed };
}

function classifyGate(g) {
  if (!g || typeof g !== "object") return "MALFORMED";
  if (typeof g.status !== "string") return "MALFORMED";
  return g.status;
}

function main() {
  const loaded = loadGate();
  if (loaded.error) {
    if (wantJson) {
      console.log(JSON.stringify({ production_ready: false, error: loaded.error }, null, 2));
    } else {
      console.error("FAIL: " + loaded.error);
    }
    process.exit(2);
  }

  const { gate } = loaded;
  const gates = gate.gates;
  const failing = [];
  const passing = [];

  for (const g of gates) {
    const status = classifyGate(g);
    if (status === "PASS") {
      passing.push(g);
    } else {
      failing.push(g);
    }
  }

  const productionReady = failing.length === 0;

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          production_ready: productionReady,
          gate_total: gates.length,
          gate_passing: passing.length,
          gate_failing: failing.length,
          failing_gates: failing.map((g) => ({
            gate_id: g.gate_id,
            gate_name: g.gate_name,
            status: g.status,
            blocker: g.blocker,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`IterLaw production-readiness gate verifier`);
    console.log(`  schema_version    : ${gate.schema_version ?? "unspecified"}`);
    console.log(`  last_updated      : ${gate.last_updated ?? "unspecified"}`);
    console.log(`  declared_status   : ${gate.production_readiness ?? "unspecified"}`);
    console.log(`  gates_total       : ${gates.length}`);
    console.log(`  gates_passing     : ${passing.length}`);
    console.log(`  gates_failing     : ${failing.length}`);
    console.log("");

    if (failing.length === 0) {
      console.log("RESULT: PASS — every required gate is PASS.");
    } else {
      console.log("RESULT: FAIL — the following gate(s) are not PASS:");
      console.log("");
      for (const g of failing) {
        console.log(`  - [${g.gate_id}] ${g.gate_name}`);
        console.log(`      status  : ${g.status}`);
        console.log(`      blocker : ${g.blocker ?? "(none recorded)"}`);
        if (g.evidence_path) console.log(`      evidence: ${g.evidence_path}`);
        if (g.command) console.log(`      command : ${g.command}`);
        console.log("");
      }
      console.log("Production readiness: NO.");
    }
  }

  process.exit(productionReady ? 0 : 1);
}

main();
