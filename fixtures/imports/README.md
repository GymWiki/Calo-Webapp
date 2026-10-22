# Testset voor "Activiteit uit document"

Regressietest voor de herbouwde documentimport (zie `lib/ai/documentNormalization.ts`
en `lib/ai/activityImportExtraction.ts`). Draai met `npm run eval:import` —
zie `scripts/eval-import.mjs` voor de scoring-logica.

Elke map hieronder is één fixture: `document.<ext>` is het brondocument,
`expected.json` zegt per formveld welke (sub)teksten de extractie daarin hoort
te vinden (fuzzy substring-match, geen exacte string-vergelijking — AI-output
varieert licht per run).

## Al aanwezig (zelf gebouwd)

- `platte-tekst-zonder-kopjes/` — platte `.txt`, geen enkel kopje, puur lopende
  tekst. Test of de extractie op BETEKENIS werkt zonder structuursignalen.
- `opsommingslijst/` — `.md` met een platte bullet-lijst, geen tabel, geen
  proza-beschrijving.
- `tabel-andere-kopjes/` — `.md`-tabel met kopjes die NIETS lijken op dit
  project se eigen veldnamen ("Opwarmer", "Kern - wat moet je bereiken",
  "Spelverloop", "Afspraken tijdens het spel", "Veiligheid", "Benodigdheden",
  "Niveau") — test of de mapping op betekenis werkt i.p.v. op letterlijke
  kopjes-herkenning.

Deze drie dekken samen al het txt/md-normalisatiepad (`officeparser`'s
`.to("md")`) en het kernprobleem van de herbouw: een ander sjabloon dan de
twee oorspronkelijke voorbeelddocumenten moet nu ook goed werken.

## Nog aan te leveren (door de gebruiker)

Deze kan ik niet zelf genereren zonder een nieuwe, ongeverifieerde
document-generatie-dependency toe te voegen (precies het soort risico dit
project vermijdt) — voeg ze hieronder toe met een eigen `expected.json`
ernaast, dan pakt `eval-import.mjs` ze vanzelf op:

- `tikspel-robin-hood-vs-batman/document.docx` — het originele voorbeeld uit
  de brief (`Tikspel_-_Robin_Hood_vs_Batman.docx`).
- `foto-papieren-lesbrief/document.jpg` — een foto van een papieren
  lesvoorbereiding (test het `image_url`-pad + visuele lay-out-begrip).
- `los-pdf-bestand/document.pdf` — een PDF-lesvoorbereiding (test het
  `input_file`-pad).
- `ander-tabelsjabloon/document.docx` — een docx met een tabelsjabloon met
  weer ANDERE kopjes dan `tabel-andere-kopjes/` hierboven (een tweede
  datapunt voor "sjabloon-onafhankelijkheid").

Voor elke map: zet het brondocument erin als `document.<ext>`, en een
`expected.json` met de vorm:

```json
{
  "fields": {
    "title": ["verwachte substring"],
    "goals": ["verwachte substring", "nog een"],
    "rules": ["verwachte substring"]
  }
}
```

Elke sleutel is een `CreateLessonFormInput`-veldnaam (zie
`lib/ai/extractedActivityMapping.ts`); alleen velden waar je zeker van bent
wat erin hoort te staan hoeven een entry te hebben — een leeg/ontbrekend veld
wordt niet meegeteld in de score.

`scripts/eval-import.mjs` slaat een map zonder `document.*` of `expected.json`
over met een duidelijke waarschuwing — het script faalt dus NIET zolang deze
vier mappen leeg blijven, maar scoort ze ook niet mee.
