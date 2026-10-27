# Testen op een echt toestel (iOS Safari en Android Chrome)

Emulatie in Chrome DevTools dekt veel, maar niet alles. Loop dit af op een echte telefoon (staand, daarna liggend) en een tablet. De geautomatiseerde tests staan in `e2e/` (`npm run test:e2e`).

## Voorbereiding
- Open `/plattegrond-3d` ingelogd. Wis eventueel de onboarding: in Safari/Chrome *Website-gegevens wissen*, of ⋯ → *Uitleg gebaren*.
- Zorg voor een plattegrond met 20+ items en een afgezet veld om geheugen en snelheid te voelen.

## iOS Safari (iPhone, iPad)
- [ ] Geen zoom bij het aantikken van het naamveld of een getalveld (invoer is 16 px).
- [ ] Pull-to-refresh en pagina-pinch gebeuren **niet** boven het canvas; de pagina scrolt niet mee.
- [ ] De werkbalk onderaan staat boven de home-balk (safe area) en niet onder de adresbalk; de drawer krijgt de juiste hoogte als de adresbalk in- en uitklapt (dvh).
- [ ] 1 vinger draait de camera, 2 vingers zoomen en verschuiven, dubbeltik op een leeg stuk reset de camera.
- [ ] Een vinger op een niet-geselecteerd item draait de camera; tik selecteert; daarna slepen verplaatst het item.
- [ ] Rotatiehandvat (oranje bolletje) is makkelijk te raken en draait in stappen van 15°.
- [ ] Drawer: slepen aan de handle (half → vol → dicht), tik buiten sluit; scrollen in de lijst scrolt niet de pagina erachter.
- [ ] Veld afzetten: tik hoek 1, tik hoek 2, handles slepen, *Klaar*.
- [ ] Veel items plaatsen en weer verwijderen: de pagina blijft stabiel (geen herlaad door geheugen).
- [ ] Opslaan: bevestiging zichtbaar; vliegtuigmodus aan → melding "offline"; app sluiten en heropenen → aanbod om niet-opgeslagen wijzigingen te herstellen.
- [ ] Trilling (haptics) werkt **niet** op iOS Safari — dat is verwacht.

## Android Chrome
- [ ] Alle punten hierboven.
- [ ] Subtiele trilling bij plaatsen en bij vastklikken (snap).
- [ ] Kwaliteit Auto: na een tijdje draaien op een zwakker toestel gaat de beeldscherpte merkbaar omlaag zonder haperen; Kwaliteit Laag/Hoog in het ⋯-menu werkt direct.
- [ ] Android-terugknop: sluit eerst de drawer? (nu niet — gaat een pagina terug; noteer wat je verwacht).

## Tablet
- [ ] Staand (≥ 640 px): bibliotheek schuift als zijpaneel van links in, item/omgeving van rechts; het canvas blijft bruikbaar terwijl het paneel open staat.
- [ ] Liggend iPad (≥ 1024 px): drie kolommen zoals op de pc; canvas is breed genoeg.

## Alleen-lezen viewer (activiteitpagina)
- [ ] Verticaal vegen over de plattegrond scrolt de pagina (geen scroll-hijacking); horizontaal vegen draait; knijpen zoomt.

## Meten
- Safari Web Inspector (iOS) of `chrome://inspect` (Android): kijk bij het draaien naar fps en geheugen; noteer het toestel en de kwaliteitsstand in `docs/mobile-performance.md`.
