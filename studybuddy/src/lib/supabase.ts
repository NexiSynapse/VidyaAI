import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseInstance: ReturnType<typeof createClient> | null = null;
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function createMockClient() {
  const noop = () => ({
    data: null,
    error: { message: 'Supabase not configured (missing env vars)' },
  });

  const chainable = {
    select: () => chainable,
    eq: () => chainable,
    neq: () => chainable,
    gt: () => chainable,
    gte: () => chainable,
    lt: () => chainable,
    lte: () => chainable,
    like: () => chainable,
    ilike: () => chainable,
    is: () => chainable,
    in: () => chainable,
    contains: () => chainable,
    containedBy: () => chainable,
    range: () => chainable,
    limit: () => chainable,
    order: () => chainable,
    single: noop,
    maybeSingle: noop,
    then: (resolve: (v: any) => void) => resolve(noop()),
  };

  return {
    from: () => chainable,
    rpc: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    storage: { from: () => ({ upload: noop, download: noop, remove: noop, list: noop }) },
  };
}

function validUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getSupabase() {
  if (!supabaseInstance) {
    if (!validUrl(supabaseUrl) || !supabaseAnonKey) {
      return createMockClient() as any;
    }
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    if (!validUrl(supabaseUrl) || !supabaseServiceKey) {
      return createMockClient() as any;
    }
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdminInstance;
}

export const supabase = getSupabase();
export const supabaseAdmin = getSupabaseAdmin();