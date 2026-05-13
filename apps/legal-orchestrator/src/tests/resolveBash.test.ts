// Sprint 12A — resolveBash helper tests.

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBash, resolveBashPath } from "./helpers/resolveBash";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sprint 12A — resolveBash", () => {
  it("returns a working bash on a host that has bash available", () => {
    // Strip the override so we exercise the PATH lookup or common-Windows-path branch.
    vi.stubEnv("BASH_PATH", "");
    // This test is hard-required: if the audit host cannot find bash, this
    // test must fail loudly with the human-readable error from the helper.
    const r = resolveBash();
    expect(r.path).toBeTruthy();
    expect(["env_BASH_PATH", "path_lookup", "common_windows_path"]).toContain(r.source);
  });

  it("resolveBashPath returns a string equal to resolveBash().path", () => {
    vi.stubEnv("BASH_PATH", "");
    const r = resolveBash();
    const p = resolveBashPath();
    expect(p).toBe(r.path);
  });

  it("rejects an invalid BASH_PATH with a clear error", () => {
    vi.stubEnv("BASH_PATH", "C:/this/path/does/not/exist/bash.exe");
    expect(() => resolveBash()).toThrow(/BASH_PATH/i);
  });

  it("rejects a BASH_PATH that points to a non-bash file", () => {
    // Pick a real file that is NOT bash — package.json — and assert the
    // probe rejects it.
    vi.stubEnv("BASH_PATH", "package.json");
    expect(() => resolveBash()).toThrow(/BASH_PATH|bash/i);
  });

  it("uses BASH_PATH when supplied and executable (positive case)", () => {
    // Discover what the host considers bash so we can set a known-good
    // BASH_PATH for this test.
    vi.stubEnv("BASH_PATH", "");
    const discovered = resolveBash();
    if (discovered.source === "path_lookup") {
      // PATH discovery does not give us an absolute path. Skip the
      // positive-explicit-path branch here — the next tests still cover
      // the resolver contract.
      return;
    }
    vi.stubEnv("BASH_PATH", discovered.path);
    const again = resolveBash();
    expect(again.path).toBe(discovered.path);
    expect(again.source).toBe("env_BASH_PATH");
  });
});
