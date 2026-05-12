import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Case — IterLaw",
  description:
    "Start a confidential UK employment-law assessment. Anonymous by default; cite-locked answers only.",
};

export default function CaseLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-6 py-4">
          <p className="text-sm font-medium tracking-wide text-slate-500">
            IterLaw — Case
          </p>
          <p className="text-xs text-slate-400">Not a law firm.</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
