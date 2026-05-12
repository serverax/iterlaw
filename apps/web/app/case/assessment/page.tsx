"use client";

import { useState, type FormEvent } from "react";

/**
 * /case/assessment — minimal client UI for the Sprint 12 UI track.
 *
 * Flow:
 *   1. User pastes a free-text narrative.
 *   2. POST /api/case  → creates an in-memory anonymous case (15min TTL),
 *      sets the iterlaw_anon_sid cookie. We never echo the narrative back.
 *   3. User asks a follow-up question.
 *   4. POST /api/orchestrator/legal/ask → forwards to legal-orchestrator,
 *      which runs the deterministic citation pipeline. Until the synthesis
 *      worker is wired, the honest response shape is `insufficient_sources`
 *      or `citation_failed` — both are rendered as-is. The page does not
 *      synthesise a "draft" answer; it surfaces what the orchestrator
 *      actually returns.
 *
 * No model calls in this component. No orchestrator URL in the browser.
 * No credentials.
 */

type CaseState =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "ready"; sid: string; createdAt: string }
  | { kind: "error"; message: string };

type AskState =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "answered"; payload: unknown }
  | { kind: "error"; message: string };

export default function CaseAssessmentPage() {
  const [narrative, setNarrative] = useState("");
  const [question, setQuestion] = useState("");
  const [caseState, setCaseState] = useState<CaseState>({ kind: "idle" });
  const [askState, setAskState] = useState<AskState>({ kind: "idle" });

  async function onCreateCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (narrative.trim().length < 12) {
      setCaseState({
        kind: "error",
        message: "Please describe what happened in at least a sentence or two.",
      });
      return;
    }
    setCaseState({ kind: "creating" });
    try {
      const res = await fetch("/api/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      });
      const body = (await res.json()) as
        | { sid: string; created_at: string; has_preview_snapshot: boolean }
        | { error: string };
      if (!res.ok || !("sid" in body)) {
        setCaseState({
          kind: "error",
          message:
            "error" in body ? body.error : "Could not create case.",
        });
        return;
      }
      setCaseState({ kind: "ready", sid: body.sid, createdAt: body.created_at });
    } catch {
      setCaseState({ kind: "error", message: "Could not create case." });
    }
  }

  async function onAsk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (question.trim().length < 3) return;
    setAskState({ kind: "asking" });
    try {
      const res = await fetch("/api/orchestrator/legal/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ask", question }),
      });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "request_failed";
        setAskState({ kind: "error", message: msg });
        return;
      }
      setAskState({ kind: "answered", payload: body });
    } catch {
      setAskState({ kind: "error", message: "request_failed" });
    }
  }

  return (
    <article className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Start an assessment</h1>
        <p className="text-base text-slate-600">
          Tell us what is happening at work. We don&apos;t store your narrative
          beyond a short anonymous session; answers come back with citations to
          UK employment law sources or with an honest &ldquo;not enough
          sources&rdquo; signal.
        </p>
      </header>

      <section
        aria-labelledby="case-section"
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="case-section" className="text-lg font-semibold text-slate-900">
          1. Your situation
        </h2>
        <form onSubmit={onCreateCase} className="mt-4 space-y-3">
          <label htmlFor="narrative" className="block text-sm font-medium text-slate-700">
            Describe what happened
          </label>
          <textarea
            id="narrative"
            name="narrative"
            required
            minLength={12}
            maxLength={12000}
            rows={6}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            disabled={caseState.kind === "creating" || caseState.kind === "ready"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="E.g. I was dismissed yesterday after raising a grievance about bullying."
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {narrative.length} / 12000 characters
            </p>
            <button
              type="submit"
              disabled={caseState.kind === "creating" || caseState.kind === "ready"}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {caseState.kind === "creating" ? "Creating case…" : "Start assessment"}
            </button>
          </div>
        </form>
        {caseState.kind === "error" ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {caseState.message}
          </p>
        ) : null}
        {caseState.kind === "ready" ? (
          <p className="mt-3 text-sm text-emerald-700">
            Case created. Session reference:{" "}
            <code className="rounded bg-emerald-50 px-1 py-0.5 text-xs text-emerald-900">
              {caseState.sid}
            </code>
            <span className="text-slate-500"> · expires in 15 minutes</span>
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="ask-section"
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="ask-section" className="text-lg font-semibold text-slate-900">
          2. Ask a question
        </h2>
        <form onSubmit={onAsk} className="mt-4 space-y-3">
          <label htmlFor="question" className="block text-sm font-medium text-slate-700">
            Your question
          </label>
          <input
            id="question"
            name="question"
            type="text"
            required
            minLength={3}
            maxLength={4000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={caseState.kind !== "ready" || askState.kind === "asking"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="E.g. Can my employer dismiss me without warning?"
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={caseState.kind !== "ready" || askState.kind === "asking"}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {askState.kind === "asking" ? "Asking…" : "Ask"}
            </button>
          </div>
        </form>
        {askState.kind === "error" ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {askState.message}
          </p>
        ) : null}
        {askState.kind === "answered" ? (
          <pre
            data-testid="orchestrator-response"
            className="mt-4 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100"
          >
            {JSON.stringify(askState.payload, null, 2)}
          </pre>
        ) : null}
      </section>

      <footer className="text-xs text-slate-500">
        We never call an external LLM from this page or from our orchestrator.
        Synthesis runs in an isolated internal worker (ADR 004); until it is
        wired, answers come back as <code>insufficient_sources</code> or
        <code> citation_failed</code> rather than guesses.
      </footer>
    </article>
  );
}
