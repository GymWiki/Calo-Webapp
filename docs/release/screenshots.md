# Schermafbeeldingen

## Formaten (controleer de actuele eisen in de consoles)
- **Apple:** iPhone 6,9" (1320×2868 of 1290×2796), eventueel 6,5" (1284×2778/1242×2688); iPad 13" (2064×2752) alleen als je iPad ondersteunt (de app staat nu open voor iPad). 1–10 per formaat.
- **Google:** telefoon 16:9 of 9:16, kant 320–3840 px, minimaal 2 (max 8); tablet 7"/10" optioneel; **feature graphic 1024×500** verplicht; app-icoon 512×512.

## Voorstel: 7 schermen (NL, met bijschrift)
1. **Bibliotheek** — "Honderden activiteiten voor bewegingsonderwijs"
2. **Activiteit met 3D-plattegrond** — "Zie precies hoe je zaal eruitziet"
3. **3D-editor** — "Richt je gymzaal in met slepen en tikken"
4. **Veld afzetten** — "Pionnen en lijnen in een paar tikken"
5. **Lesplanning** — "Plan je lessen per klas"
6. **Delen/exporteren** — "Deel als afbeelding of PDF"
7. **Abonnement** — "7 dagen gratis proberen" (alleen tonen als de store dat daadwerkelijk aanbiedt; gebruik een sandbox-account)

## Maken
- **Zonder inloggen te maken** (kan met Playwright): de testpagina's `/e2e/...` en publieke editor (`/gratis-gymzaal-plattegrond-maken`) met de mobiele projecten uit `playwright.config.ts` (iPhone 14 e.d.). Daarmee krijg je geen exacte store-formaten.
- **Voor de winkel** gebruik je de **iOS-simulator** (iPhone 16/17 Pro Max → ⌘S) en de **Android-emulator** (Pixel 9) met een testaccount en testdata; daar is het echte formaat al juist.
- Voeg bijschriften toe in Canva/Figma; gebruik de oranje merkstijl en lettertypes van de app. Maak geen schermafbeeldingen van productiedata van echte gebruikers.
