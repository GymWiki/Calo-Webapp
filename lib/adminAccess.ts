// Dit project heeft geen rollensysteem (zie remove_user_roles.sql) — beheer
// van de Standaardbibliotheek (supabase/migrations/knowledge_packages.sql)
// is daarom gegated op een vaste e-mail-allowlist, hier én in de database
// (public.is_library_admin(), dezelfde lijst). RLS op de knowledge_package_*
// -tabellen is de echte handhaving; deze check is de UI/actie-laag ervoor
// (nette redirect/foutmelding i.p.v. een RLS-fout die de gebruiker nooit
// zou moeten zien) — nieuwe beheerders toevoegen vereist dus een wijziging
// op TWEE plekken: hier én in de SQL-functie (nieuwe migratie).
const LIBRARY_ADMIN_EMAILS = ["pieter.kluvers06@gmail.com"];

export function isLibraryAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return LIBRARY_ADMIN_EMAILS.includes(email.toLowerCase());
}
