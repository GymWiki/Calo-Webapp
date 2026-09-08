import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — omzeilt RLS volledig. Alleen te gebruiken in
// server-only code zonder gebruikerssessie (bijv. de Stripe-webhook, waar
// geen cookies/auth.uid() beschikbaar zijn) en nooit importeren in
// client-code of doorgeven aan de browser.
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ontbreekt. Zet deze omgevingsvariabele (Supabase-dashboard > Project Settings > API) om de Stripe-webhook abonnementen te laten bijwerken.",
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
