// /ready synthesis block — ADR 004 §10.3.d.
//
// Hard invariants the orchestrator must enforce regardless of which
// SynthesisHealthPort is wired:
//   - The block has exactly four keys: configured, reachable, queue,
//     last_seen_at. No more, no less.
//   - configured and reachable are booleans.
//   - queue is one of: null | "redis-streams" | "nats-jetstream".
//   - last_seen_at is null or a string.
//   - The block never leaks URLs, hostnames, ports, credentials,
//     namespaces, or pod identifiers.

import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server";
import type {
  SynthesisHealthPort,
  SynthesisHealthSnapshot,
} from "../synthesis/synthesisHealth";

afterEach(() => {
  vi.unstubAllEnvs();
});

const SYNTHESIS_BLOCK_KEYS = [
  "configured",
  "reachable",
  "queue",
  "last_seen_at",
].sort();

describe("/ready synthesis block — default (unwired)", () => {
  it("reports configured=false / reachable=false / queue=null / last_seen_at=null", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.synthesis).toEqual({
      configured: false,
      reachable: false,
      queue: null,
      last_seen_at: null,
    });
  });

  it("preserves the external_llm_enabled: false invariant alongside synthesis", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.body.llm.external_llm_enabled).toBe(false);
    expect(res.body.synthesis.configured).toBe(false);
  });
});

describe("/ready synthesis block — injected port", () => {
  it("surfaces a configured-but-unreachable port honestly", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const stub: SynthesisHealthPort = {
      describe: () => ({
        configured: true,
        reachable: false,
        queue: "redis-streams",
        last_seen_at: null,
      }),
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    expect(res.body.synthesis).toEqual({
      configured: true,
      reachable: false,
      queue: "redis-streams",
      last_seen_at: null,
    });
  });

  it("surfaces a healthy reachable port with last_seen_at timestamp", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const stub: SynthesisHealthPort = {
      describe: () => ({
        configured: true,
        reachable: true,
        queue: "redis-streams",
        last_seen_at: "2026-05-12T03:45:00Z",
      }),
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    expect(res.body.synthesis).toEqual({
      configured: true,
      reachable: true,
      queue: "redis-streams",
      last_seen_at: "2026-05-12T03:45:00Z",
    });
  });
});

describe("/ready synthesis block — defensive cleanser", () => {
  it("drops extra keys returned by a misbehaving port", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const stub: SynthesisHealthPort = {
      describe: () =>
        ({
          configured: true,
          reachable: true,
          queue: "redis-streams",
          last_seen_at: "2026-05-12T03:45:00Z",
          // The fields below MUST be dropped — they are exactly the
          // kind of leak the sanitiser exists to prevent.
          redis_url: "redis://user:password@host:6379",
          pod_uid: "leg-orc-7f9d",
          internal_error: "kaboom\n  at /etc/secrets/api.key:42",
        }) as unknown as SynthesisHealthSnapshot,
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    expect(Object.keys(res.body.synthesis).sort()).toEqual(SYNTHESIS_BLOCK_KEYS);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("redis://");
    expect(text).not.toContain("password");
    expect(text).not.toContain("pod_uid");
    expect(text).not.toContain("/etc/secrets");
  });

  it("forces unknown queue identifiers to null", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const stub: SynthesisHealthPort = {
      describe: () =>
        ({
          configured: true,
          reachable: true,
          queue: "kafka",
          last_seen_at: "2026-05-12T03:45:00Z",
        }) as unknown as SynthesisHealthSnapshot,
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    expect(res.body.synthesis.queue).toBe(null);
  });

  it("coerces truthy non-boolean values to true", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const stub: SynthesisHealthPort = {
      describe: () =>
        ({
          configured: 1,
          reachable: "yes",
          queue: "redis-streams",
          last_seen_at: "2026-05-12T03:45:00Z",
        }) as unknown as SynthesisHealthSnapshot,
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    expect(res.body.synthesis.configured).toBe(true);
    expect(res.body.synthesis.reachable).toBe(true);
  });

  it("coerces empty-string last_seen_at to null", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const stub: SynthesisHealthPort = {
      describe: () => ({
        configured: true,
        reachable: false,
        queue: "redis-streams",
        last_seen_at: "",
      }),
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    expect(res.body.synthesis.last_seen_at).toBe(null);
  });
});

describe("/ready synthesis block — does not leak operator state via side doors", () => {
  it("drops every key on the snapshot other than the four contract fields", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const sideChannels = {
      redis_url: "redis://prod-redis-0.iterlaw-ai.svc.cluster.local:6379",
      hostname: "synthesis-redis.iterlaw-ai.svc.cluster.local",
      pod_uid: "leg-orc-7f9d",
      api_key: "sk-something-secret",
      database_url: "postgres://user:pw@host:5432/db",
    };
    const stub: SynthesisHealthPort = {
      describe: () =>
        ({
          configured: true,
          reachable: true,
          queue: "redis-streams",
          last_seen_at: "2026-05-12T03:45:00Z",
          ...sideChannels,
        }) as unknown as SynthesisHealthSnapshot,
    };
    const app = createApp({ synthesisHealth: stub });
    const res = await request(app).get("/ready");
    const text = JSON.stringify(res.body);
    for (const k of Object.keys(sideChannels)) {
      expect(text).not.toContain(k);
    }
    for (const v of Object.values(sideChannels)) {
      expect(text).not.toContain(v);
    }
  });
});
