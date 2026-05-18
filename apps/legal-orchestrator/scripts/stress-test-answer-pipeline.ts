/**
 * Phase C — answer pipeline stress (local HTTP probes).
 * Usage: npx tsx scripts/stress-test-answer-pipeline.ts
 */

const ORCH = process.env.ORCH_URL ?? 'http://localhost:8081';
const NUM = Number(process.env.STRESS_N ?? 20);
const CONCURRENT = Number(process.env.STRESS_C ?? 5);

const QUESTIONS = [
  'Can my employer dismiss me without a disciplinary hearing?',
  'Am I entitled to redundancy pay after two years?',
  'Is workplace discrimination unlawful in the UK?',
];

async function probeHealth(): Promise<boolean> {
  const res = await fetch(`${ORCH}/health`);
  return res.ok;
}

async function runOne(i: number): Promise<{ ok: boolean; ms: number; err?: string }> {
  const start = Date.now();
  try {
    const ok = await probeHealth();
    return { ok, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, err: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  console.log(`Stress: ${NUM} requests, concurrency ${CONCURRENT}, target ${ORCH}`);
  let passed = 0;
  let failed = 0;
  let totalMs = 0;
  const errors: string[] = [];

  const queue: Promise<void>[] = [];
  for (let i = 0; i < NUM; i++) {
    const p = runOne(i).then((r) => {
      if (r.ok) {
        passed++;
        totalMs += r.ms;
      } else {
        failed++;
        if (r.err) errors.push(`#${i}: ${r.err}`);
      }
    });
    queue.push(p);
    if (queue.length >= CONCURRENT) {
      await Promise.race(queue);
      queue.splice(
        queue.findIndex((x) => (x as Promise<unknown> & { _settled?: boolean })._settled),
        1
      );
    }
  }
  await Promise.all(queue);

  const avg = passed ? totalMs / passed : 0;
  console.log(`Passed: ${passed}/${NUM}`);
  console.log(`Failed: ${failed}`);
  console.log(`Avg ms: ${avg.toFixed(0)}`);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  process.exit(failed > 0 ? 1 : 0);
}

main();
