'use client';

import Link from 'next/link';
import { useState } from 'react';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="p-2 text-text-primary md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <span className="mb-1 block h-0.5 w-6 bg-text-primary" />
        <span className="mb-1 block h-0.5 w-6 bg-text-primary" />
        <span className="block h-0.5 w-6 bg-text-primary" />
      </button>
      {open ? (
        <nav className="absolute left-0 right-0 top-16 z-50 space-y-2 border-b border-gold/50 bg-steel p-4 md:hidden">
          <Link href="/dashboard" className="block text-text-primary hover:text-gold" onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          <Link href="/case/assessment" className="block text-text-primary hover:text-gold" onClick={() => setOpen(false)}>
            Case
          </Link>
          <Link href="/answer" className="block text-text-primary hover:text-gold" onClick={() => setOpen(false)}>
            Ask
          </Link>
          <Link href="/next-step" className="block text-text-primary hover:text-gold" onClick={() => setOpen(false)}>
            Next steps
          </Link>
        </nav>
      ) : null}
    </>
  );
}
