// Sprint 12A — bash resolver for cross-platform vitest runs.
//
// On Windows, `execFileSync("bash", ...)` fails with ENOENT when Vitest
// runs from a node-only PowerShell environment that does not have Git
// Bash on PATH. This helper finds a working bash binary by trying, in
// order:
//
//   1. process.env.BASH_PATH if set and points to an executable file.
//   2. `bash` itself if it resolves on PATH (validated by a real
//      `bash --version` invocation, not just the existence of a name).
//   3. A small list of common Git-Bash install locations on Windows.
//
// If none of the above works, `resolveBash()` throws a clear error
// telling the operator how to install Git Bash or set BASH_PATH. Tests
// that depend on bash must NOT silently skip; they must fail loudly so
// CI on Windows surfaces the issue.

import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const COMMON_WINDOWS_BASH_PATHS = [
  "C:/Program Files/Git/bin/bash.exe",
  "C:/Program Files/Git/usr/bin/bash.exe",
  "C:/Program Files (x86)/Git/bin/bash.exe",
  "C:/Program Files (x86)/Git/usr/bin/bash.exe",
];

function isExecutableFile(p: string): boolean {
  try {
    const s = statSync(p);
    return s.isFile();
  } catch {
    return false;
  }
}

function probeBash(candidate: string): boolean {
  const r = spawnSync(candidate, ["--version"], {
    encoding: "utf8",
    timeout: 4000,
    windowsHide: true,
  });
  if (r.error) return false;
  if (r.signal === "SIGTERM") return false;
  if (r.status !== 0) return false;
  return /GNU bash|version/.test(r.stdout ?? "");
}

export interface BashResolution {
  path: string;
  source: "env_BASH_PATH" | "path_lookup" | "common_windows_path";
}

export function resolveBash(): BashResolution {
  // 1. Explicit env override.
  const envOverride = process.env.BASH_PATH;
  if (envOverride && envOverride.trim().length > 0) {
    const trimmed = envOverride.trim();
    if (!existsSync(trimmed) || !isExecutableFile(trimmed)) {
      throw new Error(
        `BASH_PATH was set to "${trimmed}" but the file does not exist or is not a regular file. ` +
          "Set BASH_PATH to a real bash binary, or unset it and install Git Bash.",
      );
    }
    if (!probeBash(trimmed)) {
      throw new Error(
        `BASH_PATH was set to "${trimmed}" but \`${trimmed} --version\` did not look like GNU bash. ` +
          "Point BASH_PATH at a real bash binary.",
      );
    }
    return { path: trimmed, source: "env_BASH_PATH" };
  }

  // 2. On Windows, try known Git Bash installs before a generic `bash` on
  //    PATH — Store stubs / WSL shims can hang or mis-resolve under Vitest.
  if (process.platform === "win32") {
    for (const candidate of COMMON_WINDOWS_BASH_PATHS) {
      if (existsSync(candidate) && isExecutableFile(candidate) && probeBash(candidate)) {
        return { path: candidate, source: "common_windows_path" };
      }
    }
  }

  // 3. `bash` on PATH.
  if (probeBash("bash")) {
    return { path: "bash", source: "path_lookup" };
  }

  // 4. Non-Windows: same Git paths are irrelevant; on Windows they were tried in step 2.
  if (process.platform !== "win32") {
    throw new Error(
      "Could not locate a working bash binary. Tried: " +
        `(1) BASH_PATH env var (was empty/unset), ` +
        `(2) "bash" on PATH (not found or not a working GNU bash). ` +
        "Fix: install bash or set BASH_PATH to your bash binary.",
    );
  }

  throw new Error(
    "Could not locate a working bash binary. Tried: " +
      `(1) BASH_PATH env var (was empty/unset), ` +
      `(2) common Git Bash locations: ${COMMON_WINDOWS_BASH_PATHS.join(" ; ")}, ` +
      `(3) "bash" on PATH (not found or not a working GNU bash). ` +
      "Fix: install Git for Windows (gitforwindows.org) OR set BASH_PATH to your bash binary in this shell.",
  );
}

// Convenience: many tests want a string path without needing the source
// field. This wrapper just returns the path.
export function resolveBashPath(): string {
  return resolveBash().path;
}
