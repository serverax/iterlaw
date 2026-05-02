-- Step 7 — Q&A pool (exact hash cache) + answer cost observability.
-- Apply in Supabase SQL editor or via migration runner.

create table if not exists public.qa_pool_entries (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,
  content_hash text not null,
  question_text text not null,
  answer jsonb not null,
  source text not null check (source in ('gov', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_hash, jurisdiction)
);

create index if not exists qa_pool_entries_jurisdiction_idx on public.qa_pool_entries (jurisdiction);

create table if not exists public.answer_cost_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  layer text not null,
  est_cost_gbp numeric not null default 0,
  content_hash text,
  jurisdiction text,
  meta jsonb
);

create index if not exists answer_cost_logs_occurred_idx on public.answer_cost_logs (occurred_at desc);

-- Optional: enable pgvector semantic search later (cosine >= 0.92) by adding an embedding column + RPC.
