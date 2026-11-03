# Anchor-audit (bevestigingspunten van touwen, linten en netten)

Gegenereerd door `npm run audit:anchors -- --write`. Contactsheet met de anchors zichtbaar (oranje = anchor, blauwe lijn = verstelbaar bereik): [`anchor-contactsheet.png`](anchor-contactsheet.png).

**211 van 211 assets PASS** · klassen: paal 47, kegel/pion 6, net 6, GLB-node 0, bovenpunt (noodoplossing) 152.

Controles per anchor: op of in de echte geometrie (≤ 2 cm van het oppervlak), niet de rand/hoek van de bounding box, logische hoogte, blijft op zijn plek na draaien (30°, 45°, 90°) en verstelbaar bereik klopt.

## Assets met een Blender-anchor-node nodig

Deze assets zijn bedoeld om iets aan vast te maken, maar hebben geen herkenbare paal/kegel/net en vallen terug op het hoogste punt van de geometrie. Voeg in Blender een lege node toe met de naam `anchor_<touw|lint|net|haak>_<naam>` op de aanbevolen plek (zie `docs/blender-naming.md`).

| Asset | Aanbevolen node | Positie (m, vanaf pivot) | Richting |
|---|---|---|---|
| `grensrechter_vlaggen_paar` | `anchor_touw_top_1` | [-0.175, 0.034, 0.179] | omhoog (+Y) |
| `grensrechter_vlaggen_paar` | `anchor_touw_top_2` | [-0.157, 0.035, 0.251] | omhoog (+Y) |
| `grensrechter_vlaggen_paar` | `anchor_touw_top_3` | [0.166, 0.035, 0.253] | omhoog (+Y) |
| `grensrechter_vlaggen_paar` | `anchor_touw_top_4` | [0.182, 0.034, 0.181] | omhoog (+Y) |
| `groot_klimnet_stalen_frame_4x3m` | `anchor_touw_top_1` | [-0.25, 3.35, 0] | omhoog (+Y) |
| `groot_klimnet_stalen_frame_4x3m` | `anchor_touw_top_2` | [0, 3.376, -0.001] | omhoog (+Y) |
| `groot_klimnet_stalen_frame_4x3m` | `anchor_touw_top_3` | [0.25, 3.35, 0] | omhoog (+Y) |
| `groot_klimnet_stalen_frame_4x3m` | `anchor_touw_top_4` | [0.5, 3.35, 0] | omhoog (+Y) |
| `klimtouwen_set_2_hangend` | `anchor_touw_top_1` | [-0.3, 5.375, 0] | omhoog (+Y) |
| `klimtouwen_set_2_hangend` | `anchor_touw_top_2` | [0.3, 5.375, 0] | omhoog (+Y) |
| `klimtouwen_set_4_hangend` | `anchor_touw_top_1` | [-0.8, 5.375, 0] | omhoog (+Y) |
| `klimtouwen_set_4_hangend` | `anchor_touw_top_2` | [0.8, 5.375, 0] | omhoog (+Y) |
| `springtouw_speedrope` | `anchor_touw_top_1` | [-0.203, 0.044, 0.193] | omhoog (+Y) |
| `springtouw_speedrope` | `anchor_touw_top_2` | [0.162, 0.044, 0.194] | omhoog (+Y) |
| `start_finish_vlag_en_klepper` | `anchor_touw_top_1` | [0.25, 0.096, 0.02] | omhoog (+Y) |
| `start_finish_vlag_en_klepper` | `anchor_touw_top_2` | [0.31, 0.096, 0.02] | omhoog (+Y) |
| `wandrek_dubbel_veld` | `anchor_touw_top_1` | [-1.025, 2.6, 0.065] | omhoog (+Y) |
| `wandrek_dubbel_veld` | `anchor_touw_top_2` | [0, 2.6, 0.065] | omhoog (+Y) |
| `wandrek_dubbel_veld` | `anchor_touw_top_3` | [1.025, 2.6, 0.065] | omhoog (+Y) |
| `wandrek_enkel_veld` | `anchor_touw_top_1` | [-0.5, 2.6, 0.065] | omhoog (+Y) |
| `wandrek_enkel_veld` | `anchor_touw_top_2` | [0.5, 2.6, 0.065] | omhoog (+Y) |
| `wandrek_uitklapbaar_zwenk` | `anchor_touw_top_1` | [0, 2.6, 1.115] | omhoog (+Y) |
| `wandrek_uitklapbaar_zwenk` | `anchor_touw_top_2` | [0, 2.6, 0.065] | omhoog (+Y) |
| `zaalvoetbal_handbaldoel_3x2` | `anchor_touw_top` | [0, 2.08, 0] | omhoog (+Y) |
| `zwaairingen_gymzaal_laag` | `anchor_touw_top` | [0, 5.05, 0] | omhoog (+Y) |

## FAIL

_Geen._

## Alle assets

| Asset | Klasse | Anchors | Bron | Resultaat | Opmerking |
|---|---|---|---|---|---|
| `ab_roller_en_pushup_steunen` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `aerobic_step` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `airblock_200x140_20cm` | bovenpunt | top_1, top_2, top_3 | fallback | PASS |  |
| `airtrack_p2_12m` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `airtrack_p2_6m` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `american_football` | bovenpunt | top | fallback | PASS |  |
| `badminton_veldopstelling_bodemnet_grond_76cm` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `badminton_veldopstelling_compleet_mobiel` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Badminton_Bovenband_Wit" (1.41 m); paal 2: aanhechting onder "Badminton_Bovenband_Wit" (1.41 m) |
| `badminton_veldopstelling_compleet_vloerbus` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Badminton_Bovenband_Wit" (1.41 m); paal 2: aanhechting onder "Badminton_Bovenband_Wit" (1.41 m) |
| `badminton_veldopstelling_hoog_180cm` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Badminton_Bovenband_Wit" (1.66 m); paal 2: aanhechting onder "Badminton_Bovenband_Wit" (1.66 m) |
| `badmintonnet_bodemnet_grond_76cm_los` | net | net_links, net_rechts | afgeleid | PASS |  |
| `badmintonnet_hoog_180cm_los` | net | net_links, net_rechts | afgeleid | PASS |  |
| `badmintonnet_los_610` | net | net_links, net_rechts | afgeleid | PASS |  |
| `badmintonpalen_mobiel_set` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `badmintonpalen_vloerbus_set` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `badmintonracket_senior` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `ballenkar_metaal_open_gevuld` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `ballenpomp_en_drukmeter_set` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `ballenrek_breed_3laags` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `barbell_compleet_geladen` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `barbell_ez_curl_geladen` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `basketbal_maat_5` | bovenpunt | top | fallback | PASS |  |
| `basketbal_maat_7` | bovenpunt | top | fallback | PASS |  |
| `basketbal_muur_vast` | paal | ophang_1, ophang_2, ophang_3, ophang_4 | afgeleid | PASS |  |
| `basketbal_muur_wegdraaibaar` | paal | ophang_top | afgeleid | PASS |  |
| `basketbaltoren_mobiel_jeugd` | paal | ophang_1, ophang_2 | afgeleid | PASS |  |
| `basketbaltoren_mobiel_senior` | paal | ophang_1, ophang_2 | afgeleid | PASS |  |
| `batting_tee_slagbalstatief` | paal | paal_top↕ | afgeleid | PASS |  |
| `battle_rope_met_anker` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `boccia_bal` | bovenpunt | top | fallback | PASS |  |
| `bodypump_halterset` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `bosu_balanstrainer_en_foamroller` | bovenpunt | top | fallback | PASS |  |
| `brug_gelijke_leggers_school_laag` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS | paal 1: aanhechting onder "Parallel_Bar_1" (1.51 m); paal 2: aanhechting onder "Parallel_Bar_-1" (1.51 m); paal 3: aanhechting onder "Parallel_Bar_1" (1.51 m); paal 4: aanhechting onder "Parallel_Bar_-1" (1.51 m) |
| `bumper_plates_set_opbergrek` | paal | paal_top↕ | afgeleid | PASS |  |
| `cricketbat` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `dikke_mat_300x200x30` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `dodgeball_vinyl_blauw` | bovenpunt | top | fallback | PASS |  |
| `dodgeball_vinyl_rood` | bovenpunt | top | fallback | PASS |  |
| `dopje_blauw_los` | kegel | top | afgeleid | PASS |  |
| `dopjes_kleurenset_4stuks` | kegel | top_1, top_2, top_3, top_4 | afgeleid | PASS |  |
| `dopjes_op_houder_set` | bovenpunt | top | fallback | PASS |  |
| `dumbbell_hex_los` | bovenpunt | top | fallback | PASS |  |
| `dumbbell_neopreen_set` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `dumbbellrek_compleet` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `ehbo_sportkoffer_en_bidonrek` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `evenwichtsbalk_hoog_fig_125` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `evenwichtsbalk_laag_vloermodel_30` | bovenpunt | top_1, top_2, top_3 | fallback | PASS |  |
| `fitness_elastiek_set` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `fitness_schijf_los_20kg` | bovenpunt | top_1, top_2, top_3 | fallback | PASS |  |
| `fitnessbank_verstelbaar_incline` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `fitnessmat_blauw_uitgerold` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `fitnessmat_rek_gevuld` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "MatRek_TopBalk" (1.76 m); paal 2: aanhechting onder "MatRek_TopBalk" (1.76 m) |
| `floorball_puck` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `floorball_ring_blauw` | bovenpunt | top | fallback | PASS |  |
| `floorball_ring_geel` | bovenpunt | top | fallback | PASS |  |
| `floorballbal_geperforeerd` | bovenpunt | top | fallback | PASS |  |
| `floorballstick_unihockey` | bovenpunt | top_1, top_2, top_3 | fallback | PASS |  |
| `fluitje_met_koord_en_kaarten` | bovenpunt | top | fallback | PASS |  |
| `foambal_groot_20cm` | bovenpunt | top | fallback | PASS |  |
| `foambal_klein_7cm` | bovenpunt | top | fallback | PASS |  |
| `foambal_middel_16cm` | bovenpunt | top | fallback | PASS |  |
| `foambal_olifantenhuid_geel` | bovenpunt | top | fallback | PASS |  |
| `foambal_olifantenhuid_rood` | bovenpunt | top | fallback | PASS |  |
| `foamturnkast_4delig` | bovenpunt | top | fallback | PASS |  |
| `foamturnkast_topdeel_los` | bovenpunt | top | fallback | PASS |  |
| `grensrechter_vlaggen_paar` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS | Blender-node aanbevolen |
| `groot_klimnet_stalen_frame_4x3m` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS | Blender-node aanbevolen |
| `grote_trampoline_ingeklapt_rolstandaard` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS | paal 1: aanhechting onder "Folded_Top_Bar_-1" (2.29 m); paal 2: aanhechting onder "Folded_Top_Bar_-1" (2.29 m); paal 3: aanhechting onder "Folded_Top_Bar_1" (2.29 m); paal 4: aanhechting onder "Folded_Top_Bar_1" (2.29 m) |
| `grote_trampoline_verzonken_vloermodel` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `grote_trampoline_vrijstaand_uitgeklapt` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `handbal_maat_2` | bovenpunt | top | fallback | PASS |  |
| `handfluit_knijpfluit_hygienisch` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `hoekvlag_cornervlag_met_voet` | paal | paal_top↕ | afgeleid | PASS |  |
| `hoepel_en_springtouw_opbergrek` | paal | paal_top↕ | afgeleid | PASS | paal 1: aanhechting onder "Cylinder.003" (1.24 m) |
| `honkbal_harde_kern` | bovenpunt | top | fallback | PASS |  |
| `honkbal_softbal_honkenset_compleet` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `honkbal_thuishonk_home_plate` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `honkbal_veldhonk_kussen` | bovenpunt | top | fallback | PASS |  |
| `honkbal_werpersplaat_pitchers_plate` | bovenpunt | top | fallback | PASS |  |
| `honkbal_zaalhonken_rubber_set` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `honkbalknuppel_aluminium` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `honkbalknuppel_hout` | bovenpunt | top | fallback | PASS |  |
| `honkbalknuppel_veiligheidsschuim` | bovenpunt | top | fallback | PASS |  |
| `judomat_los_200x100x4_groen` | bovenpunt | top | fallback | PASS |  |
| `judomat_los_200x100x4_rood` | bovenpunt | top | fallback | PASS |  |
| `judomatten_halve_gymzaal_10x10m` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `judomatten_halve_gymzaal_10x12m` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `judomatten_halve_gymzaal_10x12m_blauw_rood` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `judomatten_halve_gymzaal_10x12m_groen` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `kettlebell_rood_16kg` | bovenpunt | top | fallback | PASS |  |
| `kin_ball_reuzenbal` | bovenpunt | top | fallback | PASS |  |
| `klembord_en_kijkwijzer_kaarten_set` | bovenpunt | top | fallback | PASS |  |
| `klimnet_schuin_gymzaalframe` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Trans_Bar_2.30" (2.20 m); paal 2: aanhechting onder "Trans_Bar_2.30" (2.20 m) |
| `klimtouwen_set_2_hangend` | bovenpunt | top_1, top_2 | fallback | PASS | Blender-node aanbevolen |
| `klimtouwen_set_4_hangend` | bovenpunt | top_1, top_2 | fallback | PASS | Blender-node aanbevolen |
| `korfbal_maat_5` | bovenpunt | top | fallback | PASS |  |
| `korfbalmand_kunststof_geel_los` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `korfbalpaal_compleet_250` | paal | paal_top↕ | afgeleid | PASS | paal 1: aanhechting onder "Korf_IKF_Kunststof" (2.15 m) |
| `korfbalpaal_compleet_350` | paal | paal_top↕ | afgeleid | PASS | paal 1: aanhechting onder "Korf_IKF_Kunststof" (3.15 m) |
| `lacrossestick_crosse` | bovenpunt | top | fallback | PASS |  |
| `lange_mat_oprolbaar_12m_uitgerold` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `lange_mat_oprolbaar_6m_uitgerold` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `leerling_blauw` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `leerling_geel` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `leerling_groen` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `leerling_oranje` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `leerling_paars` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `leerling_rennen` | bovenpunt | top | fallback | PASS |  |
| `leerling_rood` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `leerling_staand_rust` | bovenpunt | top | fallback | PASS |  |
| `leerling_wandelen` | bovenpunt | top | fallback | PASS |  |
| `leerling_zittend_turnbank` | bovenpunt | top | fallback | PASS |  |
| `materialenkar_gymzaal_multifunctioneel` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS | paal 1: aanhechting onder "Cylinder.002" (1.03 m); paal 2: aanhechting onder "Cylinder.002" (1.03 m); paal 3: aanhechting onder "Cylinder.005" (1.03 m); paal 4: aanhechting onder "Cylinder.005" (1.03 m) |
| `mattenkar_compleet` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `medicijnbal_slambal_wallball_set` | bovenpunt | top_1, top_2, top_3 | fallback | PASS |  |
| `megafoon_en_luchthoorn` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `minitrampoline` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `opbergkratjes_en_ballennet_set` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `padelracket_carbon` | bovenpunt | top | fallback | PASS |  |
| `partijhesjes_teamlintjes_set` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `petanque_boule_staal` | bovenpunt | top | fallback | PASS |  |
| `petanque_butje` | bovenpunt | top | fallback | PASS |  |
| `pickleball_paddle` | bovenpunt | top | fallback | PASS |  |
| `pion_effen_kleurenset` | kegel | top_1, top_2, top_3, top_4 | afgeleid | PASS |  |
| `pion_gatenpion_set_met_stok` | kegel | top_1, top_2 | afgeleid | PASS |  |
| `pion_opbergstapel` | kegel | top | afgeleid | PASS |  |
| `pion_oranje_wit_gestreept` | kegel | top | afgeleid | PASS |  |
| `plankoline_modern_staalframe` | bovenpunt | top | fallback | PASS |  |
| `plyobox_hout_3in1` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS | paal 1: aanhechting onder "Edge_X_0.25_0.59" (0.52 m); paal 2: aanhechting onder "Edge_X_-0.25_0.59" (0.52 m); paal 3: aanhechting onder "Edge_X_0.25_0.59" (0.52 m); paal 4: aanhechting onder "Edge_X_-0.25_0.59" (0.52 m) |
| `plyobox_soft_foam_set` | bovenpunt | top_1, top_2, top_3 | fallback | PASS |  |
| `powerbag_sandbag` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `reactiebal_noppen` | bovenpunt | top | fallback | PASS |  |
| `rekstok_laag_school` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Horizontal_Bar_240" (1.22 m); paal 2: aanhechting onder "Horizontal_Bar_240" (1.22 m) |
| `rekstok_wand_uitklapbaar` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Wall_Boom_-1" (2.35 m); paal 2: aanhechting onder "Wall_Boom_1" (2.35 m) |
| `rugbybal` | bovenpunt | top | fallback | PASS |  |
| `scorebord_op_verrijdbaar_statief` | paal | paal_top↕ | afgeleid | PASS | paal 1: aanhechting onder "Cube.003" (1.19 m) |
| `scorebord_tafelmodel` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `shuttle_nylon` | bovenpunt | top | fallback | PASS |  |
| `skippybal` | bovenpunt | top | fallback | PASS |  |
| `slagbal_massief_rubber` | bovenpunt | top | fallback | PASS |  |
| `slagballatje_slagplankje` | paal | paal_top↕ | afgeleid | PASS |  |
| `slalompalen_set_met_voet` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS |  |
| `slow_motion_bal` | bovenpunt | top | fallback | PASS |  |
| `softbal_12_inch` | bovenpunt | top | fallback | PASS |  |
| `softbal_veiligheidshonk_dubbelhonk` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `spanbrug_ongelijke_leggers_school_training` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "High_Bar_240" (2.21 m); paal 2: aanhechting onder "High_Bar_240" (2.21 m) |
| `speedbadminton_crossminton_racket` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `springbok_laag_jeugd_80cm` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `springbok_standaard_105cm` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `springpaard_klassiek_160` | bovenpunt | top | fallback | PASS |  |
| `springplank_senior_4veers` | bovenpunt | top | fallback | PASS |  |
| `springtouw_speedrope` | bovenpunt | top_1, top_2 | fallback | PASS | Blender-node aanbevolen |
| `squashbal_dubbel_geel` | bovenpunt | top | fallback | PASS |  |
| `squashracket_teardrop` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `squatrek_half_rack` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS | paal 1: aanhechting onder "Dwarsbalk_Boven_Achter" (2.13 m); paal 2: aanhechting onder "TopBrug_-1" (2.13 m); paal 3: aanhechting onder "Dwarsbalk_Boven_Achter" (2.13 m); paal 4: aanhechting onder "TopBrug_1" (2.13 m) |
| `start_finish_vlag_en_klepper` | bovenpunt | top_1, top_2 | fallback | PASS | Blender-node aanbevolen |
| `stopwatch_digitaal` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `strandbal_opblaasbaar` | bovenpunt | top | fallback | PASS |  |
| `tactiekbord_coachbord_veld` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `tafeltennisbal_wit` | bovenpunt | top | fallback | PASS |  |
| `tafeltennisbatje` | bovenpunt | top | fallback | PASS |  |
| `tennisbal_standaard` | bovenpunt | top | fallback | PASS |  |
| `tennisracket_standaard` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `touwladder_hangend_5m` | paal | ophang_1, ophang_2 | afgeleid | PASS |  |
| `trefbal_zacht_rubber` | bovenpunt | top | fallback | PASS |  |
| `turnbank_1_los` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `turnbank_4_stapel` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕, paal_5↕ | afgeleid | PASS | paal 1: aanhechting onder "Voet_Dwarsbalk_Links_4" (0.92 m); paal 2: aanhechting onder "Voet_Dwarsbalk_Links_4" (0.92 m); paal 3: aanhechting onder "Evenwichtsbalk_4" (0.95 m); paal 4: aanhechting onder "Antislip_Zool_1_4" (0.89 m); paal 5: aanhechting onder "Antislip_Zool_-1_4" (0.89 m) |
| `turnkast_140x83x114` | bovenpunt | top | fallback | PASS |  |
| `turnkast_1_delig_kastkop` | bovenpunt | top | fallback | PASS |  |
| `turnkast_2_delig` | bovenpunt | top | fallback | PASS |  |
| `turnkast_3_delig` | bovenpunt | top | fallback | PASS |  |
| `turnkast_4_delig` | bovenpunt | top | fallback | PASS |  |
| `turnkast_5_delig` | bovenpunt | top | fallback | PASS |  |
| `turnkast_6_delig_1_recht` | bovenpunt | top | fallback | PASS |  |
| `turnkast_7_delig_2_recht` | bovenpunt | top | fallback | PASS |  |
| `turnmat_200x100x6` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `veldhockeybal_glad` | bovenpunt | top | fallback | PASS |  |
| `veldhockeydoel_180x120_jeugd` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Dwarslat" (1.13 m); paal 2: aanhechting onder "Dwarslat" (1.13 m) |
| `veldhockeydoel_366x214_verplaatsbaar` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Dwarslat" (2.07 m); paal 2: aanhechting onder "Dwarslat" (2.07 m) |
| `veldhockeystick` | bovenpunt | top_1, top_2 | fallback | PASS |  |
| `veldvoetbaldoel_500x200_verplaatsbaar` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Dwarslat" (1.93 m); paal 2: aanhechting onder "Dwarslat" (1.93 m) |
| `veldvoetbaldoel_732x244_verplaatsbaar` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Dwarslat" (2.37 m); paal 2: aanhechting onder "Dwarslat" (2.37 m) |
| `vloermarkering_rubber_set` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `voetbal_veld_maat_5` | bovenpunt | top | fallback | PASS |  |
| `volleybal_beach_softtouch` | bovenpunt | top | fallback | PASS |  |
| `volleybal_veldopstelling_bodemnet_grond_100cm` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `volleybal_veldopstelling_compleet_dames` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Spankabel_Boven" (2.16 m); paal 2: aanhechting onder "Spankabel_Boven" (2.16 m) |
| `volleybal_veldopstelling_compleet_heren` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Spankabel_Boven" (2.35 m); paal 2: aanhechting onder "Spankabel_Boven" (2.35 m) |
| `volleybal_veldopstelling_middelhoog_180cm` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `volleybal_zaal` | bovenpunt | top | fallback | PASS |  |
| `volleybalnet_bodemnet_grond_100cm_los` | net | net_links, net_rechts | afgeleid | PASS |  |
| `volleybalnet_compleet_antennes_los` | net | net_links, net_rechts | afgeleid | PASS |  |
| `volleybalnet_middelhoog_180cm_los` | net | net_links, net_rechts | afgeleid | PASS |  |
| `volleybalpalen_mobiel_set` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `volleybalpalen_vloerbus_set` | paal | paal_1↕, paal_2↕ | afgeleid | PASS |  |
| `wandrek_dubbel_veld` | bovenpunt | top_1, top_2, top_3 | fallback | PASS | Blender-node aanbevolen |
| `wandrek_enkel_veld` | bovenpunt | top_1, top_2 | fallback | PASS | Blender-node aanbevolen |
| `wandrek_uitklapbaar_zwenk` | bovenpunt | top_1, top_2 | fallback | PASS | Blender-node aanbevolen |
| `waterpolobal` | bovenpunt | top | fallback | PASS |  |
| `whiteboard_verrijdbaar_dubbelzijdig` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Cube.008" (1.59 m); paal 2: aanhechting onder "Cube.008" (1.59 m) |
| `yogamat_opgerold_set` | paal | paal_top↕ | afgeleid | PASS |  |
| `zaalhockeybalk_los_2m` | bovenpunt | top | fallback | PASS |  |
| `zaalhockeybalk_los_4m` | bovenpunt | top | fallback | PASS |  |
| `zaalhockeybalken_gekoppeld_rij` | bovenpunt | top | fallback | PASS |  |
| `zaalhockeybalken_transportwagen` | paal | paal_1↕, paal_2↕, paal_3↕, paal_4↕ | afgeleid | PASS | paal 1: aanhechting onder "Staander_Boven_-0.55" (1.18 m); paal 2: aanhechting onder "Staander_Boven_-0.55" (1.18 m); paal 3: aanhechting onder "Staander_Boven_0.55" (1.18 m); paal 4: aanhechting onder "Staander_Boven_0.55" (1.18 m) |
| `zaalhockeydoel_300x200_wit` | paal | paal_1↕, paal_2↕ | afgeleid | PASS | paal 1: aanhechting onder "Dwarslat" (1.95 m); paal 2: aanhechting onder "Dwarslat" (1.95 m) |
| `zaaltimer_intervalklok_digitaal` | bovenpunt | top | fallback | PASS |  |
| `zaalvoetbal_futsalbal_plofbal` | bovenpunt | top | fallback | PASS |  |
| `zaalvoetbal_handbaldoel_3x2` | bovenpunt | top | fallback | PASS | Blender-node aanbevolen |
| `zandlopers_tijdset` | bovenpunt | top_1, top_2, top_3, top_4 | fallback | PASS |  |
| `zwaairingen_gymzaal_laag` | bovenpunt | top | fallback | PASS | Blender-node aanbevolen |

↕ = hoogteverstelbaar langs de paal.
