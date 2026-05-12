// Static-text validation for the k8s/synthesis-worker/ Redis manifests.
// Matches the pattern used by the legal-orchestrator migration tests:
// read the raw file, assert structural invariants against substrings
// and regexes. No yaml parser dependency.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Path from apps/synthesis-worker/src/tests → repo root → k8s/synthesis-worker
const manifestsDir = join(__dirname, "../../../../k8s/synthesis-worker");

function readManifest(name: string): string {
  const p = join(manifestsDir, name);
  expect(existsSync(p), `missing ${p}`).toBe(true);
  return readFileSync(p, "utf8");
}

// Strip YAML "#" comments (whole-line and trailing) so directive-level
// assertions don't fire on prose in header comments.
function withoutYamlComments(s: string): string {
  return s
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, ""))
    .join("\n");
}

const CONFIGMAP = "redis-configmap.yaml";
const SERVICE = "redis-service.yaml";
const STATEFULSET = "redis-statefulset.yaml";
const NETPOL = "redis-networkpolicy.yaml";
const KUSTOMIZATION = "kustomization.yaml";

describe("k8s/synthesis-worker — all expected files present", () => {
  it.each([CONFIGMAP, SERVICE, STATEFULSET, NETPOL, KUSTOMIZATION])(
    "%s exists",
    (file) => {
      readManifest(file);
    },
  );
});

describe("redis-configmap.yaml", () => {
  const cm = readManifest(CONFIGMAP);

  it("is a ConfigMap in iterlaw-ai", () => {
    expect(cm).toMatch(/^kind:\s*ConfigMap/m);
    expect(cm).toMatch(/namespace:\s*iterlaw-ai/);
  });

  it("uses appendonly persistence (AOF) and disables RDB snapshots", () => {
    expect(cm).toMatch(/appendonly\s+yes/);
    expect(cm).toMatch(/save\s+""/);
  });

  it("uses noeviction so XADD MAXLEN handles trimming (ADR §5)", () => {
    expect(cm).toMatch(/maxmemory-policy\s+noeviction/);
  });

  it("has a maxmemory ceiling configured", () => {
    expect(cm).toMatch(/maxmemory\s+\d+(mb|gb)/i);
  });

  it("renames CONFIG / FLUSHALL / FLUSHDB / DEBUG to empty (admin hardening)", () => {
    expect(cm).toMatch(/rename-command\s+CONFIG\s+""/);
    expect(cm).toMatch(/rename-command\s+FLUSHDB\s+""/);
    expect(cm).toMatch(/rename-command\s+FLUSHALL\s+""/);
    expect(cm).toMatch(/rename-command\s+DEBUG\s+""/);
  });

  it("does NOT embed a plaintext requirepass value", () => {
    // requirepass is provided via --requirepass on the command line
    // from a Secret. The configmap must not contain a literal value.
    // Check directives only, after stripping YAML comments.
    const directives = withoutYamlComments(cm);
    expect(directives).not.toMatch(/^\s*requirepass\s+\S/m);
  });

  it("enables protected-mode", () => {
    expect(cm).toMatch(/protected-mode\s+yes/);
  });
});

describe("redis-service.yaml", () => {
  const svc = readManifest(SERVICE);

  it("is a ClusterIP Service named synthesis-redis", () => {
    expect(svc).toMatch(/^kind:\s*Service/m);
    expect(svc).toMatch(/name:\s*synthesis-redis/);
    expect(svc).toMatch(/type:\s*ClusterIP/);
  });

  it("targets app=synthesis-redis pods on port 6379", () => {
    expect(svc).toMatch(/selector:\s*\n\s+app:\s*synthesis-redis/);
    expect(svc).toMatch(/port:\s*6379/);
    expect(svc).toMatch(/targetPort:\s*6379/);
  });

  it("is not externally exposed (no NodePort / LoadBalancer / externalIPs)", () => {
    const directives = withoutYamlComments(svc);
    expect(directives).not.toMatch(/type:\s*NodePort/);
    expect(directives).not.toMatch(/type:\s*LoadBalancer/);
    expect(directives).not.toMatch(/^\s*externalIPs\s*:/m);
  });
});

describe("redis-statefulset.yaml", () => {
  const ss = readManifest(STATEFULSET);

  it("is a single-replica StatefulSet in iterlaw-ai", () => {
    expect(ss).toMatch(/^kind:\s*StatefulSet/m);
    expect(ss).toMatch(/namespace:\s*iterlaw-ai/);
    expect(ss).toMatch(/replicas:\s*1\b/);
  });

  it("uses redis:7.x-alpine (pinned major)", () => {
    expect(ss).toMatch(/image:\s*redis:7\.[0-9]+(\.[0-9]+)?-alpine/);
  });

  it("imagePullPolicy is IfNotPresent (no Always — pin via tag)", () => {
    expect(ss).toMatch(/imagePullPolicy:\s*IfNotPresent/);
  });

  it("runs non-root with the redis UID (999)", () => {
    expect(ss).toMatch(/runAsNonRoot:\s*true/);
    expect(ss).toMatch(/runAsUser:\s*999/);
    expect(ss).toMatch(/fsGroup:\s*999/);
  });

  it("drops all capabilities and forbids privilege escalation", () => {
    expect(ss).toMatch(/allowPrivilegeEscalation:\s*false/);
    expect(ss).toMatch(/drop:\s*\n\s+-\s*ALL/);
  });

  it("mounts root filesystem read-only", () => {
    expect(ss).toMatch(/readOnlyRootFilesystem:\s*true/);
  });

  it("does not auto-mount the service account token", () => {
    expect(ss).toMatch(/automountServiceAccountToken:\s*false/);
  });

  it("references the synthesis-redis-credentials Secret (not inline)", () => {
    expect(ss).toMatch(/secretKeyRef:\s*\n\s+name:\s*synthesis-redis-credentials/);
    expect(ss).toMatch(/key:\s*password/);
  });

  it("passes the password via --requirepass on the command line", () => {
    expect(ss).toMatch(/--requirepass/);
    expect(ss).toMatch(/\$\(REDIS_PASSWORD\)/);
  });

  it("mounts redis.conf from the configmap as read-only", () => {
    expect(ss).toMatch(/name:\s*config\s*\n\s+mountPath:\s*\/etc\/redis\s*\n\s+readOnly:\s*true/);
    expect(ss).toMatch(/configMap:\s*\n\s+name:\s*synthesis-redis-config/);
  });

  it("declares a 5Gi volumeClaimTemplate named data", () => {
    expect(ss).toMatch(/volumeClaimTemplates:/);
    expect(ss).toMatch(/storage:\s*5Gi/);
    expect(ss).toMatch(/accessModes:\s*\n\s+-\s*ReadWriteOnce/);
  });

  it("has TCP readiness and liveness probes", () => {
    expect(ss).toMatch(/readinessProbe:\s*\n\s+tcpSocket:\s*\n\s+port:\s*redis/);
    expect(ss).toMatch(/livenessProbe:\s*\n\s+tcpSocket:\s*\n\s+port:\s*redis/);
  });

  it("never contains a plaintext password or known credential markers", () => {
    expect(ss).not.toMatch(/password:\s*['"]\S+/);
    expect(ss).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(ss).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(ss).not.toMatch(/github_pat_/i);
    expect(ss).not.toMatch(/BEGIN PRIVATE KEY/);
  });
});

describe("redis-networkpolicy.yaml", () => {
  const np = readManifest(NETPOL);

  it("is a NetworkPolicy applied to app=synthesis-redis", () => {
    expect(np).toMatch(/^kind:\s*NetworkPolicy/m);
    expect(np).toMatch(/podSelector:\s*\n\s+matchLabels:\s*\n\s+app:\s*synthesis-redis/);
  });

  it("declares both Ingress and Egress policy types", () => {
    expect(np).toMatch(/policyTypes:\s*\n\s+-\s*Ingress\s*\n\s+-\s*Egress/);
  });

  it("only allows ingress from the orchestrator and the worker", () => {
    expect(np).toMatch(/podSelector:\s*\n\s+matchLabels:\s*\n\s+app:\s*legal-orchestrator/);
    expect(np).toMatch(/podSelector:\s*\n\s+matchLabels:\s*\n\s+app:\s*synthesis-worker/);
  });

  it("only allows ingress on port 6379/TCP", () => {
    expect(np).toMatch(/ports:\s*\n\s+-\s*protocol:\s*TCP\s*\n\s+port:\s*6379/);
  });

  it("does NOT allow ingress from a namespace selector that wildcards namespaces", () => {
    // No namespaceSelector: {} (which would match all namespaces).
    expect(np).not.toMatch(/namespaceSelector:\s*{\s*}/);
    expect(np).not.toMatch(/namespaceSelector:\s*\n\s+matchLabels:\s*{}/);
  });

  it("egress is restricted to DNS only (kube-dns on UDP/TCP 53)", () => {
    expect(np).toMatch(/k8s-app:\s*kube-dns/);
    expect(np).toMatch(/protocol:\s*UDP\s*\n\s+port:\s*53/);
    expect(np).toMatch(/protocol:\s*TCP\s*\n\s+port:\s*53/);
    // Ensure no 0.0.0.0/0 escape hatch sneaks in.
    expect(np).not.toContain("0.0.0.0/0");
  });

  it("does not open egress on port 443 (the queue has no business talking out)", () => {
    expect(np).not.toMatch(/port:\s*443/);
  });
});

describe("kustomization.yaml", () => {
  const k = readManifest(KUSTOMIZATION);

  it("lists all four manifest files", () => {
    expect(k).toContain(CONFIGMAP);
    expect(k).toContain(SERVICE);
    expect(k).toContain(STATEFULSET);
    expect(k).toContain(NETPOL);
  });

  it("does NOT include a placeholder secret (operator repo owns it)", () => {
    expect(k).not.toMatch(/secret/i);
  });
});
