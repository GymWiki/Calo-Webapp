# Privacy-labels (Apple) en Data safety (Google)

Gebaseerd op wat de code werkelijk doet (peildatum 2026-11-01). Onzekerheden staan onderaan; controleer die vóór indienen.

## Gegevens die de app/dienst verwerkt

| Gegeven | Waarvoor | Gekoppeld aan identiteit | Gedeeld met derden |
|---|---|---|---|
| E-mailadres | account, inloggen, support | Ja | Supabase (verwerker) |
| Naam (voor-/achternaam) | profiel, weergave bij bijdragen | Ja | Supabase |
| User ID (Supabase id, RevenueCat app user id) | account, abonnement | Ja | Supabase, RevenueCat |
| Aankoopgeschiedenis/abonnementsstatus | toegang tot betaalde functies | Ja | RevenueCat, Apple/Google |
| Foto's/bestanden die de gebruiker uploadt | inhoud van activiteiten/plattegronden | Ja | Supabase (opslag) |
| Overige gebruikersinhoud (activiteiten, planning, plattegronden) | kernfunctie | Ja | Supabase; gedeelde activiteiten zijn zichtbaar voor andere gebruikers |
| Invoer voor AI-functies (alleen op verzoek) | Lescoach/import | Nee (niet opgeslagen door ons voor training) | OpenAI (verwerker) |
| IP-adres/technische logs | beveiliging, foutopsporing | Nee/kort bewaard | Vercel, Supabase (verwerkers) |

Niet verzameld: locatie, contacten, microfoon, advertentie-ID, gezondheidsgegevens, financiële gegevens (die gaan rechtstreeks naar Apple/Google/Stripe), browsegeschiedenis. **Geen tracking**, geen advertenties, geen analytics-SDK's van derden.

## Apple: App Privacy ("nutrition label")

- *Data Used to Track You*: **Geen**.
- *Data Linked to You* (doel: App Functionality): **Contact Info → Email Address, Name**; **Identifiers → User ID**; **Purchases → Purchase History**; **User Content → Photos or Videos, Other User Content**.
- *Data Not Linked to You*: Diagnostics is **niet** verzameld door ons (geen crash-SDK); laat leeg.
- Privacy-manifest in de app: `ios/App/App/PrivacyInfo.xcprivacy` (tracking uit, bovenstaande typen, UserDefaults-reden CA92.1 voor de Preferences-plugin).
- Required-reason API's: de app zelf gebruikt alleen UserDefaults (via `@capacitor/preferences`). De Capacitor-/RevenueCat-pakketten leveren eigen privacy-manifests mee; controleer na de eerste archive in Xcode (*Product → Archive → Generate Privacy Report*).
- Export compliance: `ITSAppUsesNonExemptEncryption = false` is gezet (alleen standaard HTTPS). Bevestig dat in App Store Connect bij het eerste build.

## Google Play: Data safety

- *Does your app collect or share any of the required user data types?* **Ja.**
- *Data collected* (alle: *required*, doel *App functionality / Account management*, **niet** voor advertenties): **Personal info → Name, Email address, User IDs**; **Financial info → Purchase history** (via Google Play/RevenueCat; kaartgegevens niet); **Photos and videos → Photos**; **App activity → Other user-generated content**.
- *Data shared* met derden: **Nee** voor verwerkers die namens ons handelen (Supabase, Vercel, RevenueCat, OpenAI vallen onder "service provider"-uitzondering); kies *shared* alleen als je jurist anders oordeelt.
- *Is all data encrypted in transit?* **Ja** (HTTPS).
- *Can users request that data be deleted?* **Ja**: in de app (Profiel → Instellingen → Account verwijderen) en via web-URL **https://www.gymwiki.nl/account-verwijderen**. Vul die URL in bij *Data deletion* in Play Console.
- *Families/Kinderen*: niet van toepassing.

## Onzekerheden (controleer)
1. **Vercel/Supabase logs**: bewaartermijn "max 30 dagen" in de privacyverklaring is een aanname; stel de werkelijke log-retentie vast en pas de tekst aan.
2. **OpenAI**: controleer of het verwerkersakkoord/zero-retention is geregeld en pas de tekst aan indien anders.
3. **Betalen via de website** (Stripe) valt buiten de app-labels, maar staat wel in de privacyverklaring.
4. **Gebruikersinhoud openbaar**: goedgekeurde activiteiten zijn voor andere gebruikers zichtbaar; zet dit eventueel expliciet in de privacy-labels onder "User Content".
5. De privacyverklaring noemt geen verwerkingsverantwoordelijke met KvK-nummer/adres; **vul die gegevens in** voordat je indient (juridisch verplicht).
