/**
 * Phase 1 — Controlled /ask E2E (no live Supabase required).
 * Uses an in-memory Supabase chain mock + supertest against createApp().
 *
 * Run: npm run test:phase1
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { createApp } from '../app';
import type { Env } from '../src/config/env';

const dummyEnv: Env = {
  PORT: 4000,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-role-key-for-mock-only',
  ALLOWED_ORIGINS: '*',
};

const QA_APPROVED = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    question: 'What is unfair dismissal under UK employment law?',
    answer:
      'Approved pool answer: Unfair dismissal is when an employer ends your employment without a fair reason or fair process under the Employment Rights Act 1996. This line is pre-approved stored text only — not AI-generated.',
    source: 'legislation',
    approved: true,
  },
];

const TRUSTED = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Statutory notice periods (UK employment law)',
    content:
      'Trusted extract: The statutory minimum notice depends on length of continuous service. This paragraph is stored verbatim from an approved GOV.UK / internal extract — no model rewrite.',
    source: 'gov.uk',
    tags: ['notice', 'period', 'termination'],
  },
];

type Store = { queueRows: unknown[]; askLogs: unknown[] };

function makeSelectChain(getResult: () => { data: unknown; error: null }) {
  const self = {
    select() {
      return self;
    },
    eq() {
      return self;
    },
    order() {
      return self;
    },
    limit() {
      return self;
    },
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(getResult()).then(onFulfilled);
    },
  };
  return self;
}

type MockOpts = {
  qaRows: typeof QA_APPROVED | [];
  trustedRows: typeof TRUSTED | [];
  store: Store;
};

function createMockSupabase(opts: MockOpts): SupabaseClient {
  const { qaRows, trustedRows, store } = opts;
  let queueSeq = 1;

  return {
    from(table: string) {
      if (table === 'qa_pool') {
        return makeSelectChain(() => ({ data: qaRows, error: null }));
      }
      if (table === 'trusted_content') {
        return makeSelectChain(() => ({ data: trustedRows, error: null }));
      }
      if (table === 'legal_review_queue') {
        return {
          insert(row: Record<string, unknown>) {
            return {
              select() {
                return {
                  single() {
                    const id = `33333333-3333-4333-8333-${String(queueSeq++).padStart(12, '0')}`;
                    store.queueRows.push({ ...row, id });
                    return Promise.resolve({ data: { id }, error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'ask_request_logs') {
        return {
          insert(row: Record<string, unknown>) {
            store.askLogs.push(row);
            return {
              then(onFulfilled: (v: unknown) => unknown) {
                return Promise.resolve({ data: null, error: null }).then(onFulfilled);
              },
            };
          },
        };
      }
      throw new Error(`mock: unsupported table ${table}`);
    },
  } as unknown as SupabaseClient;
}

function assertVerifiedShape(body: unknown, label: string): void {
  if (!body || typeof body !== 'object') throw new Error(`${label}: not object`);
  const b = body as Record<string, unknown>;
  if (b.status === 'under_review') {
    if (Object.keys(b).length !== 1) throw new Error(`${label}: under_review must have one key`);
    return;
  }
  if (b.status === 'ok' && b.source === 'qa_pool') {
    if (typeof b.answer !== 'string') throw new Error(`${label}: qa_pool answer`);
    return;
  }
  if (b.status === 'ok' && b.source === 'trusted_content') {
    if (typeof b.content !== 'string') throw new Error(`${label}: trusted content`);
    return;
  }
  throw new Error(`${label}: forbidden response shape`);
}

async function main(): Promise<void> {
  console.log('=== Phase 1 E2E: POST /ask (mock Supabase) ===\n');

  const store1: Store = { queueRows: [], askLogs: [] };
  const app1 = createApp(dummyEnv, {
    supabase: createMockSupabase({ qaRows: QA_APPROVED, trustedRows: TRUSTED, store: store1 }),
  });
  const r1 = await request(app1).post('/ask').send({ question: 'What is unfair dismissal?' });
  console.log('Case 1 — Approved Q&A (HTTP ' + r1.status + ')');
  console.log(JSON.stringify(r1.body, null, 2));
  assertVerifiedShape(r1.body, 'case1');
  if (r1.status !== 200 || (r1.body as { status?: string }).status !== 'ok') throw new Error('case1 failed');
  if ((r1.body as { source?: string }).source !== 'qa_pool') throw new Error('case1 expected qa_pool');
  console.log('');

  const store2: Store = { queueRows: [], askLogs: [] };
  const app2 = createApp(dummyEnv, {
    supabase: createMockSupabase({ qaRows: [], trustedRows: TRUSTED, store: store2 }),
  });
  const r2 = await request(app2).post('/ask').send({ question: 'notice period UK law' });
  console.log('Case 2 — Trusted content (HTTP ' + r2.status + ')');
  console.log(JSON.stringify(r2.body, null, 2));
  assertVerifiedShape(r2.body, 'case2');
  if (r2.status !== 200 || (r2.body as { source?: string }).source !== 'trusted_content') {
    throw new Error('case2 failed');
  }
  console.log('');

  const store3: Store = { queueRows: [], askLogs: [] };
  const app3 = createApp(dummyEnv, {
    supabase: createMockSupabase({ qaRows: [], trustedRows: [], store: store3 }),
  });
  const r3 = await request(app3).post('/ask').send({ question: 'very specific edge case question' });
  console.log('Case 3 — Unknown (HTTP ' + r3.status + ')');
  console.log(JSON.stringify(r3.body, null, 2));
  assertVerifiedShape(r3.body, 'case3');
  if (r3.status !== 200 || (r3.body as { status?: string }).status !== 'under_review') {
    throw new Error('case3 failed');
  }
  console.log('');
  console.log('--- Mock DB: legal_review_queue inserts (case 3) ---');
  console.log(JSON.stringify(store3.queueRows, null, 2));
  console.log('--- Mock DB: ask_request_logs (case 3 request) ---');
  console.log(JSON.stringify(store3.askLogs, null, 2));
  console.log('');
  console.log('--- ask_request_logs case 1 (sample) ---');
  console.log(JSON.stringify(store1.askLogs, null, 2));
  console.log('');
  console.log('Safety: all HTTP JSON bodies matched verified shapes only (qa_pool | trusted_content | under_review).');
  console.log('PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
