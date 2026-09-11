-- get_advisors (security) flagde match_knowledge_package_chunks als door de
-- 'anon'-rol aanroepbaar via /rest/v1/rpc/... — het is SECURITY DEFINER en
-- omzeilt dus RLS, dus dat zou een uitgelogde bezoeker toegang geven tot
-- Standaardbibliotheek-fragmenten (mogelijk auteursrechtelijk gevoelig).
-- Bedoeld gebruik is uitsluitend server-side met een ingelogde sessie
-- (lib/ai/knowledgeRetrieval.ts) — authenticated-toegang blijft dus staan,
-- alleen anon wordt ingetrokken.
revoke execute on function public.match_knowledge_package_chunks(vector, uuid, float, int)
  from anon;
