import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "Privacyverklaring — GymWiki",
  description: "Welke gegevens GymWiki verwerkt in de website en de iOS- en Android-app, waarom, hoe lang en met wie.",
  alternates: { canonical: "https://www.gymwiki.nl/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacyverklaring" updated="1 november 2026">
      <p>
        Deze verklaring geldt voor de website www.gymwiki.nl en de GymWiki-app voor iOS en Android. Vragen of verzoeken
        over je gegevens? Mail naar <a href="mailto:info@gymwiki.nl">info@gymwiki.nl</a>.
      </p>

      <h2>Welke gegevens verwerken we?</h2>
      <ul>
        <li><strong>Account:</strong> voor- en achternaam, e-mailadres en wachtwoord (versleuteld opgeslagen), optionele profielgegevens zoals rol, vakantieregio en beschikbaarheid voor stage.</li>
        <li><strong>Inhoud die je zelf maakt:</strong> activiteiten, lesplanningen, plattegronden, foto&apos;s en bestanden die je uploadt, favorieten en opgeslagen items.</li>
        <li><strong>Abonnement:</strong> welk abonnement je hebt, de status en de einddatum, en of je de proefperiode hebt gebruikt. Betaalgegevens (kaart, bank) ontvangen wij nooit: die verwerkt Stripe (website) of Apple/Google (app).</li>
        <li><strong>Gebruik en techniek:</strong> technische logbestanden (zoals IP-adres en tijdstip) voor beveiliging en foutopsporing. We gebruiken geen advertentie- of trackingcookies en geen analytics van derden.</li>
        <li><strong>Cookies:</strong> alleen functionele cookies voor het inloggen en je sessie, en voorkeuren zoals donkere modus.</li>
        <li><strong>App:</strong> de app gebruikt de camera of fotobibliotheek alleen als jij een foto kiest, en bestanden om te delen of te exporteren. Pushmeldingen sturen we alleen met jouw toestemming.</li>
      </ul>

      <h2>Waarom en op welke grondslag?</h2>
      <ul>
        <li>Het account en de dienst leveren, inclusief je abonnement (uitvoering van de overeenkomst).</li>
        <li>Beveiliging, misbruik voorkomen en de dienst verbeteren (gerechtvaardigd belang).</li>
        <li>Meldingen en optionele functies (toestemming, altijd intrekbaar).</li>
        <li>Wettelijke verplichtingen, zoals de fiscale bewaarplicht voor facturen.</li>
      </ul>

      <h2>Met wie delen we gegevens?</h2>
      <p>Alleen met verwerkers die we nodig hebben om GymWiki te laten werken, op basis van verwerkersovereenkomsten:</p>
      <ul>
        <li><strong>Supabase</strong> — database, inloggen en opslag van bestanden.</li>
        <li><strong>Vercel</strong> — hosting van de website en app-inhoud.</li>
        <li><strong>Stripe</strong> — betalingen op de website.</li>
        <li><strong>RevenueCat</strong> — beheer van abonnementen die je via de App Store of Google Play afsluit (ontvangt een anoniem gebruikers-ID, niet je naam of e-mailadres).</li>
        <li><strong>Apple en Google</strong> — verwerken betalingen voor aankopen in de app.</li>
        <li><strong>OpenAI</strong> — alleen als je zelf een AI-functie gebruikt (zoals de Lescoach of het importeren van een activiteit); de ingevoerde tekst wordt daarvoor verstuurd.</li>
      </ul>
      <p>We verkopen je gegevens niet en gebruiken ze niet voor advertenties.</p>

      <h2>Hoe lang bewaren we gegevens?</h2>
      <ul>
        <li>Accountgegevens en je inhoud: zolang je account bestaat. Na verwijderen worden ze definitief gewist.</li>
        <li>Activiteiten die je met de bibliotheek hebt gedeeld en die zijn goedgekeurd blijven na verwijderen anoniem beschikbaar.</li>
        <li>Factuurgegevens: 7 jaar (wettelijke bewaarplicht), bij onze betalingsverwerker.</li>
        <li>Technische logbestanden: maximaal 30 dagen.</li>
      </ul>

      <h2>Je rechten</h2>
      <p>
        Je kunt je gegevens inzien, laten corrigeren, laten wissen, overdragen of bezwaar maken tegen verwerking via{" "}
        <a href="mailto:info@gymwiki.nl">info@gymwiki.nl</a>. Je account verwijderen kan zelf, direct in de app en op de
        website via <strong>Profiel → Instellingen → Account verwijderen</strong>; zie ook{" "}
        <Link href="/account-verwijderen">uitleg over account verwijderen</Link>. Je kunt een klacht indienen bij de
        Autoriteit Persoonsgegevens.
      </p>

      <h2>Wijzigingen</h2>
      <p>Bij belangrijke wijzigingen passen we deze verklaring aan en melden we dat in de app of per e-mail.</p>
    </LegalPage>
  );
}
