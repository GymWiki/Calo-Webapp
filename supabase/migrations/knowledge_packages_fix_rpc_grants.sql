-- Vorige revoke (knowledge_packages_revoke_anon_rpc.sql) trok alleen EXECUTE
-- van de 'anon'-rol in, maar Postgres kent nieuwe functies standaard óók
-- EXECUTE toe aan de impliciete PUBLIC-pseudorol, waar 'anon' automatisch
-- van erft — get_advisors (security) bleef dus terecht waarschuwen dat de
-- SECURITY DEFINER-functie via 'anon' aanroepbaar was. Nu expliciet van
-- PUBLIC intrekken en alleen aan authenticated teruggeven (het enige dat
-- deze RPC daadwerkelijk hoeft aan te roepen) — bevestigd opgelost via
-- get_advisors na deze migratie.
revoke execute on function public.match_knowledge_package_chunks(vector, uuid, float, int)
  from public;

grant execute on function public.match_knowledge_package_chunks(vector, uuid, float, int)
  to authenticated;
