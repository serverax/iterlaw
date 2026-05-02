-- Sample rows for manual testing (run as postgres / service role; bypasses RLS)
-- Idempotent: removes prior seed rows for the same fixed UUIDs / email.

BEGIN;

DELETE FROM public.solicitor_referrals
WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;

DELETE FROM public.documents
WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;

DELETE FROM public.questions
WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;

DELETE FROM public.case_timeline_entries
WHERE case_id = '22222222-2222-4222-8222-222222222222'::uuid;

DELETE FROM public.cases
WHERE id = '22222222-2222-4222-8222-222222222222'::uuid;

DELETE FROM public.users
WHERE id = '11111111-1111-4111-8111-111111111111'::uuid;

DELETE FROM public.solicitor_partners
WHERE id = '33333333-3333-4333-8333-333333333333'::uuid;

INSERT INTO public.solicitor_partners (
  id,
  firm_name,
  contact_email,
  contact_phone,
  jurisdiction_coverage,
  referral_fee,
  is_active
) VALUES (
  '33333333-3333-4333-8333-333333333333'::uuid,
  'RightsNow Test Solicitors LLP',
  'partners@rightsnow.test',
  '+44 20 0000 0000',
  ARRAY['england_wales']::text[],
  99.00,
  true
);

INSERT INTO public.users (
  id,
  email,
  oauth_provider,
  oauth_id,
  subscription_tier,
  jurisdiction
) VALUES (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'test@rightsnow.local',
  'google',
  'test-google-id',
  'free',
  'england_wales'
);

INSERT INTO public.cases (
  id,
  user_id,
  situation_type,
  case_stage,
  is_active
) VALUES (
  '22222222-2222-4222-8222-222222222222'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'dismissal',
  'awaiting_hearing',
  true
);

INSERT INTO public.case_timeline_entries (
  case_id,
  event_date,
  event_type,
  title,
  description
) VALUES (
  '22222222-2222-4222-8222-222222222222'::uuid,
  CURRENT_DATE,
  'note_added',
  'Case opened (seed)',
  'Seed data for RightsNow manual QA'
);

INSERT INTO public.questions (
  case_id,
  user_id,
  question_text,
  question_embedding,
  jurisdiction,
  situation_type,
  answer_law_section,
  answer_meaning,
  answer_action,
  source_citation,
  source_url,
  source_type,
  confidence_score,
  legislation_version,
  expires_at,
  is_active,
  hit_count
)
SELECT
  '22222222-2222-4222-8222-222222222222'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'What is unfair dismissal?',
  (SELECT array_agg(g::float4 ORDER BY g)::vector FROM generate_series(1, 1536) AS g),
  'england_wales',
  'dismissal',
  'ERA 1996 s.94 — right not to be unfairly dismissed (eligibility rules apply).',
  'If you are an employee with 2 years'' service (with exceptions), you may claim unfair dismissal.',
  'Gather your dismissal letter and key dates; check limitation periods.',
  'Employment Rights Act 1996, section 94',
  'https://www.legislation.gov.uk/ukpga/1996/18/section/94',
  'GOV_API',
  0.85,
  'ERA 1996 as amended (illustrative)',
  (CURRENT_DATE + interval '90 days')::date,
  true,
  0;

INSERT INTO public.documents (
  case_id,
  user_id,
  document_type,
  extracted_text,
  analysis_result,
  image_deletion_scheduled_for
) VALUES (
  '22222222-2222-4222-8222-222222222222'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'dismissal_letter',
  NULL,
  NULL,
  NOW() + interval '24 hours'
);

INSERT INTO public.solicitor_referrals (
  case_id,
  user_id,
  reason,
  case_summary_pdf_url,
  referred_to_solicitor_id,
  status
) VALUES (
  '22222222-2222-4222-8222-222222222222'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'user_requested',
  NULL,
  '33333333-3333-4333-8333-333333333333'::uuid,
  'pending'
);

COMMIT;
