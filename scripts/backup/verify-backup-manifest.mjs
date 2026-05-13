#!/usr/bin/env node
// Sprint 12 — Track B manifest verifier CLI.
//
// Usage:
//   node scripts/backup/verify-backup-manifest.mjs <manifest-path> [--strict-live]
//
// Exits 0 if the manifest is valid; non-zero otherwise. Prints errors to
// stderr. NEVER prints the manifest contents itself (a malicious-or-
// careless author could have leaked a DSN into the manifest, and this
// tool's job is to catch that, not amplify it).

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest, isSha256Hex } from "./manifestValidator.mjs";

function fail(msg, code = 1) {
  process.stderr.write(`verify-backup-manifest: ${msg}\n`);
  process.exit(code);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length < 1) {
    fail("usage: verify-backup-manifest <manifest-path> [--strict-live]");
  }

  const strictLive = args.includes("--strict-live");
  const target = args.find((a) => !a.startsWith("--"));
  if (!target) fail("no manifest path supplied");

  const path = resolve(target);
  if (!existsSync(path)) fail(`manifest not found: ${target}`);
  if (!statSync(path).isFile()) fail(`not a file: ${target}`);

  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    fail(`cannot read manifest: ${e.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`manifest is not valid JSON: ${e.message}`);
  }

  const { ok, errors } = validateManifest(parsed, {
    requireChecksumWhenLive: strictLive || parsed.command_mode === "live",
  });

  if (!ok) {
    for (const err of errors) process.stderr.write(`  - ${err}\n`);
    fail(`manifest FAILED validation (${errors.length} error(s))`);
  }

  // Optional: verify that the referenced checksum file exists for live
  // mode. This is a structural check; we do not re-hash the dump (the
  // restore verifier does that).
  if (parsed.command_mode === "live") {
    const dir = dirname(path);
    const ckPath = join(dir, basename(parsed.checksum_file));
    if (!existsSync(ckPath)) {
      fail(`checksum file referenced by manifest is missing: ${parsed.checksum_file}`);
    }
    if (!isSha256Hex(parsed.sha256)) {
      fail("manifest.sha256 not in 64-hex form (live mode)");
    }
  }

  process.stdout.write("manifest OK\n");
  process.exit(0);
}

const thisFile = fileURLToPath(import.meta.url);
const argv1 = process.argv[1] ? resolve(process.argv[1]) : "";
if (argv1 === thisFile) {
  main(process.argv);
}
