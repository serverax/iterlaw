// anon-session-store — Phase 2C in-memory anonymous case state.
//
// Imported by apps/web/app/api/case/route.ts. Holds the user's
// narrative for up to ANON_SESSION_TTL_MS (15 minutes) until it is
// either consumed by an orchestrator preview or promoted into a
// signed-in user case.
//
// Hard rules:
//   - In-process Map only. No database, no Redis, no network.
//   - Narrative is never re-exposed by the route handler. The store
//     keeps it so the orchestrator preview can read it server-side.
//   - The sid is generated from `crypto.randomBytes` so it is not
//     guessable across requests.
//   - Expired sessions are dropped lazily on read. They are also
//     dropped on a best-effort sweep when the store size exceeds a
//     soft cap.

import { randomBytes } from "node:crypto";

export const ANON_SESSION_TTL_MS = 15 * 60 * 1000;

const SOFT_CAP = 10_000;

export interface AnonSessionPreviewSnapshot {
  generatedAt: number;
  // Free-shape — the orchestrator decides what to put here. The route
  // only checks for non-null.
  payload: unknown;
}

export interface AnonSession {
  sid: string;
  createdAt: number;
  narrative: string;
  previewSnapshot: AnonSessionPreviewSnapshot | null;
}

interface StoredAnonSession extends AnonSession {
  expiresAt: number;
}

const store: Map<string, StoredAnonSession> = new Map();

function now(): number {
  return Date.now();
}

function newSid(): string {
  return randomBytes(24).toString("hex");
}

function pruneIfOversize(): void {
  if (store.size <= SOFT_CAP) return;
  const cutoff = now();
  store.forEach((session, sid) => {
    if (session.expiresAt <= cutoff) store.delete(sid);
  });
}

function publicView(s: StoredAnonSession): AnonSession {
  return {
    sid: s.sid,
    createdAt: s.createdAt,
    narrative: s.narrative,
    previewSnapshot: s.previewSnapshot,
  };
}

export function createAnonSession(narrative: string): AnonSession {
  const t = now();
  const sid = newSid();
  const session: StoredAnonSession = {
    sid,
    createdAt: t,
    expiresAt: t + ANON_SESSION_TTL_MS,
    narrative,
    previewSnapshot: null,
  };
  store.set(sid, session);
  pruneIfOversize();
  return publicView(session);
}

export function getAnonSession(sid: string): AnonSession | null {
  const session = store.get(sid);
  if (!session) return null;
  if (session.expiresAt <= now()) {
    store.delete(sid);
    return null;
  }
  return publicView(session);
}

export function setPreviewSnapshot(
  sid: string,
  snapshot: AnonSessionPreviewSnapshot,
): boolean {
  const session = store.get(sid);
  if (!session) return false;
  if (session.expiresAt <= now()) {
    store.delete(sid);
    return false;
  }
  session.previewSnapshot = snapshot;
  return true;
}

export function __resetAnonSessionStoreForTests(): void {
  store.clear();
}
