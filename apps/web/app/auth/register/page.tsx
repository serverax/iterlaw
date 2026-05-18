'use client';

import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 text-slate-100">
      <h1 className="mb-2 text-2xl font-bold">Create account</h1>
      <p className="mb-6 text-sm text-slate-400">
        Registration is a stub in this build. Use anonymous assessment to continue.
      </p>
      <form className="mb-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
        />
        <Link
          href="/case/assessment"
          className="block w-full rounded-lg bg-amber-500 py-3 text-center font-semibold text-slate-950 hover:bg-amber-400"
        >
          Continue with assessment
        </Link>
      </form>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-amber-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
