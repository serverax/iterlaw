/**
 * @jest-environment node
 */
import { GET as casesGET } from "@/app/api/cases/route";
import { GET as historyGET } from "@/app/api/cases/history/route";
import { POST as approvePOST } from "@/app/api/cases/[id]/approve/route";
import { POST as rejectPOST } from "@/app/api/cases/[id]/reject/route";
import { resetCaseApprovalQueueForTests, seedDefaultAdminCases } from "@/lib/admin/caseApprovalQueue";

const TOKEN = "test-admin-token-123456";

function authReq(url: string, init?: RequestInit): import("next/server").NextRequest {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${TOKEN}`);
  return new Request(url, { ...init, headers }) as unknown as import("next/server").NextRequest;
}

describe("Sprint 18 /api/cases routes", () => {
  const OLD = process.env.ITERLAW_ADMIN_API_TOKEN;

  beforeEach(() => {
    process.env.ITERLAW_ADMIN_API_TOKEN = TOKEN;
    resetCaseApprovalQueueForTests();
    seedDefaultAdminCases();
  });

  afterEach(() => {
    process.env.ITERLAW_ADMIN_API_TOKEN = OLD;
  });

  it("GET /api/cases returns 503 when token not configured", async () => {
    delete process.env.ITERLAW_ADMIN_API_TOKEN;
    const res = await casesGET(authReq("http://local/api/cases"));
    expect(res.status).toBe(503);
  });

  it("GET /api/cases returns 401 without bearer", async () => {
    const res = await casesGET(new Request("http://local/api/cases") as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("GET /api/cases lists all with valid bearer", async () => {
    const res = await casesGET(authReq("http://local/api/cases"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cases: { id: string }[] };
    expect(body.cases.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /api/cases?filter=pending returns only pending", async () => {
    const res = await casesGET(authReq("http://local/api/cases?filter=pending"));
    const body = (await res.json()) as { cases: { workflowStatus: string }[] };
    expect(body.cases.every((c) => c.workflowStatus === "awaiting_approval")).toBe(true);
  });

  it("POST approve succeeds for pending case", async () => {
    const res = await approvePOST(authReq("http://local/api/cases/case-demo-1/approve", { method: "POST" }), {
      params: Promise.resolve({ id: "case-demo-1" }),
    });
    expect(res.status).toBe(200);
  });

  it("POST approve returns 409 when not pending", async () => {
    await approvePOST(authReq("http://local/api/cases/case-demo-1/approve", { method: "POST" }), {
      params: Promise.resolve({ id: "case-demo-1" }),
    });
    const res = await approvePOST(authReq("http://local/api/cases/case-demo-1/approve", { method: "POST" }), {
      params: Promise.resolve({ id: "case-demo-1" }),
    });
    expect(res.status).toBe(409);
  });

  it("POST reject requires JSON body", async () => {
    const res = await rejectPOST(
      authReq("http://local/api/cases/case-demo-2/reject", { method: "POST", body: "not-json" }),
      { params: Promise.resolve({ id: "case-demo-2" }) },
    );
    expect(res.status).toBe(400);
  });

  it("POST reject validates reason", async () => {
    const res = await rejectPOST(
      authReq("http://local/api/cases/case-demo-2/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "case-demo-2" }) },
    );
    expect(res.status).toBe(400);
  });

  it("POST reject succeeds with reason", async () => {
    const res = await rejectPOST(
      authReq("http://local/api/cases/case-demo-2/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Incomplete facts" }),
      }),
      { params: Promise.resolve({ id: "case-demo-2" }) },
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/cases/history returns entries after mutations", async () => {
    await approvePOST(authReq("http://local/api/cases/case-demo-1/approve", { method: "POST" }), {
      params: Promise.resolve({ id: "case-demo-1" }),
    });
    const res = await historyGET(authReq("http://local/api/cases/history"));
    const body = (await res.json()) as { entries: unknown[] };
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
  });
});
