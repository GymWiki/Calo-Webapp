import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Plain anon-key client, GEEN cookie-plumbing — voor de publieke,
// niet-ingelogde SEO-pagina's (lib/services/publicActivities.ts) die
// uitsluitend public.activiteiten_publiek lezen (zie
// supabase/migrations/activiteiten_public_seo.sql, GRANT SELECT TO anon).
// Nodig i.p.v. utils/supabase/server.ts's cookie-gebonden client: die roept
// intern `cookies()` aan, wat Next.js niet toestaat binnen
// `generateStaticParams` (bouwtijd, geen HTTP-request) — en voor deze
// puur-publieke reads is sessie-bewustzijn sowieso nooit nodig.
export function createPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return createSupabaseClient(supabaseUrl!, supabaseKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
