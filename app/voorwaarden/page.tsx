import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/public/LegalPage";
import { SUBSCRIPTION_PLANS } from "@/lib/constants/subscriptionPlans";

export const metadata: Metadata = {
  title: "Gebruiksvoorwaarden — GymWiki",
  description: "Gebruiksvoorwaarden en abonnementsvoorwaarden van GymWiki.",
  alternates: { canonical: "https://www.gymwiki.nl/voorwaarden" },
};

export default function VoorwaardenPage() {
  return (
    <LegalPage title="Gebruiksvoorwaarden" updated="1 november 2026">
      <h2>Gebruik van GymWiki</h2>
      <p>
        GymWiki is een bibliotheek met bewegingsactiviteiten en een editor voor gymzaalopstellingen. Je bent zelf
        verantwoordelijk voor de inhoud die je deelt en je mag alleen delen wat je zelf mag publiceren. Bij misbruik
        kunnen we een account beperken of verwijderen.
      </p>

      <h2>Abonnement</h2>
      <ul>
        <li>Gratis gebruik is mogelijk door maandelijks activiteiten bij te dragen; een abonnement geeft altijd volledige toegang.</li>
        <li>Abonnementen: {SUBSCRIPTION_PLANS.monthly.label.toLowerCase()} en {SUBSCRIPTION_PLANS.yearly.label.toLowerCase()}. De actuele prijs zie je vóór aankoop in de App Store, Google Play of op de website.</li>
        <li>Nieuwe abonnees kunnen 7 dagen gratis proberen. Daarna start het betaalde abonnement automatisch, tenzij je minstens 24 uur vóór het einde van de proefperiode opzegt.</li>
        <li>Een abonnement verlengt automatisch voor dezelfde periode, tot je opzegt. Opzeggen kan op elk moment; je houdt toegang tot het einde van de betaalde periode.</li>
        <li>Afgesloten via de App Store of Google Play? Beheren en opzeggen doe je daar (Instellingen → Abonnementen). Afgesloten op de website? Via het facturatieportaal bij Profiel.</li>
        <li>Aankopen in de app lopen via Apple of Google; voor terugbetalingen gelden hun regels.</li>
      </ul>

      <h2>Aansprakelijkheid</h2>
      <p>
        Activiteiten zijn bedoeld als didactische inspiratie. Beoordeel zelf of een activiteit veilig past bij je groep
        en zaal. GymWiki is niet aansprakelijk voor schade door gebruik van de inhoud, behalve bij opzet of grove
        schuld.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:info@gymwiki.nl">info@gymwiki.nl</a> · <Link href="/privacy">Privacyverklaring</Link>
      </p>
    </LegalPage>
  );
}
