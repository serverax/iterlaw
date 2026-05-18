'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@/components/ui';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="flex min-h-screen items-center justify-center bg-night px-6">
      <Card className="w-full max-w-md">
        <header className="mb-8">
          <h1 className="font-fraunces text-3xl font-bold text-text-primary">Create account</h1>
          <p className="mt-2 text-text-secondary">Registration opens with self-hosted auth (pilot stub)</p>
        </header>

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

        <Button variant="primary" size="lg" fullWidth disabled className="mb-4">
          Create account (coming soon)
        </Button>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-gold hover:text-gold/80">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
