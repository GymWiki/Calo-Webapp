# Bestaande plattegronden met een ongeldige markeringencombinatie

Niets is gemigreerd of op productie gewijzigd; de editor laat zulke plattegronden ongewijzigd en toont een waarschuwing met "Herstel" (zie `docs/lijnen-specificaties.md`).
Het aantal betrokken plattegronden/activiteiten is **niet gemeten** (geen databasetoegang gebruikt). Alleen-lezen telling voor jou (maak eerst een export/backup van `floorplans_3d`):

```sql
-- Plattegronden in een gymzaal waarin de ongeldige lijnen "Volleybal (3 dwarsvelden)" aanstaan:
-- de node staat dan NIET in environment.hidden.
select id, activiteit_id, naam
from public.floorplans_3d
where data->'room'->'environment'->>'type' = 'gymzaal'
  and not (data->'room'->'environment'->'hidden') @> '["Lijnen_Volleybal_Dwarsvelden"]'::jsonb;
```
Voor de complexen (2 × 2, 4 achter elkaar) heten de nodes `Lijnen_Volleybal_Dwarsvelden_Zaal_<n>`; pas de naam daarop aan.
