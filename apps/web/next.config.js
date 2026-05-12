const path = require('path');

// NEXT_PUBLIC_* values are inlined at BUILD time. If the operator has
// not provided real Supabase env vars during a build (CI / fresh
// checkout / docs-only build), inline obviously-invalid placeholders
// so the static-page generation step does not crash on Supabase's
// "missing env" guard. At runtime the auth/dashboard pages also
// carry `export const dynamic = "force-dynamic"`, so the placeholder
// is never served to a real user — production deploys MUST set the
// real env values before building. If real env is set during build,
// those real values win because of `??`.
//
// Do NOT hardcode real Supabase URL / anon key here. Do NOT commit a
// real `.env.local`. The placeholder hostname `.invalid` is reserved
// (RFC 2606) and will not resolve, so any accidental runtime
// reference fails closed.

const BUILD_PLACEHOLDER_SUPABASE_URL = 'https://build-placeholder.invalid';
const BUILD_PLACEHOLDER_SUPABASE_ANON_KEY = 'build-time-placeholder-anon-key';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../..'),
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? BUILD_PLACEHOLDER_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? BUILD_PLACEHOLDER_SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;
