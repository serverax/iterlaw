'use client';

// Local-first build: no public-cloud session is read here. Until a
// self-hosted auth path lands, the dashboard shows the anonymous
// pilot-mode state. Real user-bound case data is rendered server-
// side via API routes in a later sprint.

export default function DashboardPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0F14',
        color: '#F0EDE6',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Dashboard</h1>
          <p style={{ color: '#9A97A0', marginTop: '0.5rem' }}>
            Anonymous pilot mode. Local-auth is not configured in this build.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <a
            href="/case/assessment"
            style={{
              display: 'block',
              background: '#1A1D26',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #252836',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Start a case
            </h2>
            <p style={{ color: '#9A97A0', marginBottom: '1rem' }}>
              Begin an anonymous assessment of your situation.
            </p>
            <span
              style={{
                display: 'inline-block',
                padding: '10px 16px',
                background: '#C9A84C',
                color: '#0D0F14',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              Open assessment
            </span>
          </a>

          <div
            style={{
              background: '#1A1D26',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #252836',
              opacity: 0.7,
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              My cases
            </h2>
            <p style={{ color: '#9A97A0' }}>
              Available after self-hosted account sign-in lands.
            </p>
          </div>

          <div
            style={{
              background: '#1A1D26',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid #252836',
              opacity: 0.7,
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Settings
            </h2>
            <p style={{ color: '#9A97A0' }}>
              Account, privacy, deletion controls — pending local-auth sprint.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
