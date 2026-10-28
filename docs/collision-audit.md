# Collision-audit 3D-assets

Gegenereerd door `npm run audit:collision -- --write` (scripts/audit-collision.mts). Niet met de hand bewerken.

Tolerantie: afwijking > 2 cm of > 5% volume = FAIL. Bron database-maten: lokale importer-berekening.

## Samenvatting

| | Voor (oude box uit de database) | Na (vorm uit geometrie + overrides) |
|---|---|---|
| PASS | 100 | 205 |
| FAIL | 105 | 0 |
| Totaal | 205 | 205 |

### Oorzaken (voor), aantal assets

- pivot niet gecentreerd: 59
- pivot licht verschoven : mesh steekt buiten de gecentreerde box: 28
- onderkant onder de vloer: 14
- model schuin gemodelleerd: 12
- hangend/verhoogd: 11
- niet-uniforme schaal in het GLB: 2
- database-maat kleiner dan de mesh: 1

Assets met overrides: `dikke_mat_300x200x30`.

Schaaltest (uniform 2× en 1,5/1/0,7): afwijkend: leerling_wandelen.

Rotatietest (0°, 30°, 45°, 90°): de oriented box omvat de mesh bij alle rotaties voor 205 van 205 assets.

Een world-AABB (oude aanpak) is bij 45° rotatie gemiddeld 16.50× zo groot als de oriented box; 203 assets > 10% groter.

## Assets die een Blender-aanpassing nodig hebben

De editor corrigeert deze assets nu automatisch (offset, onderkant, draaiing komen uit de geometrie), dus er is niets kapot. Wie het model zelf wil opschonen, kan dit in Blender doen; regels staan in `docs/blender-naming.md`.

- **Rotatie toepassen (Ctrl+A → Rotation)** — model is schuin gemodelleerd (yaw ≥ 0,5°): `ballenpomp_en_drukmeter_set`, `dopjes_kleurenset_4stuks`, `dumbbell_hex_los`, `floorballstick_unihockey`, `honkbal_softbal_honkenset_compleet`, `honkbal_veldhonk_kussen`, `leerling_staand_rust`, `pion_opbergstapel`, `pion_oranje_wit_gestreept`, `reactiebal_noppen`, `start_finish_vlag_en_klepper`, `yogamat_opgerold_set`
- **Schaal toepassen (Ctrl+A → Scale)** — niet-uniforme schaal op een node: `honkbal_zaalhonken_rubber_set`, `minitrampoline`
- **Origin naar onderkant-midden (Object → Set Origin) — pivot meer dan 5 cm van het midden** : `ab_roller_en_pushup_steunen`, `basketbal_muur_vast`, `basketbal_muur_wegdraaibaar`, `basketbaltoren_mobiel_jeugd`, `basketbaltoren_mobiel_senior`, `dopjes_kleurenset_4stuks`, `floorballstick_unihockey`, `fluitje_met_koord_en_kaarten`, `grensrechter_vlaggen_paar`, `honkbal_softbal_honkenset_compleet`, `klimnet_schuin_gymzaalframe`, `korfbalmand_kunststof_geel_los`, `korfbalpaal_compleet_250`, `korfbalpaal_compleet_350`, `leerling_zittend_turnbank`, `mattenkar_compleet`, `rekstok_wand_uitklapbaar`, `springtouw_speedrope`, `start_finish_vlag_en_klepper`, `stopwatch_digitaal`, `turnkast_140x83x114`, `turnkast_5_delig`, `turnkast_6_delig_1_recht`, `turnkast_7_delig_2_recht`, `veldhockeydoel_180x120_jeugd`, `veldhockeydoel_366x214_verplaatsbaar`, `veldhockeystick`, `veldvoetbaldoel_500x200_verplaatsbaar`, `veldvoetbaldoel_732x244_verplaatsbaar`, `volleybal_veldopstelling_bodemnet_grond_100cm`, `volleybal_veldopstelling_compleet_dames`, `volleybal_veldopstelling_compleet_heren`, `volleybal_veldopstelling_middelhoog_180cm`, `volleybalpalen_mobiel_set`, `volleybalpalen_vloerbus_set`, `wandrek_uitklapbaar_zwenk`, `zaalhockeybalk_los_2m`, `zaalhockeybalk_los_4m`, `zaalhockeybalken_gekoppeld_rij`, `zaalhockeydoel_300x200_wit`, `zaaltimer_intervalklok_digitaal`, `zaalvoetbal_handbaldoel_3x2`
- **Controleren of dit zo bedoeld is — onderkant meer dan 2 cm boven de vloer (hangend/wandmodel)**: `badmintonnet_hoog_180cm_los`, `badmintonnet_los_610`, `basketbal_muur_vast`, `basketbal_muur_wegdraaibaar`, `klimtouwen_set_2_hangend`, `klimtouwen_set_4_hangend`, `touwladder_hangend_5m`, `veldhockeystick`, `volleybalnet_compleet_antennes_los`, `volleybalnet_middelhoog_180cm_los`, `zwaairingen_gymzaal_laag`
- **Controleren — onderkant meer dan 2 cm onder de vloer**: `battle_rope_met_anker`, `bosu_balanstrainer_en_foamroller`, `grote_trampoline_vrijstaand_uitgeklapt`, `honkbal_softbal_honkenset_compleet`, `honkbal_veldhonk_kussen`, `honkbal_werpersplaat_pitchers_plate`, `megafoon_en_luchthoorn`, `padelracket_carbon`, `plankoline_modern_staalframe`, `softbal_veiligheidshonk_dubbelhonk`, `springbok_laag_jeugd_80cm`, `springbok_standaard_105cm`, `springpaard_klassiek_160`, `start_finish_vlag_en_klepper`
- Skinned of instanced meshes: geen
- Lege nodes zonder mesh (helpers): geen

## Assets die VOOR de fix FAIL waren

| Asset | Voor | Na | Oorzaak | Fix |
|---|---|---|---|---|
| `ab_roller_en_pushup_steunen` | FAIL (middelpunt 6.4 cm verschoven, mesh steekt buiten de vorm (18 punten)) | PASS | pivot niet gecentreerd (3/-6 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `airblock_200x140_20cm` | FAIL (mesh steekt buiten de vorm (17 punten)) | PASS | pivot licht verschoven (-1.0/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `airtrack_p2_12m` | FAIL (mesh steekt buiten de vorm (17 punten)) | PASS | pivot licht verschoven (-1.0/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `airtrack_p2_6m` | FAIL (mesh steekt buiten de vorm (17 punten)) | PASS | pivot licht verschoven (-1.0/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `badmintonnet_hoog_180cm_los` | FAIL (onderkant -104.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 1.04 m) | base_m uit geometrie (automatisch) |
| `badmintonnet_los_610` | FAIL (onderkant -79.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 0.79 m) | base_m uit geometrie (automatisch) |
| `badmintonpalen_vloerbus_set` | FAIL (middelpunt 2.4 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (-2/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `ballenkar_metaal_open_gevuld` | FAIL (middelpunt 3.9 cm verschoven, mesh steekt buiten de vorm (4 punten)) | PASS | pivot niet gecentreerd (4/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `ballenpomp_en_drukmeter_set` | FAIL (breedte +2.8 cm, volume +14%, mesh steekt buiten de vorm (12 punten)) | PASS | pivot licht verschoven (-1.5/-0.9 cm): mesh steekt buiten de gecentreerde box; model schuin gemodelleerd (8.5°) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw 8.5°); Blender: rotatie toepassen (Ctrl+A) |
| `basketbal_muur_vast` | FAIL (middelpunt 32.1 cm verschoven, onderkant -263.0 cm te laag/hoog, mesh steekt buiten de vorm (8 punten)) | PASS | hangend/verhoogd (onderkant 2.63 m); pivot niet gecentreerd (0/-32 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `basketbal_muur_wegdraaibaar` | FAIL (middelpunt 35.0 cm verschoven, onderkant -260.0 cm te laag/hoog, mesh steekt buiten de vorm (7 punten)) | PASS | hangend/verhoogd (onderkant 2.60 m); pivot niet gecentreerd (0/-35 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `basketbaltoren_mobiel_jeugd` | FAIL (middelpunt 114.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (0/-114 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `basketbaltoren_mobiel_senior` | FAIL (middelpunt 114.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (0/-114 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `batting_tee_slagbalstatief` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (2.0/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `battle_rope_met_anker` | FAIL (middelpunt 3.8 cm verschoven, onderkant 2.5 cm te laag/hoog, mesh steekt buiten de vorm (9 punten)) | PASS | onderkant onder de vloer (-0.03 m); pivot niet gecentreerd (0/-4 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `bosu_balanstrainer_en_foamroller` | FAIL (middelpunt 4.9 cm verschoven, onderkant 4.0 cm te laag/hoog, mesh steekt buiten de vorm (9 punten)) | PASS | onderkant onder de vloer (-0.04 m); pivot niet gecentreerd (-5/0 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `cricketbat` | FAIL (middelpunt 2.1 cm verschoven, mesh steekt buiten de vorm (1 punten)) | PASS | pivot niet gecentreerd (0/-2 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `dikke_mat_300x200x30` | FAIL (lengte -6.0 cm, breedte -6.0 cm, volume -6%, mesh steekt buiten de vorm (36 punten)) | PASS (override) | pivot licht verschoven (0.0/0.0 cm): mesh steekt buiten de gecentreerde box; database-maat kleiner dan de mesh (-6 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; override met reden of GLB/maat corrigeren |
| `dopjes_kleurenset_4stuks` | FAIL (middelpunt 8.0 cm verschoven, lengte +6.9 cm, breedte +4.4 cm, volume +24%, mesh steekt buiten de vorm (9 punten)) | PASS | pivot niet gecentreerd (0/-8 cm); model schuin gemodelleerd (32.5°) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw 32.5°); Blender: rotatie toepassen (Ctrl+A) |
| `dumbbell_hex_los` | FAIL (breedte +9.5 cm, volume +88%) | PASS | model schuin gemodelleerd (25.0°) | oriented box (yaw 25.0°); Blender: rotatie toepassen (Ctrl+A) |
| `dumbbell_neopreen_set` | FAIL (mesh steekt buiten de vorm (2 punten)) | PASS | pivot licht verschoven (1.0/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `ehbo_sportkoffer_en_bidonrek` | FAIL (mesh steekt buiten de vorm (6 punten)) | PASS | pivot licht verschoven (-1.5/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `fitness_elastiek_set` | FAIL (middelpunt 2.2 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (2/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `fitnessbank_verstelbaar_incline` | FAIL (mesh steekt buiten de vorm (6 punten)) | PASS | pivot licht verschoven (0.0/-2.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `floorballstick_unihockey` | FAIL (middelpunt 11.7 cm verschoven, volume +13%, mesh steekt buiten de vorm (4 punten)) | PASS | pivot niet gecentreerd (-12/1 cm); model schuin gemodelleerd (2.4°) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw 2.4°); Blender: rotatie toepassen (Ctrl+A) |
| `fluitje_met_koord_en_kaarten` | FAIL (middelpunt 5.2 cm verschoven, mesh steekt buiten de vorm (24 punten)) | PASS | pivot niet gecentreerd (1/-5 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `grensrechter_vlaggen_paar` | FAIL (middelpunt 15.8 cm verschoven, mesh steekt buiten de vorm (7 punten)) | PASS | pivot niet gecentreerd (16/-3 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `grote_trampoline_vrijstaand_uitgeklapt` | FAIL (onderkant 34.7 cm te laag/hoog) | PASS | onderkant onder de vloer (-0.35 m) | base_m uit geometrie (automatisch) |
| `handfluit_knijpfluit_hygienisch` | FAIL (mesh steekt buiten de vorm (26 punten)) | PASS | pivot licht verschoven (-0.1/-1.2 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `hoekvlag_cornervlag_met_voet` | FAIL (middelpunt 4.2 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (4/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `honkbal_softbal_honkenset_compleet` | FAIL (middelpunt 31.1 cm verschoven, onderkant 5.5 cm te laag/hoog, lengte +60.0 cm, breedte +29.3 cm, volume +33%) | PASS | onderkant onder de vloer (-0.06 m); pivot niet gecentreerd (14/28 cm); model schuin gemodelleerd (-22.5°) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw -22.5°); Blender: rotatie toepassen (Ctrl+A) |
| `honkbal_veldhonk_kussen` | FAIL (onderkant 5.5 cm te laag/hoog, lengte +15.3 cm, breedte +15.3 cm, volume +97%) | PASS | onderkant onder de vloer (-0.06 m); model schuin gemodelleerd (-45.0°) | base_m uit geometrie (automatisch); oriented box (yaw -45.0°); Blender: rotatie toepassen (Ctrl+A) |
| `honkbal_werpersplaat_pitchers_plate` | FAIL (onderkant 4.5 cm te laag/hoog) | PASS | onderkant onder de vloer (-0.04 m) | base_m uit geometrie (automatisch) |
| `honkbal_zaalhonken_rubber_set` | FAIL (mesh steekt buiten de vorm (8 punten)) | PASS | pivot licht verschoven (-0.1/-1.8 cm): mesh steekt buiten de gecentreerde box; niet-uniforme schaal in het GLB | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; Blender: Apply Scale (Ctrl+A) |
| `klembord_en_kijkwijzer_kaarten_set` | FAIL (mesh steekt buiten de vorm (5 punten)) | PASS | pivot licht verschoven (-0.8/1.8 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `klimnet_schuin_gymzaalframe` | FAIL (middelpunt 45.0 cm verschoven, mesh steekt buiten de vorm (18 punten)) | PASS | pivot niet gecentreerd (0/-45 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `klimtouwen_set_2_hangend` | FAIL (onderkant -35.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 0.35 m) | base_m uit geometrie (automatisch) |
| `klimtouwen_set_4_hangend` | FAIL (onderkant -35.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 0.35 m) | base_m uit geometrie (automatisch) |
| `korfbalmand_kunststof_geel_los` | FAIL (middelpunt 13.1 cm verschoven, mesh steekt buiten de vorm (35 punten)) | PASS | pivot niet gecentreerd (13/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `korfbalpaal_compleet_250` | FAIL (middelpunt 5.3 cm verschoven, mesh steekt buiten de vorm (21 punten)) | PASS | pivot niet gecentreerd (5/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `korfbalpaal_compleet_350` | FAIL (middelpunt 5.3 cm verschoven, mesh steekt buiten de vorm (21 punten)) | PASS | pivot niet gecentreerd (5/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `lacrossestick_crosse` | FAIL (mesh steekt buiten de vorm (1 punten)) | PASS | pivot licht verschoven (0.0/-1.8 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_blauw` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/1.9 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_geel` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/1.9 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_groen` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/1.9 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_oranje` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/1.9 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_paars` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/1.9 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_rood` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/1.9 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_staand_rust` | FAIL (middelpunt 3.9 cm verschoven, breedte +3.6 cm, volume +14%, mesh steekt buiten de vorm (4 punten)) | PASS | pivot niet gecentreerd (-0/4 cm); model schuin gemodelleerd (-7.1°) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw -7.1°); Blender: rotatie toepassen (Ctrl+A) |
| `leerling_wandelen` | FAIL (mesh steekt buiten de vorm (1 punten)) | PASS | pivot licht verschoven (0.4/0.5 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `leerling_zittend_turnbank` | FAIL (middelpunt 10.7 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (0/11 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `mattenkar_compleet` | FAIL (middelpunt 17.8 cm verschoven, mesh steekt buiten de vorm (28 punten)) | PASS | pivot niet gecentreerd (-10/15 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `medicijnbal_slambal_wallball_set` | FAIL (middelpunt 4.7 cm verschoven, mesh steekt buiten de vorm (12 punten)) | PASS | pivot niet gecentreerd (4/-2 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `megafoon_en_luchthoorn` | FAIL (middelpunt 4.7 cm verschoven, onderkant 2.7 cm te laag/hoog, mesh steekt buiten de vorm (20 punten)) | PASS | onderkant onder de vloer (-0.03 m); pivot niet gecentreerd (-4/2 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `minitrampoline` | FAIL (middelpunt 3.4 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (0/-3 cm); niet-uniforme schaal in het GLB | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; Blender: Apply Scale (Ctrl+A) |
| `opbergkratjes_en_ballennet_set` | FAIL (mesh steekt buiten de vorm (3 punten)) | PASS | pivot licht verschoven (1.0/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `padelracket_carbon` | FAIL (onderkant 10.7 cm te laag/hoog) | PASS | onderkant onder de vloer (-0.11 m) | base_m uit geometrie (automatisch) |
| `partijhesjes_teamlintjes_set` | FAIL (mesh steekt buiten de vorm (4 punten)) | PASS | pivot licht verschoven (0.0/-0.7 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `pion_opbergstapel` | FAIL (lengte +2.6 cm, breedte +2.6 cm, volume +22%) | PASS | model schuin gemodelleerd (14.0°) | oriented box (yaw 14.0°); Blender: rotatie toepassen (Ctrl+A) |
| `pion_oranje_wit_gestreept` | FAIL (lengte +5.6 cm, breedte +5.6 cm, volume +53%) | PASS | model schuin gemodelleerd (18.0°) | oriented box (yaw 18.0°); Blender: rotatie toepassen (Ctrl+A) |
| `plankoline_modern_staalframe` | FAIL (onderkant 4.7 cm te laag/hoog, mesh steekt buiten de vorm (18 punten)) | PASS | onderkant onder de vloer (-0.05 m); pivot licht verschoven (1.4/0.0 cm): mesh steekt buiten de gecentreerde box | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `powerbag_sandbag` | FAIL (mesh steekt buiten de vorm (2 punten)) | PASS | pivot licht verschoven (0.0/1.4 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `reactiebal_noppen` | FAIL (volume +49%) | PASS | model schuin gemodelleerd (-45.0°) | oriented box (yaw -45.0°); Blender: rotatie toepassen (Ctrl+A) |
| `rekstok_wand_uitklapbaar` | FAIL (middelpunt 18.7 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (0/-19 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `softbal_veiligheidshonk_dubbelhonk` | FAIL (onderkant 5.5 cm te laag/hoog) | PASS | onderkant onder de vloer (-0.06 m) | base_m uit geometrie (automatisch) |
| `spanbrug_ongelijke_leggers_school_training` | FAIL (mesh steekt buiten de vorm (10 punten)) | PASS | pivot licht verschoven (0.0/1.3 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `springbok_laag_jeugd_80cm` | FAIL (middelpunt 2.3 cm verschoven, onderkant 4.0 cm te laag/hoog, mesh steekt buiten de vorm (2 punten)) | PASS | onderkant onder de vloer (-0.04 m); pivot niet gecentreerd (2/0 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `springbok_standaard_105cm` | FAIL (middelpunt 2.3 cm verschoven, onderkant 4.0 cm te laag/hoog, mesh steekt buiten de vorm (2 punten)) | PASS | onderkant onder de vloer (-0.04 m); pivot niet gecentreerd (2/0 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `springpaard_klassiek_160` | FAIL (onderkant 3.0 cm te laag/hoog) | PASS | onderkant onder de vloer (-0.03 m) | base_m uit geometrie (automatisch) |
| `springplank_senior_4veers` | FAIL (mesh steekt buiten de vorm (2 punten)) | PASS | pivot licht verschoven (-0.7/0.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `springtouw_speedrope` | FAIL (middelpunt 5.0 cm verschoven, mesh steekt buiten de vorm (30 punten)) | PASS | pivot niet gecentreerd (-2/5 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `squatrek_half_rack` | FAIL (mesh steekt buiten de vorm (2 punten)) | PASS | pivot licht verschoven (0.0/-0.5 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `start_finish_vlag_en_klepper` | FAIL (middelpunt 7.3 cm verschoven, onderkant 4.0 cm te laag/hoog, lengte +5.8 cm, breedte +3.3 cm, volume +17%, mesh steekt buiten de vorm (3 punten)) | PASS | onderkant onder de vloer (-0.04 m); pivot niet gecentreerd (5/-5 cm); model schuin gemodelleerd (11.2°) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw 11.2°); Blender: rotatie toepassen (Ctrl+A) |
| `stopwatch_digitaal` | FAIL (middelpunt 6.3 cm verschoven, mesh steekt buiten de vorm (38 punten)) | PASS | pivot niet gecentreerd (0/-6 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `tactiekbord_coachbord_veld` | FAIL (middelpunt 3.3 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (0/-3 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `touwladder_hangend_5m` | FAIL (onderkant -40.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 0.40 m) | base_m uit geometrie (automatisch) |
| `turnkast_140x83x114` | FAIL (middelpunt 5.7 cm verschoven, mesh steekt buiten de vorm (17 punten)) | PASS | pivot niet gecentreerd (6/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `turnkast_5_delig` | FAIL (middelpunt 5.7 cm verschoven, mesh steekt buiten de vorm (17 punten)) | PASS | pivot niet gecentreerd (6/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `turnkast_6_delig_1_recht` | FAIL (middelpunt 5.7 cm verschoven, mesh steekt buiten de vorm (17 punten)) | PASS | pivot niet gecentreerd (6/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `turnkast_7_delig_2_recht` | FAIL (middelpunt 5.7 cm verschoven, mesh steekt buiten de vorm (17 punten)) | PASS | pivot niet gecentreerd (6/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `veldhockeydoel_180x120_jeugd` | FAIL (middelpunt 41.2 cm verschoven, mesh steekt buiten de vorm (4 punten)) | PASS | pivot niet gecentreerd (0/-41 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `veldhockeydoel_366x214_verplaatsbaar` | FAIL (middelpunt 62.2 cm verschoven, mesh steekt buiten de vorm (32 punten)) | PASS | pivot niet gecentreerd (0/-62 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `veldhockeystick` | FAIL (middelpunt 5.3 cm verschoven, onderkant -2.6 cm te laag/hoog, mesh steekt buiten de vorm (12 punten)) | PASS | hangend/verhoogd (onderkant 0.03 m); pivot niet gecentreerd (-5/1 cm) | base_m uit geometrie (automatisch); offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `veldvoetbaldoel_500x200_verplaatsbaar` | FAIL (middelpunt 73.7 cm verschoven, mesh steekt buiten de vorm (40 punten)) | PASS | pivot niet gecentreerd (0/-74 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `veldvoetbaldoel_732x244_verplaatsbaar` | FAIL (middelpunt 98.7 cm verschoven, mesh steekt buiten de vorm (40 punten)) | PASS | pivot niet gecentreerd (0/-99 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `vloermarkering_rubber_set` | FAIL (mesh steekt buiten de vorm (8 punten)) | PASS | pivot licht verschoven (0.0/-2.0 cm): mesh steekt buiten de gecentreerde box | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `volleybal_veldopstelling_bodemnet_grond_100cm` | FAIL (middelpunt 9.0 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (-9/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `volleybal_veldopstelling_compleet_dames` | FAIL (middelpunt 9.0 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (-9/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `volleybal_veldopstelling_compleet_heren` | FAIL (middelpunt 9.0 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (-9/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `volleybal_veldopstelling_middelhoog_180cm` | FAIL (middelpunt 9.0 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (-9/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `volleybalnet_compleet_antennes_los` | FAIL (onderkant -143.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 1.43 m) | base_m uit geometrie (automatisch) |
| `volleybalnet_middelhoog_180cm_los` | FAIL (onderkant -80.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 0.80 m) | base_m uit geometrie (automatisch) |
| `volleybalpalen_mobiel_set` | FAIL (middelpunt 25.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (0/-25 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `volleybalpalen_vloerbus_set` | FAIL (middelpunt 9.0 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (-9/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `wandrek_dubbel_veld` | FAIL (middelpunt 2.2 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (0/2 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `wandrek_enkel_veld` | FAIL (middelpunt 2.2 cm verschoven, mesh steekt buiten de vorm (2 punten)) | PASS | pivot niet gecentreerd (0/2 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `wandrek_uitklapbaar_zwenk` | FAIL (middelpunt 56.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (-2/56 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `yogamat_opgerold_set` | FAIL (middelpunt 4.7 cm verschoven, breedte +15.1 cm, volume +77%, mesh steekt buiten de vorm (15 punten)) | PASS | pivot niet gecentreerd (-4/-2 cm); model schuin gemodelleerd (15.3°) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden; oriented box (yaw 15.3°); Blender: rotatie toepassen (Ctrl+A) |
| `zaalhockeybalk_los_2m` | FAIL (middelpunt 103.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (103/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `zaalhockeybalk_los_4m` | FAIL (middelpunt 203.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (203/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `zaalhockeybalken_gekoppeld_rij` | FAIL (middelpunt 600.0 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (600/0 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `zaalhockeydoel_300x200_wit` | FAIL (middelpunt 49.2 cm verschoven, mesh steekt buiten de vorm (6 punten)) | PASS | pivot niet gecentreerd (0/-49 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `zaaltimer_intervalklok_digitaal` | FAIL (middelpunt 6.9 cm verschoven, mesh steekt buiten de vorm (3 punten)) | PASS | pivot niet gecentreerd (0/7 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `zaalvoetbal_handbaldoel_3x2` | FAIL (middelpunt 48.9 cm verschoven, mesh steekt buiten de vorm (20 punten)) | PASS | pivot niet gecentreerd (0/-49 cm) | offset uit geometrie (automatisch); Blender: origin naar onderkant-midden |
| `zwaairingen_gymzaal_laag` | FAIL (onderkant -190.0 cm te laag/hoog) | PASS | hangend/verhoogd (onderkant 1.90 m) | base_m uit geometrie (automatisch) |

## Alle assets

| Asset | Voor | Na | Maten na (l×b×h cm) | Offset x,z (cm) | Onderkant (cm) | Yaw |
|---|---|---|---|---|---|---|
| `ab_roller_en_pushup_steunen` | FAIL | PASS | 76.0×41.7×18.4 | 3.0, -5.7 | 0.0 | 0.0° |
| `aerobic_step` | PASS | PASS | 98.0×38.0×20.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `airblock_200x140_20cm` | FAIL | PASS | 202.6×145.4×20.2 | -1.0, 0.0 | 0.0 | 0.0° |
| `airtrack_p2_12m` | FAIL | PASS | 1202.6×205.4×20.3 | -1.0, 0.0 | 0.0 | 0.0° |
| `airtrack_p2_6m` | FAIL | PASS | 602.6×205.4×20.2 | -1.0, 0.0 | 0.0 | 0.0° |
| `american_football` | PASS | PASS | 28.6×17.2×17.7 | 0.0, 0.0 | 0.0 | 0.0° |
| `badminton_veldopstelling_bodemnet_grond_76cm` | PASS | PASS | 724.9×48.0×156.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `badminton_veldopstelling_compleet_mobiel` | PASS | PASS | 724.9×48.0×161.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `badminton_veldopstelling_compleet_vloerbus` | PASS | PASS | 660.0×6.4×156.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `badminton_veldopstelling_hoog_180cm` | PASS | PASS | 724.9×48.0×186.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `badmintonnet_bodemnet_grond_76cm_los` | PASS | PASS | 660.0×0.8×76.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `badmintonnet_hoog_180cm_los` | FAIL | PASS | 660.0×0.8×76.0 | 0.0, 0.0 | 104.0 | 0.0° |
| `badmintonnet_los_610` | FAIL | PASS | 660.0×0.8×76.0 | 0.0, 0.0 | 79.0 | 0.0° |
| `badmintonpalen_mobiel_set` | PASS | PASS | 234.9×48.0×161.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `badmintonpalen_vloerbus_set` | FAIL | PASS | 133.3×6.4×156.5 | -2.4, 0.0 | 0.0 | 0.0° |
| `badmintonracket_senior` | PASS | PASS | 20.6×3.0×67.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `ballenkar_metaal_open_gevuld` | FAIL | PASS | 102.8×69.0×130.6 | 3.9, 0.0 | 0.0 | 0.0° |
| `ballenpomp_en_drukmeter_set` | FAIL | PASS | 50.6×18.3×64.6 | -1.5, -0.9 | 0.0 | 8.5° |
| `ballenrek_breed_3laags` | PASS | PASS | 115.2×48.0×109.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `barbell_compleet_geladen` | PASS | PASS | 220.0×45.0×45.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `barbell_ez_curl_geladen` | PASS | PASS | 120.0×33.0×33.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `basketbal_maat_5` | PASS | PASS | 22.0×22.0×22.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `basketbal_maat_7` | PASS | PASS | 23.9×23.9×23.9 | 0.0, 0.0 | 0.0 | 0.0° |
| `basketbal_muur_vast` | FAIL | PASS | 186.5×188.1×119.5 | 0.0, -32.1 | 263.0 | 0.0° |
| `basketbal_muur_wegdraaibaar` | FAIL | PASS | 186.5×194.0×140.0 | 0.0, -35.0 | 260.0 | 0.0° |
| `basketbaltoren_mobiel_jeugd` | FAIL | PASS | 186.5×352.0×337.5 | 0.0, -114.0 | 0.0 | 0.0° |
| `basketbaltoren_mobiel_senior` | FAIL | PASS | 186.5×352.0×382.5 | 0.0, -114.0 | 0.0 | 0.0° |
| `batting_tee_slagbalstatief` | FAIL | PASS | 39.6×41.6×89.4 | 2.0, 0.0 | 0.0 | 0.0° |
| `battle_rope_met_anker` | FAIL | PASS | 57.2×179.5×12.0 | 0.0, -3.8 | -2.5 | 0.0° |
| `boccia_bal` | PASS | PASS | 8.4×8.4×8.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `bodypump_halterset` | PASS | PASS | 140.0×27.8×29.1 | 0.0, 0.0 | -1.0 | 0.0° |
| `bosu_balanstrainer_en_foamroller` | FAIL | PASS | 96.1×62.0×28.2 | -4.9, 0.0 | -4.0 | 0.0° |
| `brug_gelijke_leggers_school_laag` | PASS | PASS | 350.0×139.0×162.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `bumper_plates_set_opbergrek` | PASS | PASS | 64.0×61.5×127.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `cricketbat` | FAIL | PASS | 10.8×7.4×85.6 | 0.0, -2.1 | 0.0 | 0.0° |
| `dikke_mat_300x200x30` | FAIL | PASS | 300.0×200.0×30.0 | 0.0, 0.0 | -0.2 | 0.0° |
| `dodgeball_vinyl_blauw` | PASS | PASS | 17.8×17.8×17.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `dodgeball_vinyl_rood` | PASS | PASS | 17.8×17.8×17.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `dopje_blauw_los` | PASS | PASS | 19.2×19.2×5.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `dopjes_kleurenset_4stuks` | FAIL | PASS | 56.3×42.8×5.4 | 0.0, -8.0 | 0.0 | 32.5° |
| `dopjes_op_houder_set` | PASS | PASS | 19.2×19.2×36.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `dumbbell_hex_los` | FAIL | PASS | 28.1×11.8×13.6 | 0.0, 0.0 | -0.9 | 25.0° |
| `dumbbell_neopreen_set` | FAIL | PASS | 65.6×27.0×8.0 | 1.0, 0.0 | 0.0 | 0.0° |
| `dumbbellrek_compleet` | PASS | PASS | 136.0×58.8×76.2 | 0.0, 0.0 | -0.1 | 0.0° |
| `ehbo_sportkoffer_en_bidonrek` | FAIL | PASS | 69.0×19.0×30.3 | -1.5, 0.0 | 0.4 | 0.0° |
| `evenwichtsbalk_hoog_fig_125` | PASS | PASS | 503.0×120.0×125.2 | 0.0, 0.0 | 0.0 | 0.0° |
| `evenwichtsbalk_laag_vloermodel_30` | PASS | PASS | 503.0×50.0×30.2 | 0.0, 0.0 | 0.0 | 0.0° |
| `fitness_elastiek_set` | FAIL | PASS | 54.6×56.5×4.8 | 2.2, 0.0 | 0.0 | 0.0° |
| `fitness_schijf_los_20kg` | PASS | PASS | 45.0×45.0×5.2 | 0.0, 0.0 | -0.2 | 0.0° |
| `fitnessbank_verstelbaar_incline` | FAIL | PASS | 56.0×114.5×102.6 | 0.0, -2.0 | 0.0 | 0.0° |
| `fitnessmat_blauw_uitgerold` | PASS | PASS | 180.0×60.0×2.1 | 0.0, 0.0 | 0.0 | 0.0° |
| `fitnessmat_rek_gevuld` | PASS | PASS | 72.0×62.0×192.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `floorball_puck` | PASS | PASS | 7.6×7.6×2.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `floorball_ring_blauw` | PASS | PASS | 16.8×16.8×1.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `floorball_ring_geel` | PASS | PASS | 16.8×16.8×1.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `floorballbal_geperforeerd` | PASS | PASS | 7.2×7.2×7.2 | 0.0, 0.0 | 0.0 | 0.0° |
| `floorballstick_unihockey` | FAIL | PASS | 26.5×3.0×104.0 | -11.7, 0.5 | 0.6 | 2.4° |
| `fluitje_met_koord_en_kaarten` | FAIL | PASS | 34.8×25.3×4.4 | 1.4, -5.0 | 0.0 | 0.0° |
| `foambal_groot_20cm` | PASS | PASS | 20.0×20.0×20.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `foambal_klein_7cm` | PASS | PASS | 7.0×7.0×7.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `foambal_middel_16cm` | PASS | PASS | 16.0×16.0×16.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `foambal_olifantenhuid_geel` | PASS | PASS | 16.0×16.0×16.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `foambal_olifantenhuid_rood` | PASS | PASS | 18.0×18.0×18.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `foamturnkast_4delig` | PASS | PASS | 139.6×94.1×120.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `foamturnkast_topdeel_los` | PASS | PASS | 139.6×59.1×34.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `grensrechter_vlaggen_paar` | FAIL | PASS | 90.4×57.8×3.1 | 15.6, -2.8 | 0.4 | 0.0° |
| `groot_klimnet_stalen_frame_4x3m` | PASS | PASS | 412.0×12.0×337.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `grote_trampoline_ingeklapt_rolstandaard` | PASS | PASS | 120.0×312.0×243.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `grote_trampoline_verzonken_vloermodel` | PASS | PASS | 540.0×325.0×3.7 | 0.0, 0.0 | 0.0 | 0.0° |
| `grote_trampoline_vrijstaand_uitgeklapt` | FAIL | PASS | 528.0×351.0×172.9 | 0.0, 0.0 | -34.7 | 0.0° |
| `handbal_maat_2` | PASS | PASS | 17.6×17.6×17.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `handfluit_knijpfluit_hygienisch` | FAIL | PASS | 24.2×15.2×7.2 | -0.1, -1.2 | 0.0 | 0.0° |
| `hoekvlag_cornervlag_met_voet` | FAIL | PASS | 74.4×27.6×151.7 | 4.2, 0.0 | 0.0 | 0.0° |
| `hoepel_en_springtouw_opbergrek` | PASS | PASS | 78.0×66.2×133.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `honkbal_harde_kern` | PASS | PASS | 7.3×7.3×7.3 | 0.0, 0.0 | 0.0 | 0.0° |
| `honkbal_softbal_honkenset_compleet` | FAIL | PASS | 283.6×295.7×13.6 | 14.0, 27.8 | -5.5 | -22.5° |
| `honkbal_thuishonk_home_plate` | PASS | PASS | 43.2×43.1×2.1 | 0.0, 0.1 | 0.0 | 0.0° |
| `honkbal_veldhonk_kussen` | FAIL | PASS | 38.0×38.0×13.6 | 0.0, 0.0 | -5.5 | -45.0° |
| `honkbal_werpersplaat_pitchers_plate` | FAIL | PASS | 61.0×15.2×6.3 | 0.0, 0.0 | -4.5 | 0.0° |
| `honkbal_zaalhonken_rubber_set` | FAIL | PASS | 128.6×86.4×2.5 | -0.1, -1.8 | -1.6 | 0.0° |
| `honkbalknuppel_aluminium` | PASS | PASS | 6.6×6.6×83.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `honkbalknuppel_hout` | PASS | PASS | 6.6×6.6×83.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `honkbalknuppel_veiligheidsschuim` | PASS | PASS | 7.5×7.5×68.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `kettlebell_rood_16kg` | PASS | PASS | 21.9×21.2×28.9 | 0.0, 0.1 | 0.0 | 0.0° |
| `kin_ball_reuzenbal` | PASS | PASS | 122.0×122.0×122.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `klembord_en_kijkwijzer_kaarten_set` | FAIL | PASS | 60.7×40.0×24.1 | -0.8, 1.8 | 0.0 | 0.0° |
| `klimnet_schuin_gymzaalframe` | FAIL | PASS | 312.0×242.0×239.3 | 0.0, -45.0 | 0.0 | 0.0° |
| `klimtouwen_set_2_hangend` | FAIL | PASS | 110.0×8.0×502.5 | 0.0, 0.0 | 35.0 | 0.0° |
| `klimtouwen_set_4_hangend` | FAIL | PASS | 210.0×8.0×502.5 | 0.0, 0.0 | 35.0 | 0.0° |
| `korfbal_maat_5` | PASS | PASS | 22.0×22.0×22.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `korfbalmand_kunststof_geel_los` | FAIL | PASS | 55.0×44.3×27.5 | 13.1, 0.0 | 0.0 | 0.0° |
| `korfbalpaal_compleet_250` | FAIL | PASS | 90.6×80.0×250.0 | 5.3, 0.0 | 0.0 | 0.0° |
| `korfbalpaal_compleet_350` | FAIL | PASS | 90.6×80.0×350.0 | 5.3, 0.0 | 0.0 | 0.0° |
| `lacrossestick_crosse` | FAIL | PASS | 17.0×6.7×102.9 | 0.0, -1.8 | 0.0 | 0.0° |
| `lange_mat_oprolbaar_12m_uitgerold` | PASS | PASS | 1200.0×200.0×4.2 | 0.0, 0.0 | 0.0 | 0.0° |
| `lange_mat_oprolbaar_6m_uitgerold` | PASS | PASS | 600.0×200.0×4.3 | 0.0, 0.0 | 0.0 | 0.0° |
| `leerling_blauw` | FAIL | PASS | 60.5×31.8×154.4 | 0.0, 1.9 | 0.0 | 0.0° |
| `leerling_geel` | FAIL | PASS | 60.5×31.8×154.4 | 0.0, 1.9 | 0.0 | 0.0° |
| `leerling_groen` | FAIL | PASS | 60.5×31.8×154.4 | 0.0, 1.9 | 0.0 | 0.0° |
| `leerling_oranje` | FAIL | PASS | 60.5×31.8×154.4 | 0.0, 1.9 | 0.0 | 0.0° |
| `leerling_paars` | FAIL | PASS | 60.5×31.8×154.4 | 0.0, 1.9 | 0.0 | 0.0° |
| `leerling_rennen` | PASS | PASS | 47.2×114.5×141.9 | 0.0, 0.0 | 0.0 | 0.0° |
| `leerling_rood` | FAIL | PASS | 60.5×31.8×154.4 | 0.0, 1.9 | 0.0 | 0.0° |
| `leerling_staand_rust` | FAIL | PASS | 53.9×26.4×165.0 | -0.4, 3.9 | 0.0 | -7.1° |
| `leerling_wandelen` | FAIL | PASS | 56.0×87.4×164.1 | 0.4, 0.5 | 0.0 | 0.0° |
| `leerling_zittend_turnbank` | FAIL | PASS | 364.6×80.4×126.5 | 0.0, 10.7 | 0.0 | 0.0° |
| `materialenkar_gymzaal_multifunctioneel` | PASS | PASS | 111.1×62.2×113.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `mattenkar_compleet` | FAIL | PASS | 335.0×94.0×220.4 | -9.5, 15.0 | 0.0 | 0.0° |
| `medicijnbal_slambal_wallball_set` | FAIL | PASS | 102.3×37.9×35.3 | 4.4, -1.6 | -0.3 | 0.0° |
| `megafoon_en_luchthoorn` | FAIL | PASS | 47.8×33.2×22.6 | -4.1, 2.2 | -2.7 | 0.0° |
| `minitrampoline` | FAIL | PASS | 129.3×134.5×55.7 | 0.0, -3.4 | -0.1 | 0.0° |
| `opbergkratjes_en_ballennet_set` | FAIL | PASS | 92.0×46.0×50.2 | 1.0, 0.0 | 0.0 | 0.0° |
| `padelracket_carbon` | FAIL | PASS | 26.7×4.0×58.7 | 0.0, 0.0 | -10.7 | 0.0° |
| `partijhesjes_teamlintjes_set` | FAIL | PASS | 106.8×40.6×4.4 | 0.0, -0.7 | -0.1 | 0.0° |
| `petanque_boule_staal` | PASS | PASS | 7.3×7.3×7.3 | 0.0, 0.0 | 0.0 | 0.0° |
| `petanque_butje` | PASS | PASS | 3.0×3.0×3.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `pickleball_paddle` | PASS | PASS | 20.5×3.8×40.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `pion_effen_kleurenset` | PASS | PASS | 107.3×23.3×32.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `pion_gatenpion_set_met_stok` | PASS | PASS | 100.0×23.0×38.1 | 0.0, 0.0 | 0.0 | 0.0° |
| `pion_opbergstapel` | FAIL | PASS | 25.0×25.0×56.5 | 0.0, 0.0 | 0.0 | 14.0° |
| `pion_oranje_wit_gestreept` | FAIL | PASS | 23.5×23.5×38.1 | 0.0, 0.0 | 0.0 | 18.0° |
| `plankoline_modern_staalframe` | FAIL | PASS | 128.7×60.0×42.0 | 1.4, 0.0 | -4.7 | 0.0° |
| `plyobox_hout_3in1` | PASS | PASS | 76.2×51.2×60.2 | 0.0, 0.0 | -0.1 | 0.0° |
| `plyobox_soft_foam_set` | PASS | PASS | 191.4×75.4×90.2 | 0.0, 0.2 | 0.0 | 0.0° |
| `powerbag_sandbag` | FAIL | PASS | 58.0×26.5×26.7 | 0.0, 1.4 | -0.3 | 0.0° |
| `reactiebal_noppen` | FAIL | PASS | 7.7×7.7×9.4 | 0.0, 0.0 | -0.2 | -45.0° |
| `rekstok_laag_school` | PASS | PASS | 449.0×437.6×133.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `rekstok_wand_uitklapbaar` | FAIL | PASS | 369.0×406.5×262.5 | 0.0, -18.7 | 0.0 | 0.0° |
| `rugbybal` | PASS | PASS | 30.0×18.8×18.8 | 0.0, 0.0 | 0.0 | 0.0° |
| `scorebord_op_verrijdbaar_statief` | PASS | PASS | 54.0×49.2×151.3 | 0.0, 0.0 | 0.0 | 0.0° |
| `scorebord_tafelmodel` | PASS | PASS | 44.0×18.0×27.5 | 0.0, 0.0 | -0.1 | 0.0° |
| `shuttle_nylon` | PASS | PASS | 6.8×6.8×7.8 | 0.0, 0.0 | -0.1 | 0.0° |
| `skippybal` | PASS | PASS | 50.0×50.0×60.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `slagbal_massief_rubber` | PASS | PASS | 6.4×6.4×6.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `slagballatje_slagplankje` | PASS | PASS | 6.8×3.6×55.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `slalompalen_set_met_voet` | PASS | PASS | 119.0×33.0×156.5 | 0.0, 0.0 | 0.0 | 0.0° |
| `slow_motion_bal` | PASS | PASS | 35.0×35.0×35.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `softbal_12_inch` | PASS | PASS | 9.7×9.7×9.7 | 0.0, 0.0 | 0.0 | 0.0° |
| `softbal_veiligheidshonk_dubbelhonk` | FAIL | PASS | 80.2×38.0×13.6 | 0.0, 0.0 | -5.5 | 0.0° |
| `spanbrug_ongelijke_leggers_school_training` | FAIL | PASS | 429.0×391.7×232.0 | 0.0, 1.3 | 0.0 | 0.0° |
| `speedbadminton_crossminton_racket` | PASS | PASS | 22.8×3.5×59.1 | 0.0, 0.0 | 0.0 | 0.0° |
| `springbok_laag_jeugd_80cm` | FAIL | PASS | 72.7×60.3×84.0 | 2.3, 0.0 | -4.0 | 0.0° |
| `springbok_standaard_105cm` | FAIL | PASS | 88.7×74.1×109.0 | 2.3, 0.0 | -4.0 | 0.0° |
| `springpaard_klassiek_160` | FAIL | PASS | 160.8×84.0×128.0 | 0.0, 0.0 | -3.0 | 0.0° |
| `springplank_senior_4veers` | FAIL | PASS | 121.4×60.0×25.8 | -0.7, 0.0 | 0.0 | 0.0° |
| `springtouw_speedrope` | FAIL | PASS | 55.7×56.4×4.4 | -1.8, 4.7 | 0.0 | 0.0° |
| `squashbal_dubbel_geel` | PASS | PASS | 4.0×4.0×4.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `squashracket_teardrop` | PASS | PASS | 18.4×3.7×69.1 | 0.0, 0.0 | 0.0 | 0.0° |
| `squatrek_half_rack` | FAIL | PASS | 220.0×159.0×227.8 | 0.0, -0.5 | 0.0 | 0.0° |
| `start_finish_vlag_en_klepper` | FAIL | PASS | 57.5×56.0×13.8 | 5.0, -5.3 | -4.0 | 11.2° |
| `stopwatch_digitaal` | FAIL | PASS | 8.8×22.0×2.1 | 0.0, -6.3 | 0.0 | 0.0° |
| `strandbal_opblaasbaar` | PASS | PASS | 40.0×40.0×40.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `tactiekbord_coachbord_veld` | FAIL | PASS | 62.4×27.3×42.0 | 0.0, -3.3 | 0.0 | 0.0° |
| `tafeltennisbal_wit` | PASS | PASS | 4.0×4.1×4.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `tafeltennisbatje` | PASS | PASS | 15.3×2.4×26.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `tennisbal_standaard` | PASS | PASS | 6.7×6.7×6.7 | 0.0, 0.0 | 0.0 | 0.0° |
| `tennisracket_standaard` | PASS | PASS | 26.8×4.0×69.1 | 0.0, 0.0 | 0.0 | 0.0° |
| `touwladder_hangend_5m` | FAIL | PASS | 56.0×12.0×461.0 | 0.0, 0.0 | 40.0 | 0.0° |
| `trefbal_zacht_rubber` | PASS | PASS | 21.6×21.6×21.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `turnbank_1_los` | PASS | PASS | 364.6×27.0×32.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `turnbank_4_stapel` | PASS | PASS | 364.6×27.0×128.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `turnkast_140x83x114` | FAIL | PASS | 155.0×86.4×114.5 | 5.7, 0.0 | -0.5 | 0.0° |
| `turnkast_1_delig_kastkop` | PASS | PASS | 142.0×54.0×30.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `turnkast_2_delig` | PASS | PASS | 142.0×61.6×51.5 | 0.0, 0.0 | -0.5 | 0.0° |
| `turnkast_3_delig` | PASS | PASS | 142.0×69.9×72.5 | 0.0, 0.0 | -0.5 | 0.0° |
| `turnkast_4_delig` | PASS | PASS | 142.1×78.1×93.5 | 0.0, 0.0 | -0.5 | 0.0° |
| `turnkast_5_delig` | FAIL | PASS | 155.0×86.4×114.5 | 5.7, 0.0 | -0.5 | 0.0° |
| `turnkast_6_delig_1_recht` | FAIL | PASS | 155.0×86.4×135.5 | 5.7, 0.0 | -0.5 | 0.0° |
| `turnkast_7_delig_2_recht` | FAIL | PASS | 155.0×86.4×156.5 | 5.7, 0.0 | -0.5 | 0.0° |
| `turnmat_200x100x6` | PASS | PASS | 201.0×101.0×6.6 | 0.0, 0.0 | -0.1 | 0.0° |
| `veldhockeybal_glad` | PASS | PASS | 7.3×7.3×7.3 | 0.0, 0.0 | 0.0 | 0.0° |
| `veldhockeydoel_180x120_jeugd` | FAIL | PASS | 190.0×90.0×125.2 | 0.0, -41.2 | -0.2 | 0.0° |
| `veldhockeydoel_366x214_verplaatsbaar` | FAIL | PASS | 387.5×131.9×220.3 | 0.0, -62.2 | -1.3 | 0.0° |
| `veldhockeystick` | FAIL | PASS | 13.7×6.0×90.6 | -5.2, 1.1 | 2.6 | 0.0° |
| `veldvoetbaldoel_500x200_verplaatsbaar` | FAIL | PASS | 527.8×159.5×211.0 | 0.0, -73.7 | -1.0 | 0.0° |
| `veldvoetbaldoel_732x244_verplaatsbaar` | FAIL | PASS | 759.8×209.5×255.1 | 0.0, -98.7 | -1.0 | 0.0° |
| `vloermarkering_rubber_set` | FAIL | PASS | 92.0×52.0×0.4 | 0.0, -2.0 | 0.0 | 0.0° |
| `voetbal_veld_maat_5` | PASS | PASS | 22.0×22.0×22.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `volleybal_beach_softtouch` | PASS | PASS | 21.6×21.6×21.6 | 0.0, 0.0 | 0.0 | 0.0° |
| `volleybal_veldopstelling_bodemnet_grond_100cm` | FAIL | PASS | 1085.0×16.0×257.0 | -9.0, 0.0 | 0.0 | 0.0° |
| `volleybal_veldopstelling_compleet_dames` | FAIL | PASS | 1085.0×16.0×304.0 | -9.0, 0.0 | 0.0 | 0.0° |
| `volleybal_veldopstelling_compleet_heren` | FAIL | PASS | 1085.0×16.0×323.0 | -9.0, 0.0 | 0.0 | 0.0° |
| `volleybal_veldopstelling_middelhoog_180cm` | FAIL | PASS | 1085.0×16.0×260.0 | -9.0, 0.0 | 0.0 | 0.0° |
| `volleybal_zaal` | PASS | PASS | 21.0×21.0×21.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `volleybalnet_bodemnet_grond_100cm_los` | PASS | PASS | 1050.0×1.2×180.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `volleybalnet_compleet_antennes_los` | FAIL | PASS | 1050.0×1.2×180.0 | 0.0, 0.0 | 143.0 | 0.0° |
| `volleybalnet_middelhoog_180cm_los` | FAIL | PASS | 1050.0×1.2×180.0 | 0.0, 0.0 | 80.0 | 0.0° |
| `volleybalpalen_mobiel_set` | FAIL | PASS | 281.0×90.0×255.0 | 0.0, -25.0 | 0.0 | 0.0° |
| `volleybalpalen_vloerbus_set` | FAIL | PASS | 195.0×16.0×257.0 | -9.0, 0.0 | 0.0 | 0.0° |
| `wandrek_dubbel_veld` | FAIL | PASS | 209.0×26.5×260.0 | 0.0, 2.2 | 0.0 | 0.0° |
| `wandrek_enkel_veld` | FAIL | PASS | 104.0×26.5×260.0 | 0.0, 2.2 | 0.0 | 0.0° |
| `wandrek_uitklapbaar_zwenk` | FAIL | PASS | 14.7×129.0×260.0 | -2.0, 56.0 | 0.0 | 0.0° |
| `waterpolobal` | PASS | PASS | 22.0×22.0×22.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `whiteboard_verrijdbaar_dubbelzijdig` | PASS | PASS | 135.2×56.0×169.4 | 0.0, 0.0 | 0.0 | 0.0° |
| `yogamat_opgerold_set` | FAIL | PASS | 78.5×19.3×61.4 | -4.1, -2.2 | -0.3 | 15.3° |
| `zaalhockeybalk_los_2m` | FAIL | PASS | 206.0×10.0×10.5 | 103.0, 0.0 | 0.0 | 0.0° |
| `zaalhockeybalk_los_4m` | FAIL | PASS | 406.0×10.0×10.5 | 203.0, 0.0 | 0.0 | 0.0° |
| `zaalhockeybalken_gekoppeld_rij` | FAIL | PASS | 1200.0×10.0×10.5 | 600.0, 0.0 | 0.0 | 0.0° |
| `zaalhockeybalken_transportwagen` | PASS | PASS | 400.0×79.0×129.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `zaalhockeydoel_300x200_wit` | FAIL | PASS | 317.2×107.6×209.5 | 0.0, -49.2 | 0.0 | 0.0° |
| `zaaltimer_intervalklok_digitaal` | FAIL | PASS | 62.0×29.9×20.8 | 0.0, 6.9 | 0.0 | 0.0° |
| `zaalvoetbal_futsalbal_plofbal` | PASS | PASS | 20.0×20.0×20.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `zaalvoetbal_handbaldoel_3x2` | FAIL | PASS | 316.0×105.7×208.0 | 0.0, -48.9 | 0.0 | 0.0° |
| `zandlopers_tijdset` | PASS | PASS | 48.9×7.8×16.0 | 0.0, 0.0 | 0.0 | 0.0° |
| `zwaairingen_gymzaal_laag` | FAIL | PASS | 90.0×23.6×315.0 | 0.0, 0.0 | 190.0 | 0.0° |
