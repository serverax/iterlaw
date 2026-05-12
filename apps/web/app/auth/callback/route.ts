import { NextRequest, NextResponse } from 'next/server';

// Local-first build: there is no public-cloud OAuth callback. When a
// self-hosted auth path (Keycloak / Authentik / Zitadel / local
// Postgres-backed) lands, this route is the replacement target. For
// now any callback redirects the user back to the login page with a
// neutral notice.
//
// We deliberately do NOT pass any token, code, or provider hint in
// the redirect URL — that would leak into history, logs, and
// referrers.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/auth/login?notice=local_auth_not_configured`);
}
