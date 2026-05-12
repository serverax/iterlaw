import { NextRequest, NextResponse } from 'next/server';

// Local-first build: there is no public-cloud session to validate
// here. Until a self-hosted auth path lands, the middleware is a
// pass-through. Route-level access control lives in the API route
// handlers themselves (e.g. /api/case enforces the iterlaw_anon_sid
// cookie at runtime).

export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/questions/:path*', '/cases/:path*', '/auth/login'],
};
