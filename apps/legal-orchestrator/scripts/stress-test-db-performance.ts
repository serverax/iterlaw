/**
 * Phase C — database performance smoke tests.
 * Usage: DB_HOST=localhost DB_PORT=5433 DB_USER=iterlaw_user DB_PASSWORD=... DB_NAME=iterlaw_knowledge npx tsx scripts/stress-test-db-performance.ts
 */

import pg from 'pg';

const client = new pg.Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  user: process.env.DB_USER ?? 'iterlaw_user',
  password: process.env.DB_PASSWORD ?? 'TestPassword123456789!',
  database: process.env.DB_NAME ?? 'iterlaw_knowledge',
});

async function timed(name: string, fn: () => Promise<unknown>, expectedMax: number) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    if (ms <= expectedMax) {
      console.log(`OK ${name}: ${ms}ms (target ${expectedMax}ms)`);
      return true;
    }
    console.log(`SLOW ${name}: ${ms}ms (target ${expectedMax}ms)`);
    return false;
  } catch (e) {
    console.log(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

async function main() {
  await client.connect();
  let passed = 0;
  let total = 0;

  total++;
  if (
    await timed('legal_chunks count', () => client.query('SELECT count(*) FROM legal_chunks'), 200)
  )
    passed++;

  total++;
  if (
    await timed(
      'q_a_cache list',
      () => client.query('SELECT id FROM q_a_cache LIMIT 10'),
      200
    )
  )
    passed++;

  total++;
  if (
    await timed(
      'legal_sources by jurisdiction',
      () => client.query("SELECT id FROM legal_sources WHERE jurisdiction = 'england_wales' LIMIT 20"),
      200
    )
  )
    passed++;

  await client.end();
  console.log(`${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

main();
