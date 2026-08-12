// Flexibel gehouden (niet als union) — een beheerder kan via de Supabase
// Table Editor elke waarde in deze kolom zetten (bijv. "organization",
// "admin") zonder dat dat een schema- of type-wijziging vereist; welke
// waarden als Pro gelden, bepaalt lib/permissions.ts.
export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  available_for_internship: boolean;
  plan_type: string;
  xp: number;
  email: string | null;
};
