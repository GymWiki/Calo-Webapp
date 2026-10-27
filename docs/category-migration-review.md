# Review categorie-migratie

Gegenereerd door `scripts/migrate-categories.mts` (dry-run). Items waarbij de automatische indeling onzeker is, staan hieronder met de voorgestelde keuze en een reden. Niets is gewijzigd in de database zolang `--apply` niet is gedraaid; de oude categorie blijft bewaard in `categorie_oud`.

## Aantal items per nieuwe categorie

| Categorie | Items | Subgroepen |
| --- | ---: | --- |
| Toestellen | 36 | Banken 2, Kasten 10, Springen 9, Hangen & zwaaien 5, Balanceren 2, Klimmen 8 |
| Doelen & netten | 20 | — |
| Ballen | 35 | Basketbal 2, Voetbal 2, Volley/Hand 3, Overig 28 |
| Matten | 7 | — |
| Klein materiaal | 40 | Afzetten & markeren 15, Sticks & rackets 15, Overig 10 |
| Fitness | 23 | — |
| Opslag & karren | 17 | — |
| Personen | 6 | — |
| **Totaal** | **184** | |

## Onzekere items (42)

Controleer deze; pas aan via de CSV-export/-import (`npm run library:csv`) of laat het weten.

| Item | Oude categorie | Voorstel | Sporten | Reden |
| --- | --- | --- | --- | --- |
| `airblock_200x140_20cm` (Airblock 200x140 20cm) | airtrack | Matten | Turnen | Airtrack/airblock is zowel mat als toestel: bij Matten gezet |
| `airtrack_p2_12m` (Airtrack p2 12m) | airtrack | Matten | Turnen | Airtrack/airblock is zowel mat als toestel: bij Matten gezet |
| `airtrack_p2_6m` (Airtrack p2 6m) | airtrack | Matten | Turnen | Airtrack/airblock is zowel mat als toestel: bij Matten gezet |
| `badmintonracket_senior` (Badmintonracket senior) | sticks_rackets | Klein materiaal > Sticks & rackets | Badminton | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `batting_tee_slagbalstatief` (Batting tee slagbalstatief) | accessoires_doelobjecten | Klein materiaal > Overig | Slagspelen | Accessoire zonder eigen categorie: bij Klein materiaal gezet |
| `cricketbat` (Cricketbat) | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `fitnessmat_blauw_uitgerold` (Fitnessmat blauw uitgerold) | fitness_losse_materialen | Fitness | Fitness | Mat: kan bij Matten of Fitness; bij Fitness gelaten (oude categorie) |
| `fitnessmat_rek_gevuld` (Fitnessmat rek gevuld) | fitness_losse_materialen | Fitness | Fitness | Mat: kan bij Matten of Fitness; bij Fitness gelaten (oude categorie) |
| `floorball_puck` (Floorball puck) | accessoires_doelobjecten | Klein materiaal > Overig | Floorball | Accessoire zonder eigen categorie: bij Klein materiaal gezet |
| `floorball_ring_blauw` (Floorball ring blauw) | accessoires_doelobjecten | Klein materiaal > Overig | Floorball | Accessoire zonder eigen categorie: bij Klein materiaal gezet |
| `floorball_ring_geel` (Floorball ring geel) | accessoires_doelobjecten | Klein materiaal > Overig | Floorball | Accessoire zonder eigen categorie: bij Klein materiaal gezet |
| `floorballstick_unihockey` (Floorballstick unihockey) | sticks_rackets | Klein materiaal > Sticks & rackets | Hockey, Floorball | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `honkbalknuppel_aluminium` (Honkbalknuppel aluminium) | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `honkbalknuppel_hout` (Honkbalknuppel hout) | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `honkbalknuppel_veiligheidsschuim` (Honkbalknuppel veiligheidsschuim) | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `klembord_en_kijkwijzer_kaarten_set` (Klembord en kijkwijzer kaarten set) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |
| `korfbal_maat_5` (Korfbal maat 5) | ballen | Ballen > Overig | Korfbal | Korfbal past in geen van de vaste subgroepen (Basketbal, Voetbal, Volley/Hand): bij Overig gezet |
| `lacrossestick_crosse` (Lacrossestick crosse) | sticks_rackets | Klein materiaal > Sticks & rackets | Algemeen | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `megafoon_en_luchthoorn` (Megafoon en luchthoorn) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |
| `padelracket_carbon` (Padelracket carbon) | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `pickleball_paddle` (Pickleball paddle) | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `plyobox_hout_3in1` (Plyobox hout 3in1) | fitness_losse_materialen | Fitness | Fitness | Plyobox: kan bij Fitness of Toestellen > Springen; bij Fitness gelaten (oude categorie) |
| `plyobox_soft_foam_set` (Plyobox soft foam set) | fitness_losse_materialen | Fitness | Fitness | Plyobox: kan bij Fitness of Toestellen > Springen; bij Fitness gelaten (oude categorie) |
| `scorebord_op_verrijdbaar_statief` (Scorebord op verrijdbaar statief) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |
| `scorebord_tafelmodel` (Scorebord tafelmodel) | signaleringsmateriaal | Opslag & karren | Algemeen | Scorebord is organisatiemateriaal: bij Opslag & karren gezet (zoals het verrijdbare scorebord) |
| `shuttle_nylon` (Shuttle nylon) | accessoires_doelobjecten | Klein materiaal > Overig | Badminton | Accessoire zonder eigen categorie: bij Klein materiaal gezet |
| `slagballatje_slagplankje` (Slagballatje slagplankje) | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `speedbadminton_crossminton_racket` (Speedbadminton crossminton racket) | sticks_rackets | Klein materiaal > Sticks & rackets | Badminton, Racketsport | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `squashracket_teardrop` (Squashracket teardrop) | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `tactiekbord_coachbord_veld` (Tactiekbord coachbord veld) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |
| `tafeltennisbal_wit` (Tafeltennisbal wit) | accessoires_doelobjecten | Ballen > Overig | Racketsport | Accessoire én bal: bij Ballen gezet |
| `tafeltennisbatje` (Tafeltennisbatje) | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `tennisracket_standaard` (Tennisracket standaard) | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `veldhockeystick` (Veldhockeystick) | sticks_rackets | Klein materiaal > Sticks & rackets | Hockey | Sticks en rackets staan niet in de lijst met categorieën: bij Klein materiaal > Sticks & rackets gezet |
| `whiteboard_verrijdbaar_dubbelzijdig` (Whiteboard verrijdbaar dubbelzijdig) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |
| `yogamat_opgerold_set` (Yogamat opgerold set) | fitness_losse_materialen | Fitness | Fitness | Mat: kan bij Matten of Fitness; bij Fitness gelaten (oude categorie) |
| `zaalhockeybalk_los_2m` (Zaalhockeybalk los 2m) | doelen | Klein materiaal > Afzetten & markeren | Hockey | Zaalhockeybalken zijn banden/afzetting, geen doel: bij Klein materiaal > Afzetten gezet |
| `zaalhockeybalk_los_4m` (Zaalhockeybalk los 4m) | doelen | Klein materiaal > Afzetten & markeren | Hockey | Zaalhockeybalken zijn banden/afzetting, geen doel: bij Klein materiaal > Afzetten gezet |
| `zaalhockeybalken_gekoppeld_rij` (Zaalhockeybalken gekoppeld rij) | doelen | Klein materiaal > Afzetten & markeren | Hockey | Zaalhockeybalken zijn banden/afzetting, geen doel: bij Klein materiaal > Afzetten gezet |
| `zaalhockeybalken_transportwagen` (Zaalhockeybalken transportwagen) | doelen | Opslag & karren | Hockey | Transportwagen voor hockeybalken: bij Opslag & karren gezet |
| `zaaltimer_intervalklok_digitaal` (Zaaltimer intervalklok digitaal) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |
| `zandlopers_tijdset` (Zandlopers tijdset) | organisatiemateriaal | Opslag & karren | Algemeen | Organisatiemateriaal dat geen opslag is: bij Opslag & karren gezet ("ander organisatiemateriaal") |

## Alle items

| Item | Oude categorie | Nieuwe indeling | Sporten |
| --- | --- | --- | --- |
| `ab_roller_en_pushup_steunen` | fitness_losse_materialen | Fitness | Fitness |
| `aerobic_step` | fitness_losse_materialen | Fitness | Fitness |
| `airblock_200x140_20cm` | airtrack | Matten | Turnen |
| `airtrack_p2_12m` | airtrack | Matten | Turnen |
| `airtrack_p2_6m` | airtrack | Matten | Turnen |
| `american_football` | ballen | Ballen > Overig | Algemeen |
| `badminton_veldopstelling_compleet_mobiel` | badminton | Doelen & netten | Badminton |
| `badminton_veldopstelling_compleet_vloerbus` | badminton | Doelen & netten | Badminton |
| `badmintonnet_los_610` | badminton | Doelen & netten | Badminton |
| `badmintonpalen_mobiel_set` | badminton | Doelen & netten | Badminton |
| `badmintonracket_senior` | sticks_rackets | Klein materiaal > Sticks & rackets | Badminton |
| `ballenkar_metaal_open_gevuld` | organisatiemateriaal | Opslag & karren | Algemeen |
| `ballenpomp_en_drukmeter_set` | organisatiemateriaal | Opslag & karren | Algemeen |
| `ballenrek_breed_3laags` | organisatiemateriaal | Opslag & karren | Algemeen |
| `barbell_compleet_geladen` | fitness_losse_materialen | Fitness | Fitness |
| `barbell_ez_curl_geladen` | fitness_losse_materialen | Fitness | Fitness |
| `basketbal_maat_5` | ballen | Ballen > Basketbal | Basketbal |
| `basketbal_maat_7` | ballen | Ballen > Basketbal | Basketbal |
| `basketbal_muur_vast` | basketbal | Doelen & netten | Basketbal |
| `basketbal_muur_wegdraaibaar` | basketbal | Doelen & netten | Basketbal |
| `basketbaltoren_mobiel_jeugd` | basketbal | Doelen & netten | Basketbal |
| `basketbaltoren_mobiel_senior` | basketbal | Doelen & netten | Basketbal |
| `batting_tee_slagbalstatief` | accessoires_doelobjecten | Klein materiaal > Overig | Slagspelen |
| `battle_rope_met_anker` | fitness_losse_materialen | Fitness | Fitness |
| `boccia_bal` | ballen | Ballen > Overig | Algemeen |
| `bodypump_halterset` | fitness_losse_materialen | Fitness | Fitness |
| `bosu_balanstrainer_en_foamroller` | fitness_losse_materialen | Fitness | Fitness |
| `brug_gelijke_leggers_school_laag` | brug | Toestellen > Hangen & zwaaien | Turnen |
| `bumper_plates_set_opbergrek` | fitness_losse_materialen | Fitness | Fitness |
| `cricketbat` | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen |
| `dikke_mat_300x200x30` | matten | Matten | Turnen |
| `dodgeball_vinyl_blauw` | ballen | Ballen > Overig | Trefspelen |
| `dodgeball_vinyl_rood` | ballen | Ballen > Overig | Trefspelen |
| `dopje_blauw_los` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `dopjes_kleurenset_4stuks` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `dopjes_op_houder_set` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `dumbbell_hex_los` | fitness_losse_materialen | Fitness | Fitness |
| `dumbbell_neopreen_set` | fitness_losse_materialen | Fitness | Fitness |
| `dumbbellrek_compleet` | fitness_losse_materialen | Fitness | Fitness |
| `ehbo_sportkoffer_en_bidonrek` | organisatiemateriaal | Opslag & karren | Algemeen |
| `evenwichtsbalk_hoog_fig_125` | evenwichtsbalk | Toestellen > Balanceren | Turnen |
| `evenwichtsbalk_laag_vloermodel_30` | evenwichtsbalk | Toestellen > Balanceren | Turnen |
| `fitness_elastiek_set` | fitness_losse_materialen | Fitness | Fitness |
| `fitness_schijf_los_20kg` | fitness_losse_materialen | Fitness | Fitness |
| `fitnessbank_verstelbaar_incline` | fitness_losse_materialen | Fitness | Fitness |
| `fitnessmat_blauw_uitgerold` | fitness_losse_materialen | Fitness | Fitness |
| `fitnessmat_rek_gevuld` | fitness_losse_materialen | Fitness | Fitness |
| `floorball_puck` | accessoires_doelobjecten | Klein materiaal > Overig | Floorball |
| `floorball_ring_blauw` | accessoires_doelobjecten | Klein materiaal > Overig | Floorball |
| `floorball_ring_geel` | accessoires_doelobjecten | Klein materiaal > Overig | Floorball |
| `floorballbal_geperforeerd` | ballen | Ballen > Overig | Floorball |
| `floorballstick_unihockey` | sticks_rackets | Klein materiaal > Sticks & rackets | Hockey, Floorball |
| `fluitje_met_koord_en_kaarten` | signaleringsmateriaal | Klein materiaal > Overig | Algemeen |
| `foambal_groot_20cm` | ballen | Ballen > Overig | Trefspelen |
| `foambal_klein_7cm` | ballen | Ballen > Overig | Trefspelen |
| `foambal_middel_16cm` | ballen | Ballen > Overig | Trefspelen |
| `foambal_olifantenhuid_geel` | ballen | Ballen > Overig | Trefspelen |
| `foambal_olifantenhuid_rood` | ballen | Ballen > Overig | Trefspelen |
| `foamturnkast_4delig` | turnkast | Toestellen > Kasten | Turnen |
| `foamturnkast_topdeel_los` | turnkast | Toestellen > Kasten | Turnen |
| `grensrechter_vlaggen_paar` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Voetbal |
| `groot_klimnet_stalen_frame_4x3m` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `grote_trampoline_ingeklapt_rolstandaard` | trampoline | Toestellen > Springen | Turnen |
| `grote_trampoline_verzonken_vloermodel` | trampoline | Toestellen > Springen | Turnen |
| `grote_trampoline_vrijstaand_uitgeklapt` | trampoline | Toestellen > Springen | Turnen |
| `handbal_maat_2` | ballen | Ballen > Volley/Hand | Handbal |
| `handfluit_knijpfluit_hygienisch` | organisatiemateriaal | Klein materiaal > Overig | Algemeen |
| `hoekvlag_cornervlag_met_voet` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Voetbal |
| `hoepel_en_springtouw_opbergrek` | organisatiemateriaal | Opslag & karren | Algemeen |
| `honkbal_harde_kern` | ballen | Ballen > Overig | Slagspelen |
| `honkbalknuppel_aluminium` | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen |
| `honkbalknuppel_hout` | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen |
| `honkbalknuppel_veiligheidsschuim` | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen |
| `kettlebell_rood_16kg` | fitness_losse_materialen | Fitness | Fitness |
| `kin_ball_reuzenbal` | ballen | Ballen > Overig | Trefspelen |
| `klembord_en_kijkwijzer_kaarten_set` | organisatiemateriaal | Opslag & karren | Algemeen |
| `klimnet_schuin_gymzaalframe` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `klimtouwen_set_2_hangend` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `klimtouwen_set_4_hangend` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `korfbal_maat_5` | ballen | Ballen > Overig | Korfbal |
| `korfbalmand_kunststof_geel_los` | korfbal | Doelen & netten | Korfbal |
| `korfbalpaal_compleet_250` | korfbal | Doelen & netten | Korfbal |
| `korfbalpaal_compleet_350` | korfbal | Doelen & netten | Korfbal |
| `lacrossestick_crosse` | sticks_rackets | Klein materiaal > Sticks & rackets | Algemeen |
| `lange_mat_oprolbaar_12m_uitgerold` | matten | Matten | Turnen |
| `lange_mat_oprolbaar_6m_uitgerold` | matten | Matten | Turnen |
| `leerling_blauw` | leerlingen | Personen | Algemeen |
| `leerling_geel` | leerlingen | Personen | Algemeen |
| `leerling_groen` | leerlingen | Personen | Algemeen |
| `leerling_oranje` | leerlingen | Personen | Algemeen |
| `leerling_paars` | leerlingen | Personen | Algemeen |
| `leerling_rood` | leerlingen | Personen | Algemeen |
| `materialenkar_gymzaal_multifunctioneel` | organisatiemateriaal | Opslag & karren | Algemeen |
| `mattenkar_compleet` | opslag | Opslag & karren | Algemeen |
| `medicijnbal_slambal_wallball_set` | fitness_losse_materialen | Fitness | Fitness |
| `megafoon_en_luchthoorn` | organisatiemateriaal | Opslag & karren | Algemeen |
| `minitrampoline` | springen | Toestellen > Springen | Turnen |
| `opbergkratjes_en_ballennet_set` | organisatiemateriaal | Opslag & karren | Algemeen |
| `padelracket_carbon` | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport |
| `partijhesjes_teamlintjes_set` | signaleringsmateriaal | Klein materiaal > Overig | Algemeen |
| `petanque_boule_staal` | ballen | Ballen > Overig | Algemeen |
| `petanque_butje` | ballen | Ballen > Overig | Algemeen |
| `pickleball_paddle` | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport |
| `pion_effen_kleurenset` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `pion_gatenpion_set_met_stok` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `pion_opbergstapel` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `pion_oranje_wit_gestreept` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `plankoline_modern_staalframe` | plankoline | Toestellen > Springen | Turnen |
| `plyobox_hout_3in1` | fitness_losse_materialen | Fitness | Fitness |
| `plyobox_soft_foam_set` | fitness_losse_materialen | Fitness | Fitness |
| `powerbag_sandbag` | fitness_losse_materialen | Fitness | Fitness |
| `reactiebal_noppen` | ballen | Ballen > Overig | Trefspelen |
| `rekstok_laag_school` | rekstok | Toestellen > Hangen & zwaaien | Turnen |
| `rekstok_wand_uitklapbaar` | rekstok | Toestellen > Hangen & zwaaien | Turnen |
| `rugbybal` | ballen | Ballen > Overig | Algemeen |
| `scorebord_op_verrijdbaar_statief` | organisatiemateriaal | Opslag & karren | Algemeen |
| `scorebord_tafelmodel` | signaleringsmateriaal | Opslag & karren | Algemeen |
| `shuttle_nylon` | accessoires_doelobjecten | Klein materiaal > Overig | Badminton |
| `skippybal` | ballen | Ballen > Overig | Algemeen |
| `slagbal_massief_rubber` | ballen | Ballen > Overig | Slagspelen |
| `slagballatje_slagplankje` | sticks_rackets | Klein materiaal > Sticks & rackets | Slagspelen |
| `slalompalen_set_met_voet` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `slow_motion_bal` | ballen | Ballen > Overig | Trefspelen |
| `softbal_12_inch` | ballen | Ballen > Overig | Slagspelen |
| `spanbrug_ongelijke_leggers_school_training` | brug | Toestellen > Hangen & zwaaien | Turnen |
| `speedbadminton_crossminton_racket` | sticks_rackets | Klein materiaal > Sticks & rackets | Badminton, Racketsport |
| `springbok_laag_jeugd_80cm` | springbok | Toestellen > Springen | Turnen |
| `springbok_standaard_105cm` | springbok | Toestellen > Springen | Turnen |
| `springpaard_klassiek_160` | springpaard_voltigepaard | Toestellen > Springen | Turnen |
| `springplank_senior_4veers` | trampoline | Toestellen > Springen | Turnen |
| `springtouw_speedrope` | fitness_losse_materialen | Klein materiaal > Overig | Fitness |
| `squashbal_dubbel_geel` | ballen | Ballen > Overig | Racketsport |
| `squashracket_teardrop` | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport |
| `squatrek_half_rack` | fitness_losse_materialen | Fitness | Fitness |
| `start_finish_vlag_en_klepper` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Atletiek |
| `stopwatch_digitaal` | signaleringsmateriaal | Klein materiaal > Overig | Algemeen |
| `strandbal_opblaasbaar` | ballen | Ballen > Overig | Algemeen |
| `tactiekbord_coachbord_veld` | organisatiemateriaal | Opslag & karren | Algemeen |
| `tafeltennisbal_wit` | accessoires_doelobjecten | Ballen > Overig | Racketsport |
| `tafeltennisbatje` | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport |
| `tennisbal_standaard` | ballen | Ballen > Overig | Racketsport |
| `tennisracket_standaard` | sticks_rackets | Klein materiaal > Sticks & rackets | Racketsport |
| `touwladder_hangend_5m` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `trefbal_zacht_rubber` | ballen | Ballen > Overig | Trefspelen |
| `turnbank_1_los` | banken | Toestellen > Banken | Turnen |
| `turnbank_4_stapel` | banken | Toestellen > Banken | Turnen |
| `turnkast_1_delig_kastkop` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_140x83x114` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_2_delig` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_3_delig` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_4_delig` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_5_delig` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_6_delig_1_recht` | turnkast | Toestellen > Kasten | Turnen |
| `turnkast_7_delig_2_recht` | turnkast | Toestellen > Kasten | Turnen |
| `turnmat_200x100x6` | matten | Matten | Turnen |
| `veldhockeybal_glad` | ballen | Ballen > Overig | Hockey |
| `veldhockeydoel_180x120_jeugd` | doelen | Doelen & netten | Hockey |
| `veldhockeydoel_366x214_verplaatsbaar` | doelen | Doelen & netten | Hockey |
| `veldhockeystick` | sticks_rackets | Klein materiaal > Sticks & rackets | Hockey |
| `veldvoetbaldoel_500x200_verplaatsbaar` | doelen | Doelen & netten | Voetbal |
| `veldvoetbaldoel_732x244_verplaatsbaar` | doelen | Doelen & netten | Voetbal |
| `vloermarkering_rubber_set` | signaleringsmateriaal | Klein materiaal > Afzetten & markeren | Algemeen |
| `voetbal_veld_maat_5` | ballen | Ballen > Voetbal | Voetbal |
| `volleybal_beach_softtouch` | ballen | Ballen > Volley/Hand | Volleybal |
| `volleybal_veldopstelling_compleet_dames` | volleybal | Doelen & netten | Volleybal |
| `volleybal_zaal` | ballen | Ballen > Volley/Hand | Volleybal |
| `volleybalnet_compleet_antennes_los` | volleybal | Doelen & netten | Volleybal |
| `volleybalpalen_mobiel_set` | volleybal | Doelen & netten | Volleybal |
| `wandrek_dubbel_veld` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `wandrek_enkel_veld` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `wandrek_uitklapbaar_zwenk` | klimmen | Toestellen > Klimmen | Turnen, Klimmen |
| `waterpolobal` | ballen | Ballen > Overig | Algemeen |
| `whiteboard_verrijdbaar_dubbelzijdig` | organisatiemateriaal | Opslag & karren | Algemeen |
| `yogamat_opgerold_set` | fitness_losse_materialen | Fitness | Fitness |
| `zaalhockeybalk_los_2m` | doelen | Klein materiaal > Afzetten & markeren | Hockey |
| `zaalhockeybalk_los_4m` | doelen | Klein materiaal > Afzetten & markeren | Hockey |
| `zaalhockeybalken_gekoppeld_rij` | doelen | Klein materiaal > Afzetten & markeren | Hockey |
| `zaalhockeybalken_transportwagen` | doelen | Opslag & karren | Hockey |
| `zaalhockeydoel_300x200_wit` | doelen | Doelen & netten | Hockey |
| `zaaltimer_intervalklok_digitaal` | organisatiemateriaal | Opslag & karren | Algemeen |
| `zaalvoetbal_futsalbal_plofbal` | ballen | Ballen > Voetbal | Voetbal |
| `zaalvoetbal_handbaldoel_3x2` | doelen | Doelen & netten | Voetbal, Handbal |
| `zandlopers_tijdset` | organisatiemateriaal | Opslag & karren | Algemeen |
| `zwaairingen_gymzaal_laag` | ringenstel | Toestellen > Hangen & zwaaien | Turnen |
