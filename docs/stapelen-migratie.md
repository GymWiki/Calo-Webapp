# Bestaande plattegronden en stapelen

Er is **geen migratie** en er is niets op productie uitgevoerd of gewijzigd. Plattegronden laden ongewijzigd; items op vloerhoogte worden bij het laden niet meer
opnieuw gestapeld. Ik heb geen toegang tot de productiedatabase gebruikt, dus het aantal betrokken plattegronden is **niet gemeten**.

Zo tel je zelf (alleen lezen, in de Supabase SQL-editor; maak voor de zekerheid eerst een backup/export van `floorplans_3d`):

```sql
-- Aantal plattegronden met minstens één item dat op vloerhoogte staat terwijl zijn voetafdruk overlapt met een ander item:
-- dat vraagt geometrie (in de app). Een eenvoudige eerste indicatie: plattegronden met items op y = 0 én items met y > 0.
select id, activiteit_id, naam,
       jsonb_array_length(data->'items') as items
from public.floorplans_3d
where exists (select 1 from jsonb_array_elements(data->'items') i where (i->>'y')::numeric = 0)
  and exists (select 1 from jsonb_array_elements(data->'items') i where (i->>'y')::numeric > 0);
```
Voor een echte telling (items die *in* een ander object staan) is een script nodig dat `itemPolygons` en de lagenregels gebruikt; dat is niet geschreven.
