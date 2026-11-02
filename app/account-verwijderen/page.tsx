import type { Metadata } from "next";

import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "Account verwijderen — GymWiki",
  description: "Zo verwijder je je GymWiki-account en je gegevens, in de app of op de website.",
  alternates: { canonical: "https://www.gymwiki.nl/account-verwijderen" },
};

export default function AccountVerwijderenPage() {
  return (
    <LegalPage title="Account verwijderen" updated="1 november 2026">
      <p>Je kunt je GymWiki-account op elk moment zelf verwijderen, in de app en op de website:</p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>Log in en open <strong>Profiel → Instellingen</strong>.</li>
        <li>Kies <strong>Account verwijderen</strong>, typ VERWIJDEREN en bevestig.</li>
      </ol>
      <h2>Wat wordt verwijderd?</h2>
      <ul>
        <li>Je account, profiel, planning, favorieten, plattegronden en geüploade bestanden.</li>
        <li>Activiteiten die je met de bibliotheek hebt gedeeld en die zijn goedgekeurd blijven anoniem beschikbaar; concepten en afgewezen activiteiten worden verwijderd.</li>
        <li>Factuurgegevens bewaren we zo lang de wet dat vereist (7 jaar), bij onze betalingsverwerker.</li>
      </ul>
      <h2>Abonnement</h2>
      <ul>
        <li>Betaal je via de website? Dan zeggen wij je abonnement bij het verwijderen op.</li>
        <li>Betaal je via de App Store of Google Play? Zeg dat dan eerst zelf op in de store (App Store: Instellingen → je naam → Abonnementen; Google Play: Betalingen en abonnementen → Abonnementen). Wij kunnen een store-abonnement niet voor je opzeggen.</li>
      </ul>
      <p>
        Lukt het niet, bijvoorbeeld omdat je niet meer kunt inloggen? Mail vanaf het e-mailadres van je account naar{" "}
        <a href="mailto:info@gymwiki.nl">info@gymwiki.nl</a>; we verwijderen je account dan handmatig.
      </p>
    </LegalPage>
  );
}
