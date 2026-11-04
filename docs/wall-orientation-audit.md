# Audit wandoriëntatie (wandrekken)

Gegenereerd door `scripts/audit-wall-orientation.ts`. Het model heeft de voorkant (klimzijde, ribben) op lokale +Z en de montageconsole op lokale −Z (z = −0,14).

| zaalmodel | node | positie (x, z) | yaw voor | voorkant wijst (voor) | yaw na | voorkant wijst (na) | achterkant z na | wandbinnenkant z | afstand | uitkomst |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gymzaal_standaard | Wandrek_1 | (-5.50, -6.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -6.970 | -6.970 | 0.0 cm | PASS |
| gymzaal_standaard | Wandrek_2 | (5.50, -6.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -6.970 | -6.970 | 0.0 cm | PASS |
| gymzaal_complex_2x2 | Wandrek_Zaal_1_A | (-17.50, -13.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -13.970 | -13.970 | 0.0 cm | PASS |
| gymzaal_complex_2x2 | Wandrek_Zaal_1_B | (-6.50, -13.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -13.970 | -13.970 | 0.0 cm | PASS |
| gymzaal_complex_2x2 | Wandrek_Zaal_2_A | (6.50, -13.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -13.970 | -13.970 | 0.0 cm | PASS |
| gymzaal_complex_2x2 | Wandrek_Zaal_2_B | (17.50, -13.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -13.970 | -13.970 | 0.0 cm | PASS |
| gymzaal_complex_4x1 | Wandrek_Zaal_4_A | (-5.50, -27.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -27.970 | -27.970 | 0.0 cm | PASS |
| gymzaal_complex_4x1 | Wandrek_Zaal_4_B | (5.50, -27.92) | -180° | **de wand in (fout)** | 0° | de zaal in | -27.970 | -27.970 | 0.0 cm | PASS |

Resultaat: alle wandrekken PASS na de correctie.

Overige wandobjecten in de zaalmodellen (ramen/schermen zijn onderdeel van `Muur_*`; geen aparte nodes): `Basketbal_Installatie_Links/Rechts` — mesh x −2,47…0,63 m vanaf de wand de zaal in, rechts 180° gedraaid: **goed**. `Turnbank_1/2` (bankjes tegen de wand) zijn symmetrisch: **goed**. Spiegels, scorebord, klok, wandkasten, ballenvanger, lichtbakken en deuren bestaan niet als node: ONBEKEND/n.v.t.
