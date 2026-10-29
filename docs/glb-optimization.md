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

Uploadstatus: alle modellen uit de Drive staan in Supabase (`materials-3d/models/<slug>.glb`).

### Leerlingen: pose bakken vóór export

> De huidige leerlingen (`lib/students`, zie `docs/students.md`) zijn statische meshes en hebben dit niet nodig; dit geldt voor een leerling met skin/armature.

De Blender-export van `leerling_*` bevat alleen de bind-pose (A-pose); de gewenste pose zit in de `.blend` als pose van de
armature. Een geskind GLB toont die pose dus niet in three.js. Daarom wordt de pose gebakken: de armature-modifier wordt
toegepast en het resultaat zonder skin geëxporteerd (`export_apply=True`, `export_skins=False`). Zo is het model statisch,
Meshopt-comprimeerbaar en klopt de bounding box (collision).

```
pip install bpy   # Python 3.13, ±400 MB; eenmalig in een venv
python scripts/blender/bake-pose.py leerling_rennen.blend leerling_rennen.glb
```

Daarna: laagste punt op y=0 zetten en (waar nodig) centreren, optimaliseren met `optimize-glbs.mts` en importeren met
`import-materials.mts`. Lever nieuwe poses dus als `.blend` met de pose toegepast aan; de losse `.glb` uit Blender is niet nodig.
