'use client';

// IterLaw is local-first / self-hosted. Browser-side public-cloud
// auth (Supabase / Auth0 / Clerk) is NOT in the default build path.
// During pilot, the only available user state is the anonymous
// case-session held in apps/web/lib/anon-session/anon-session-store
// behind /api/case. Once a self-hosted auth path lands (see
// docs/iterlaw/ITERLAW_LOCAL_FIRST_DB_AND_AUTH_ARCHITECTURE.md), this
// page is the replacement target.

export default function LoginPage() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '480px',
        padding: '2rem',
        background: '#1A1D26',
        borderRadius: '12px',
        border: '1px solid #252836',
        color: '#F0EDE6',
      }}
    >
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '0.75rem',
        }}
      >
        Sign in
      </h1>
      <p
        style={{
          fontSize: '14px',
          color: '#9A97A0',
          marginBottom: '1.5rem',
          lineHeight: 1.5,
        }}
      >
        Local-auth is not configured in this build. IterLaw is running
        in <strong>anonymous pilot mode</strong>: your case narrative
        is held in a server-side session for up to 15 minutes and is
        never sent to a public cloud provider.
      </p>
      <p
        style={{
          fontSize: '13px',
          color: '#9A97A0',
          marginBottom: '1.5rem',
          lineHeight: 1.5,
        }}
      >
        To continue, start a case from the assessment flow. Your
        narrative stays in this browser session; nothing is persisted
        until you choose to create an account in a future self-hosted
        auth step.
      </p>
      <a
        href="/case/assessment"
        style={{
          display: 'inline-block',
          padding: '10px 16px',
          background: '#C9A84C',
          color: '#0D0F14',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 500,
          fontSize: '14px',
        }}
      >
        Start anonymous assessment
      </a>
      <div
        style={{
          padding: '12px',
          marginTop: '1.5rem',
          background: '#FFF8E1',
          color: '#3D3D3A',
          borderRadius: '8px',
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        IterLaw provides general information based on UK Government
        sources. This is not professional legal advice. Always consult
        a qualified employment solicitor for advice on your specific
        situation.
      </div>
    </div>
  );
}
