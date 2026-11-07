# Omgevingen en leerling bijgewerkt (7 november 2026)

## Omgevingen
In de Drive (`3D_Models`) zijn op 7 november 11:13–11:16 UTC zes omgevingen vervangen en een nieuwe toegevoegd. Alle zes hebben er een **omgeving rondom** bij gekregen: vijf losse nodes `Omgeving_Bestrating`, `Omgeving_Bomen_Struiken`, `Omgeving_Gras_Overgang`, `Omgeving_Hagen` en `Omgeving_Meubilair`, buiten het bruikbare vlak (zaal, veld en baan zelf zijn niet veranderd; de bestaande nodenamen zijn allemaal gebleven).

| Omgeving | Wijziging |
| --- | --- |
| `gymzaal_standaard`, `gymzaal_complex_2x2`, `gymzaal_complex_4x1` | + omgeving rondom |
| `sportveld_school_combiveld`, `sportveld_multifunctioneel` | + omgeving rondom |
| `atletiekbaan_compleet` | + omgeving rondom |
| `atletiekbaan_school_sprint_verspringen` (nieuw) | nieuwe indeling **Schoolbaan** (sprintbaan 4 banen, verspringbak, kogelstootring); bruikbaar vlak 82 × 28 m = het grasterrein |
| Zwembad (`zwembad_25m_wedstrijdbad`, `zwembad_instructiebad`) | **niet aangeraakt** |

In de editor: een nieuwe groep **Omgeving rondom** (aan/uit per onderdeel: bestrating, bomen en struiken, gras rondom, hagen, buitenmeubilair), bij het sportveld, de atletiekbaan en (in een eigen sectie) de gymzaal. Standaard aan. Een bestaande plattegrond krijgt de omgeving rondom meteen, zodra de nieuwe GLB's in de bucket staan (de versie `?v=…` in de URL zorgt voor een verse download).

`basketbalbord_los.glb` (map Gymzaal) is ook opnieuw opgeslagen; dat is een losse item-GLB en geen omgeving, dus die is niet verwerkt (zie `docs/nieuwe-assets.md`).

## Leerling
Nieuwe pose **Bal schieten** (`bal_schieten`, categorie Spel, sport Voetbal): bron `leerling_bal_schieten.glb` (1,0 MB → 102 KB, 6000 driehoeken, 0,64 × 0,45 × 1,49 m). `leerling_voetbal_schot.glb` is bytegelijk (zelfde grootte en tijdstip) en is niet apart opgenomen; de kleurvarianten (`_blauw`, `_geel`, `_groen`, `_paars`, `_rood`) zijn niet nodig (de kleur kies je in de editor). Het shirt is marineblauw, dus de kleurkeuze werkt.

## Naar productie (jij draait dit; er is niets naar productie geschreven)
Volgorde: **eerst uploaden, dan deployen** (anders mist de nieuwe pose zijn model en laden de omgevingen nog zonder omgeving rondom).
1. Back-up (advies): Supabase → Storage → `materials-3d` → de mappen `environments/` en `students/` downloaden. Er wordt alleen overschreven wat hieronder staat; terugdraaien = die bestanden terugzetten.
2. Omgevingen (overschrijft de 6 vervangen GLB's en voegt de schoolbaan toe; vereist `NEXT_PUBLIC_SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, de GLB's staan lokaal in `omgeving-import/`):
   `npm run sync:environments -- --upload`
   Het zwembad wordt met dezelfde, ongewijzigde bestanden opnieuw geüpload (identieke inhoud).
3. Leerling (verwerkt bestand en thumbnail staan lokaal in de scratch-map van deze sessie; opnieuw genereren kan zo):
   `npm run process:students -- --src="<map met leerling_bal_schieten.glb>" --only=bal_schieten --thumbs` en daarna `npm run upload:students -- --dry-run` en `npm run upload:students`.
4. Controle in een privévenster: `…/storage/v1/object/public/materials-3d/students/bal_schieten.glb` laadt.
5. Daarna de deploy. Geen databasemigraties.
