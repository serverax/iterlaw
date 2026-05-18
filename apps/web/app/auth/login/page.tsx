'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        window.location.href = '/dashboard';
        return;
      }
      setError('Invalid email or password');
    } catch {
      setError('Login unavailable — use anonymous assessment for pilot mode');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-night px-6">
      <Card className="w-full max-w-md">
        <header className="mb-8">
          <h1 className="font-fraunces text-3xl font-bold text-text-primary">Welcome back</h1>
          <p className="mt-2 text-text-secondary">Sign in to your RightsNow account</p>
        </header>

        {error ? (
          <p className="mb-6 rounded-lg border border-signal-red bg-signal-red/15 p-4 text-sm text-signal-red">
            {error}
          </p>
        ) : null}

        <section className="mb-6 space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </section>

        <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleLogin} className="mb-4">
          Sign In
        </Button>

        <p className="mb-6 text-center text-xs text-text-tertiary">OR</p>

        <section className="mb-6 space-y-2">
          {['Google', 'LinkedIn', 'Microsoft'].map((provider) => (
            <Button key={provider} variant="secondary" size="lg" fullWidth disabled>
              Continue with {provider}
            </Button>
          ))}
        </section>

        <p className="text-center text-sm text-text-secondary">
          No account?{' '}
          <Link href="/auth/register" className="font-semibold text-gold hover:text-gold/80">
            Sign up
          </Link>
        </p>

        <p className="mt-6 border-t border-steel pt-6 text-center text-sm text-text-secondary">
          <Link href="/case/assessment" className="text-gold hover:underline">
            Continue in anonymous pilot mode →
          </Link>
        </p>
      </Card>
    </main>
  );
}
