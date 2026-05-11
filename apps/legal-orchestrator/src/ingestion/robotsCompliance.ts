// Minimal robots.txt parser: User-agent: * Disallow rules only.
// Not a full RFC-compliant robots engine — sufficient for skeleton guardrails.

const cache = new Map<string, { fetchedAt: number; rules: string[]; ttlMs: number }>();
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function parseDisallowPaths(robotsBody: string): string[] {
  const lines = robotsBody.split(/\r?\n/);
  const disallows: string[] = [];
  let inStarAgent = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const mUa = /^user-agent:\s*(.+)$/i.exec(line);
    if (mUa) {
      inStarAgent = mUa[1].trim() === "*";
      continue;
    }
    const mDis = /^disallow:\s*(.*)$/i.exec(line);
    if (mDis && inStarAgent) {
      const p = mDis[1].trim();
      if (p.length > 0) disallows.push(p);
    }
  }
  return disallows;
}

function pathDisallowed(path: string, disallows: string[]): boolean {
  const norm = path.startsWith("/") ? path : `/${path}`;
  for (const d of disallows) {
    if (d === "/") return true;
    if (norm === d || norm.startsWith(d.endsWith("/") ? d : `${d}/`)) return true;
  }
  return false;
}

export interface RobotsFetchDeps {
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

export async function isUrlAllowedByRobots(
  robotsHost: string,
  path: string,
  deps?: RobotsFetchDeps
): Promise<{ allowed: boolean; reason?: string }> {
  const fetchFn = deps?.fetchImpl ?? fetch;
  const now = deps?.nowMs ?? (() => Date.now());
  const key = robotsHost;
  const robotsUrl = `https://${robotsHost}/robots.txt`;

  let entry = cache.get(key);
  if (!entry || now() - entry.fetchedAt > entry.ttlMs) {
    try {
      const res = await fetchFn(robotsUrl, {
        method: "GET",
        headers: { Accept: "text/plain,*/*" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        // If robots is missing, allow (permissive default for skeleton) but note.
        entry = { fetchedAt: now(), rules: [], ttlMs: DEFAULT_TTL_MS };
        cache.set(key, entry);
        return { allowed: true, reason: `robots_fetch_${res.status}_permissive` };
      }
      const body = await res.text();
      entry = { fetchedAt: now(), rules: parseDisallowPaths(body), ttlMs: DEFAULT_TTL_MS };
      cache.set(key, entry);
    } catch {
      return { allowed: true, reason: "robots_fetch_error_permissive" };
    }
  }

  if (pathDisallowed(path, entry.rules)) {
    return { allowed: false, reason: "disallowed_by_robots_txt" };
  }
  return { allowed: true };
}

/** Test hook — clear cached robots responses. */
export function __clearRobotsCacheForTests(): void {
  cache.clear();
}
