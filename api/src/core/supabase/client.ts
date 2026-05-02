import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export function loadSupabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Function App settings');
  }
  return { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key };
}

export function createServiceSupabase(env: SupabaseEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getServiceSupabase(): SupabaseClient {
  return createServiceSupabase(loadSupabaseEnv());
}
