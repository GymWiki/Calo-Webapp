# GLB-optimalisatie (geschreven naar ../../../tmp/claude-0/-home-user-Calo-Webapp/f1774af3-50d8-502d-afec-f101c2f15496/scratchpad/glb-opt)

184 bestanden: 100.98 MB → 19.40 MB (−81%).

| Grootste na optimalisatie | Voor | Na |
| --- | ---: | ---: |
| groot_klimnet_stalen_frame_4x3m | 3.31 MB | 0.52 MB |
| waterpolobal | 2.11 MB | 0.50 MB |
| reactiebal_noppen | 2.42 MB | 0.48 MB |
| touwladder_hangend_5m | 2.15 MB | 0.45 MB |
| veldvoetbaldoel_732x244_verplaatsbaar | 1.56 MB | 0.45 MB |
| handbal_maat_2 | 2.05 MB | 0.44 MB |
| basketbal_maat_5 | 1.98 MB | 0.43 MB |
| basketbal_maat_7 | 1.98 MB | 0.43 MB |

| Grootste winst | Voor | Na |
| --- | ---: | ---: |
| groot_klimnet_stalen_frame_4x3m | 3.31 MB | 0.52 MB |
| reactiebal_noppen | 2.42 MB | 0.48 MB |
| touwladder_hangend_5m | 2.15 MB | 0.45 MB |
| handbal_maat_2 | 2.05 MB | 0.44 MB |
| waterpolobal | 2.11 MB | 0.50 MB |
| american_football | 2.01 MB | 0.42 MB |
| volleybal_beach_softtouch | 1.94 MB | 0.39 MB |
| basketbal_maat_5 | 1.98 MB | 0.43 MB |

## Let op: geskinde modellen (leerlingen met armature)

`optimize-glbs.mts` slaat GLB's met een skin over en neemt ze ongewijzigd over. Meshopt-quantisatie maakt van de
bounding box van een geskind model ±1 m en laat de afmetingen/collision verkeerd uitkomen. Alle andere GLB's zijn
na optimalisatie binnen 1 cm gelijk aan het origineel (gecontroleerd over alle 184).

`import-materials.mts` en `audit-collision.mts` kunnen Meshopt-gecomprimeerde GLB's lezen (decoder geregistreerd).

Uploadstatus: de 184 geoptimaliseerde modellen staan in Supabase (`materials-3d/models/<slug>.glb`).
De nieuwe leerlingen `leerling_staand_rust`, `leerling_zittend_turnbank` en `leerling_rennen` zijn **niet** geüpload:
hun GLB staat in een A-pose (armen schuin omlaag, staand), niet in de houding van de preview (rennend / zittend op
de bank). De pose zit niet in de GLB-export; exporteer vanuit Blender met de pose toegepast (Armature-modifier
toepassen of "Apply Pose" voor export) en lever opnieuw aan.
