# Wandrekken: oorzaak, fix en migratie

**Oorzaak (met bewijs):** in de GLB's (`gymzaal_standaard`, `gymzaal_complex_2x2`, `gymzaal_complex_4x1`) staan alle `Wandrek*`-nodes met een rotatie van 180° om Y
(quaternion `[0, −1, 0, 4,4e−8]`) op `wandmidden + 0,19 m`. Het wandrekmodel zelf is goed: de ribben (Wandrek_Hout_Essen) zitten rond lokale z = 0 met een
toprail op +0,12…0,16, de stalen console (`Staal_Wandconsole`) zit met 124 vertices op lokale z = −0,14 (de achterkant). Door de 180° wees de console de zaal in
en zaten de ribben tegen/in de achterwand (binnenkant wand op −6,97 m, ribben op −7,08 m). Dat komt overeen met jouw melding. Meting: `scripts/audit-wall-orientation.ts`
(8 wandrekken in drie zalen).

**Fix:** één correctie in de loader (`EnvironmentModel.tsx` + `components/canvas-3d/wall-mount.ts`): de node 180° om Y draaien en 9 cm naar de zaal toe schuiven, zodat de
achterkant de wand precies raakt (0,0 cm marge) en de ribben de zaal in wijzen. Het GLB hoeft niet aangepast; dit geldt voor de editor, de viewer en thumbnails.
Zodra het GLB in Blender is rechtgezet (rotatie 0°, oorsprong 0,05 m voor de wandbinnenkant, Apply Transforms) moet `WALL_MOUNT_NODE` worden uitgezet, anders draait het model dubbel.

**Migratie:** niet nodig. De wandrekken zijn onderdeel van de zaalomgeving, geen plattegrond-items, en hebben geen anchors of koppelingen (touwen/matten hangen aan items,
niet aan omgevingsnodes). Er is niets op productie gewijzigd; plattegronden bewaren alleen welke nodes verborgen zijn.
