/**
 * @jest-environment node
 */
import { requireAdminBearer } from "@/lib/admin/adminAuth";

describe("requireAdminBearer", () => {
  const OLD = process.env.ITERLAW_ADMIN_API_TOKEN;

  afterEach(() => {
    process.env.ITERLAW_ADMIN_API_TOKEN = OLD;
  });

  it("503 when env missing", () => {
    delete process.env.ITERLAW_ADMIN_API_TOKEN;
    const req = new Request("http://x", { headers: { Authorization: "Bearer x" } }) as unknown as import("next/server").NextRequest;
    const res = requireAdminBearer(req);
    expect(res?.status).toBe(503);
  });

  it("503 when token too short", () => {
    process.env.ITERLAW_ADMIN_API_TOKEN = "short";
    const req = new Request("http://x", { headers: { Authorization: "Bearer short" } }) as unknown as import("next/server").NextRequest;
    expect(requireAdminBearer(req)?.status).toBe(503);
  });

  it("401 on wrong bearer", () => {
    process.env.ITERLAW_ADMIN_API_TOKEN = "long-enough-secret";
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer wrong" },
    }) as unknown as import("next/server").NextRequest;
    expect(requireAdminBearer(req)?.status).toBe(401);
  });

  it("null when bearer matches", () => {
    process.env.ITERLAW_ADMIN_API_TOKEN = "long-enough-secret";
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer long-enough-secret" },
    }) as unknown as import("next/server").NextRequest;
    expect(requireAdminBearer(req)).toBeNull();
  });
});
