/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CaseAssessmentPage from "@/app/case/assessment/page";

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  jest.clearAllMocks();
});

const VALID_NARRATIVE =
  "I was dismissed without notice yesterday after raising a grievance about bullying at work last week.";

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; body: unknown }>) {
  let i = 0;
  global.fetch = jest.fn(async () => {
    const r = responses[i++];
    if (!r) throw new Error("fetch called more times than mocked");
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: async () => r.body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("/case/assessment page", () => {
  it("renders the two-step form", () => {
    render(<CaseAssessmentPage />);
    expect(
      screen.getByRole("heading", { name: /start an assessment/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/describe what happened/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your question/i)).toBeInTheDocument();
  });

  it("disables the Ask field until a case is created", () => {
    render(<CaseAssessmentPage />);
    expect(screen.getByLabelText(/your question/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /ask/i })).toBeDisabled();
  });

  it("rejects a too-short narrative client-side", async () => {
    render(<CaseAssessmentPage />);
    const textarea = screen.getByLabelText(/describe what happened/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "short" } });
    fireEvent.submit(textarea.closest("form")!);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/at least a sentence/i),
    );
  });

  it("creates a case and enables the question form", async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 201,
        body: {
          sid: "sid-test-1",
          created_at: "2026-05-12T03:00:00.000Z",
          has_preview_snapshot: false,
        },
      },
    ]);
    render(<CaseAssessmentPage />);
    const textarea = screen.getByLabelText(/describe what happened/i);
    fireEvent.change(textarea, { target: { value: VALID_NARRATIVE } });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() =>
      expect(screen.getByText(/Case created/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("sid-test-1")).toBeInTheDocument();
    expect(screen.getByLabelText(/your question/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /ask/i })).not.toBeDisabled();
  });

  it("surfaces orchestrator response payload after asking a question", async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 201,
        body: { sid: "sid-2", created_at: "2026-05-12T03:00:00.000Z", has_preview_snapshot: false },
      },
      {
        ok: true,
        status: 200,
        body: {
          status: "insufficient_sources",
          citations: [],
          external_llm_used: false,
          retrieval_notes: ["mock_retrieval_no_chunks"],
          next_steps: ["Add more facts."],
        },
      },
    ]);
    render(<CaseAssessmentPage />);
    fireEvent.change(screen.getByLabelText(/describe what happened/i), {
      target: { value: VALID_NARRATIVE },
    });
    fireEvent.submit(screen.getByLabelText(/describe what happened/i).closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(/Case created/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/your question/i), {
      target: { value: "Can my employer dismiss me without warning?" },
    });
    fireEvent.submit(screen.getByLabelText(/your question/i).closest("form")!);
    const out = await screen.findByTestId("orchestrator-response");
    expect(out).toHaveTextContent(/insufficient_sources/);
    expect(out).toHaveTextContent(/external_llm_used/);
    expect(out).toHaveTextContent(/false/);
  });

  it("never sends client-supplied identity fields to /api/orchestrator/legal/ask", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
      });
      if (url === "/api/case") {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            sid: "sid-3",
            created_at: "2026-05-12T03:00:00.000Z",
            has_preview_snapshot: false,
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "insufficient_sources", citations: [] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<CaseAssessmentPage />);
    fireEvent.change(screen.getByLabelText(/describe what happened/i), {
      target: { value: VALID_NARRATIVE },
    });
    fireEvent.submit(screen.getByLabelText(/describe what happened/i).closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(/Case created/i)).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/your question/i), {
      target: { value: "Test question?" },
    });
    fireEvent.submit(screen.getByLabelText(/your question/i).closest("form")!);
    await screen.findByTestId("orchestrator-response");

    const askCall = calls.find((c) => c.url === "/api/orchestrator/legal/ask");
    expect(askCall).toBeDefined();
    const body = askCall!.body as Record<string, unknown>;
    expect(body.mode).toBe("ask");
    expect(body.question).toBe("Test question?");
    expect(body.user_id).toBeUndefined();
    expect(body.request_id).toBeUndefined();
    expect(body.workspace_id).toBeUndefined();
  });

  it("renders an error alert when /api/case returns non-ok", async () => {
    mockFetchSequence([{ ok: false, status: 500, body: { error: "internal_error" } }]);
    render(<CaseAssessmentPage />);
    fireEvent.change(screen.getByLabelText(/describe what happened/i), {
      target: { value: VALID_NARRATIVE },
    });
    fireEvent.submit(screen.getByLabelText(/describe what happened/i).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/internal_error/);
  });

  it("renders an error alert when /api/orchestrator/legal/ask returns non-ok", async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 201,
        body: { sid: "sid-x", created_at: "2026-05-12T03:00:00.000Z", has_preview_snapshot: false },
      },
      { ok: false, status: 502, body: { error: "orchestrator_unreachable" } },
    ]);
    render(<CaseAssessmentPage />);
    fireEvent.change(screen.getByLabelText(/describe what happened/i), {
      target: { value: VALID_NARRATIVE },
    });
    fireEvent.submit(screen.getByLabelText(/describe what happened/i).closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(/Case created/i)).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/your question/i), {
      target: { value: "Test?" },
    });
    fireEvent.submit(screen.getByLabelText(/your question/i).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/orchestrator_unreachable/);
  });
});
