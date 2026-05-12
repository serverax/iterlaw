// Sprint 11 — local LLM gateway contract.
//
// Asserts the default-disabled safety posture, env-driven config,
// and the /ready + module file boundary. No external LLM provider
// is allowed to appear anywhere in the LLM module. No base URL,
// API key, or model path may leak through /ready.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import {
  describeLocalLlmGateway,
  getConfiguredLlmGatewayMode,
} from "../legal/llm/localLlmGateway";
import { createApp } from "../server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LLM_DIR = join(__dirname, "../legal/llm");

function walkTs(root: string, out: string[] = []): string[] {
  for (const name of readdirSync(root)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(root, name);
    const s = statSync(full);
    if (s.isDirectory()) walkTs(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("Sprint 11 — default gateway is disabled and safe", () => {
  it("default mode is disabled when no env is set", () => {
    const gw = describeLocalLlmGateway({} as NodeJS.ProcessEnv);
    expect(gw.mode).toBe("disabled");
  });

  it("default gateway is not configured", () => {
    const gw = describeLocalLlmGateway({} as NodeJS.ProcessEnv);
    expect(gw.configured).toBe(false);
  });

  it("default gateway is not available", () => {
    const gw = describeLocalLlmGateway({} as NodeJS.ProcessEnv);
    expect(gw.available).toBe(false);
  });

  it("default gateway reason is DISABLED", () => {
    const gw = describeLocalLlmGateway({} as NodeJS.ProcessEnv);
    expect(gw.reason).toBe("DISABLED");
  });

  it("unknown mode value falls back to disabled", () => {
    const env = { ITERLAW_LLM_GATEWAY_MODE: "definitely_not_a_mode" } as NodeJS.ProcessEnv;
    expect(getConfiguredLlmGatewayMode(env)).toBe("disabled");
  });

  it("ITERLAW_LOCAL_LLM_ENABLED=false keeps the gateway disabled even with a mode set", () => {
    const env = {
      ITERLAW_LLM_GATEWAY_MODE: "ollama",
      ITERLAW_LOCAL_LLM_ENABLED: "false",
      ITERLAW_OLLAMA_BASE_URL: "http://localhost:11434",
    } as NodeJS.ProcessEnv;
    const gw = describeLocalLlmGateway(env);
    expect(gw.mode).toBe("disabled");
    expect(gw.reason).toBe("DISABLED");
  });

  it("ollama mode without base URL reports CONFIG_MISSING", () => {
    const env = {
      ITERLAW_LLM_GATEWAY_MODE: "ollama",
      ITERLAW_LOCAL_LLM_ENABLED: "true",
    } as NodeJS.ProcessEnv;
    const gw = describeLocalLlmGateway(env);
    expect(gw.configured).toBe(false);
    expect(gw.reason).toBe("CONFIG_MISSING");
    expect(gw.available).toBe(false);
  });

  it("ollama mode with base URL reports configured=true, available=false, OLLAMA_UNAVAILABLE", () => {
    const env = {
      ITERLAW_LLM_GATEWAY_MODE: "ollama",
      ITERLAW_LOCAL_LLM_ENABLED: "true",
      ITERLAW_OLLAMA_BASE_URL: "http://localhost:11434",
    } as NodeJS.ProcessEnv;
    const gw = describeLocalLlmGateway(env);
    expect(gw.configured).toBe(true);
    expect(gw.available).toBe(false);
    expect(gw.reason).toBe("OLLAMA_UNAVAILABLE");
  });

  it("llama_cpp mode with base URL reports LLAMA_CPP_UNAVAILABLE", () => {
    const env = {
      ITERLAW_LLM_GATEWAY_MODE: "llama_cpp",
      ITERLAW_LOCAL_LLM_ENABLED: "true",
      ITERLAW_LLAMA_CPP_BASE_URL: "http://localhost:8080",
    } as NodeJS.ProcessEnv;
    const gw = describeLocalLlmGateway(env);
    expect(gw.reason).toBe("LLAMA_CPP_UNAVAILABLE");
  });

  it("bifrost mode with base URL reports BIFROST_UNAVAILABLE", () => {
    const env = {
      ITERLAW_LLM_GATEWAY_MODE: "bifrost",
      ITERLAW_LOCAL_LLM_ENABLED: "true",
      ITERLAW_BIFROST_BASE_URL: "http://localhost:9000",
    } as NodeJS.ProcessEnv;
    const gw = describeLocalLlmGateway(env);
    expect(gw.reason).toBe("BIFROST_UNAVAILABLE");
  });
});

describe("Sprint 11 — no external LLM provider in the LLM module", () => {
  const files = walkTs(LLM_DIR);

  it("no openai / anthropic / gemini / vertex / cohere import in legal/llm/", () => {
    const banned = /(openai|anthropic|generativelanguage|google\/generative-ai|vertex|cohere)/i;
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      // Strip comments before scanning so safety-policy text doesn't false-positive.
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `external provider strings: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no fetch( / http call in legal/llm/", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\bfetch\s*\(/.test(stripped)) offenders.push(f);
    }
    expect(offenders, `fetch in llm/: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("Sprint 11 — /ready exposes safe local gateway status only", () => {
  const ORIGINAL = { ...process.env };

  function restore() {
    for (const k of Object.keys(process.env)) {
      if (!(k in ORIGINAL)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(ORIGINAL)) {
      process.env[k] = v as string;
    }
  }

  it("/ready includes the local gateway status slice", async () => {
    delete process.env.ITERLAW_LOCAL_LLM_ENABLED;
    delete process.env.ITERLAW_LLM_GATEWAY_MODE;
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.llm).toBeDefined();
    expect(res.body.llm.external_llm_enabled).toBe(false);
    expect(res.body.llm.local_gateway_configured).toBe(false);
    expect(res.body.llm.local_gateway_mode).toBe("disabled");
    expect(res.body.llm.local_gateway_available).toBe(false);
    restore();
  });

  it("/ready never leaks DATABASE_URL, base URL, or API key tokens", async () => {
    process.env.ITERLAW_LLM_GATEWAY_MODE = "ollama";
    process.env.ITERLAW_LOCAL_LLM_ENABLED = "true";
    process.env.ITERLAW_OLLAMA_BASE_URL = "http://secret-host.local:11434";
    process.env.DATABASE_URL = "postgres://SECRET_user:SECRET_pw@127.0.0.1:5432/secret_db";
    const app = createApp();
    const res = await request(app).get("/ready");
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("secret-host.local");
    expect(body).not.toContain("SECRET_pw");
    expect(body).not.toContain("SECRET_user");
    expect(body).not.toContain("postgres://");
    expect(body).not.toContain("11434");
    restore();
  });
});

describe("Sprint 11 — benchmark plan + script exist", () => {
  it("benchmark plan exists", () => {
    const p = join(__dirname, "../../../../docs/benchmarks/SPRINT_11_LOCAL_LLM_BENCHMARK_PLAN.md");
    expect(existsSync(p)).toBe(true);
  });

  it("benchmark script exists and reads as a bash file", () => {
    const p = join(__dirname, "../../../../scripts/benchmarks/sprint11-local-llm-benchmark.sh");
    expect(existsSync(p)).toBe(true);
    const body = readFileSync(p, "utf8");
    expect(body).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(body).toContain("set -euo pipefail");
  });
});
