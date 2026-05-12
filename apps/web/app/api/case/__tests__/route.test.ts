/**
 * @jest-environment node
 */

// Mock next/headers cookies() — read-only side; the route uses
// NextResponse.cookies.set(...) which is on the response object,
// not on the cookies() store, so it works without mocking writes.
const cookieStore = new Map<string, string>();
jest.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
  }),
}));

import { POST as casePOST, GET as caseGET } from "@/app/api/case/route";
import { __resetAnonSessionStoreForTests } from "@/lib/anon-session/anon-session-store";

function makePostReq(body: unknown): import("next/server").NextRequest {
  return new Request("http://local/api/case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/case", () => {
  beforeEach(() => {
    cookieStore.clear();
    __resetAnonSessionStoreForTests();
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://local/api/case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }) as unknown as import("next/server").NextRequest;
    const res = await casePOST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json_body" });
  });

  it("returns 400 when narrative is too short", async () => {
    const res = await casePOST(makePostReq({ narrative: "short" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  it("rejects extra fields (strict schema)", async () => {
    const res = await casePOST(
      makePostReq({
        narrative: "I was dismissed without notice yesterday after raising a grievance about bullying.",
        user_id: "EVIL",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a new case and returns 201 with sid", async () => {
    const res = await casePOST(
      makePostReq({
        narrative: "I was dismissed without notice yesterday after raising a grievance about bullying.",
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      sid: string;
      created_at: string;
      has_preview_snapshot: boolean;
    };
    expect(typeof json.sid).toBe("string");
    expect(json.sid.length).toBeGreaterThan(0);
    expect(json.has_preview_snapshot).toBe(false);
    // created_at is an ISO timestamp
    expect(json.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("never echoes the narrative back to the client", async () => {
    const narrative =
      "SECRET_NARRATIVE_TOKEN — I was dismissed without notice yesterday after raising a grievance.";
    const res = await casePOST(makePostReq({ narrative }));
    expect(res.status).toBe(201);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("SECRET_NARRATIVE_TOKEN");
    expect(text).not.toContain(narrative);
  });

  it("sets the iterlaw_anon_sid cookie with httpOnly + sameSite=lax", async () => {
    const res = await casePOST(
      makePostReq({
        narrative: "I was dismissed without notice yesterday after raising a grievance about bullying.",
      }),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/iterlaw_anon_sid=/);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie.toLowerCase()).toContain("path=/");
  });
});

describe("GET /api/case", () => {
  beforeEach(() => {
    cookieStore.clear();
    __resetAnonSessionStoreForTests();
  });

  it("returns 404 no_session when no cookie is present", async () => {
    const res = await caseGET();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_session" });
  });

  it("returns 404 session_expired when cookie sid is unknown", async () => {
    cookieStore.set("iterlaw_anon_sid", "stale-or-fake-sid");
    const res = await caseGET();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "session_expired" });
  });

  it("returns the session shape (no narrative) when cookie points to a live session", async () => {
    // Seed a session via POST so the store gets a real record.
    const createRes = await casePOST(
      makePostReq({
        narrative: "I was dismissed without notice yesterday after raising a grievance about bullying.",
      }),
    );
    const { sid } = (await createRes.json()) as { sid: string };
    cookieStore.set("iterlaw_anon_sid", sid);

    const res = await caseGET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      sid: string;
      created_at: string;
      has_preview_snapshot: boolean;
    };
    expect(json.sid).toBe(sid);
    expect(json.has_preview_snapshot).toBe(false);
    expect(JSON.stringify(json)).not.toContain("dismissed without notice");
  });
});
