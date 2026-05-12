// Local-first auth stub.
//
// IterLaw is self-hosted; the default build path has no public-cloud
// auth provider wired. Once a self-hosted auth path (Keycloak /
// Authentik / Zitadel / local Postgres-backed) lands, this file is
// the replacement target.
//
// For now the helpers below return `null`. Server-side callers should
// treat that as "not signed in" and use the anonymous case-session
// path in `apps/web/lib/anon-session/anon-session-store` instead.
//
// IMPORTANT: no caller of these helpers should reach across the
// browser/server boundary with a DB credential. Server-side API
// routes are the only place that opens a DB connection.

export type IterLawSession = null;
export type IterLawUser = null;

export async function getSession(): Promise<IterLawSession> {
  return null;
}

export async function getUser(): Promise<IterLawUser> {
  return null;
}
