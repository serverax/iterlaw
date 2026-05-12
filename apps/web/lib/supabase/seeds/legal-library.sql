-- IterLaw Axiom — core UK employment statutory library (seed).
-- Run in Supabase SQL editor after creating tables (or merge into migrations).

create table if not exists public.legal_statutes (
  id text primary key,
  citation text not null,
  summary text not null,
  jurisdiction text not null default 'england_wales',
  updated_at timestamptz not null default now()
);

insert into public.legal_statutes (id, citation, summary, jurisdiction)
values
  ('era1996', 'Employment Rights Act 1996', 'Unfair dismissal, redundancy payments, notice.', 'england_wales'),
  ('ea2010', 'Equality Act 2010', 'Discrimination, harassment, victimisation.', 'england_wales'),
  ('nmwa1998', 'National Minimum Wage Act 1998', 'Minimum pay rates and enforcement.', 'england_wales'),
  ('wtr1998', 'Working Time Regulations 1998', 'Hours, rest breaks, annual leave.', 'england_wales'),
  ('tupe2006', 'TUPE 2006', 'Business transfers and employee rights.', 'england_wales'),
  ('era1999', 'Employment Relations Act 1999', 'Union recognition and collective matters.', 'england_wales'),
  ('tulrca1992', 'TULRCA 1992', 'Industrial relations and ballots.', 'england_wales'),
  ('hswa1974', 'Health and Safety at Work etc. Act 1974', 'Safe systems of work.', 'england_wales'),
  ('mpl1999', 'Maternity and Parental Leave etc. Regulations 1999', 'Family leave.', 'england_wales'),
  ('ptw2000', 'Part-time Workers Regulations 2000', 'Part-time comparators.', 'england_wales'),
  ('fte2002', 'Fixed-term Employees Regulations 2002', 'Fixed-term protections.', 'england_wales'),
  ('awr2010', 'Agency Workers Regulations 2010', 'Agency worker rights.', 'england_wales'),
  ('eta1996', 'Employment Tribunals Act 1996', 'Tribunal procedure context.', 'england_wales')
on conflict (id) do update
  set citation = excluded.citation,
      summary = excluded.summary,
      jurisdiction = excluded.jurisdiction,
      updated_at = now();

-- Optional Axiom persistence tables (referenced by lib/supabase/client.ts)
create table if not exists public.axiom_facts (
  case_id text not null,
  fact_id text not null,
  label text not null,
  value text not null,
  confidence double precision not null default 0,
  source_span text,
  user_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (case_id, fact_id)
);

create table if not exists public.axiom_traces (
  case_id text primary key,
  merit_score integer not null,
  jurisdiction text not null,
  steps jsonb not null,
  generated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.axiom_documents (
  case_id text not null,
  document_id text not null,
  title text not null,
  body text not null,
  format text not null default 'plain',
  updated_at timestamptz not null default now(),
  primary key (case_id, document_id)
);
