import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-amber-400">RightsNow</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/auth/login" className="text-slate-300 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/case/assessment"
              className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-4xl font-bold leading-tight md:text-5xl">
          Know your rights.
          <br />
          <span className="text-amber-400">Right now.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          UK employment law guidance when you need it — what the law says, what it means for you,
          and what to do tonight. Information only, not legal advice.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/case/assessment"
            className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-950 hover:bg-amber-400"
          >
            Start free assessment
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-600 px-6 py-3 font-semibold text-slate-200 hover:border-amber-500/50"
          >
            Your dashboard
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { title: 'Ask a question', href: '/answer', desc: 'Law, meaning, and next step' },
          { title: 'Your case', href: '/dashboard', desc: 'Timeline, documents, activity' },
          { title: 'Next steps', href: '/next-step', desc: 'Stage-based guidance' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:border-amber-500/40"
          >
            <h3 className="font-semibold text-amber-400">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
