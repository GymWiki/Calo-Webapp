-- Voegt 'draft' toe aan activiteiten.status voor de "Concepten"-sectie op
-- de profielpagina: een volledig ingevulde, nog niet ingediende activiteit.
-- Een concept slaat de AI-kwaliteitscheck over (die draait pas bij het
-- daadwerkelijk indienen, via submitActivityDraft in
-- actions/activity-submission.ts) en telt dus ook niet mee voor de
-- maandelijkse bijdrage-eis totdat 'ie is ingediend en goedgekeurd. Geen
-- RLS-wijziging nodig: de bestaande select-policy ("goedgekeurd of eigen")
-- en insert-policy (auteur = zichzelf) dekken dit al.

alter table public.activiteiten drop constraint if exists activiteiten_status_check;

alter table public.activiteiten
  add constraint activiteiten_status_check
    check (status in ('draft', 'pending', 'approved', 'rejected'));
