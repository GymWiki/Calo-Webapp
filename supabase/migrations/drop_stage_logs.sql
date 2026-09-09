-- Stage-logboek is verwijderd uit de app (placeholder-pagina zonder
-- achterliggende functionaliteit — zie app/(protected)/stage-logboek,
-- inmiddels verwijderd). De tabel is altijd leeg gebleven, dus veilig te
-- droppen.
drop table if exists public.stage_logs;
