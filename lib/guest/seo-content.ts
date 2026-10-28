import { GUEST_TOOL_PATH, SITE_URL } from "@/lib/guest/constants";

export const TOOL_URL = `${SITE_URL}${GUEST_TOOL_PATH}`;
export const TOOL_TITLE = "Gratis gymzaal plattegrond maken in 3D | GymWiki";
export const TOOL_DESCRIPTION =
  "Maak gratis een gymzaal plattegrond in 3D, zonder account. Zet toestellen, matten en pionnen neer, exporteer als PNG of PDF en deel met een link.";
export const TOOL_H1 = "Gratis gymzaal plattegrond maken in 3D";

export const TOOL_STEPS = [
  { titel: "Kies je ruimte", tekst: "Begin met een gymzaal, sportveld, atletiekbaan of zwembad en kies de indeling die bij jouw locatie past." },
  { titel: "Sleep materiaal erin", tekst: "Zet toestellen, matten, ballen, doelen en pionnen neer vanuit de bibliotheek. Draai en kantel items in elke richting." },
  { titel: "Exporteer of deel", tekst: "Download je ontwerp als PNG of PDF met materiaallijst, of stuur een link naar een collega. Alles blijft op jouw apparaat." },
] as const;

export const TOOL_AUDIENCE = [
  "Vakleerkrachten bewegingsonderwijs die hun opstelling vooraf willen zien en delen met de conciërge of collega’s.",
  "Pabo- en CALO-studenten die een lesplan met overzichtelijke opstelling moeten inleveren.",
  "Sportverenigingen, trainers en zwemlesgevers die een veld of zaal willen indelen.",
] as const;

export const TOOL_FAQ = [
  { question: "Is de 3D-plattegrondeditor echt gratis?", answer: "Ja. Je kunt de editor volledig gratis gebruiken, zonder account en zonder creditcard. Een account is alleen nodig als je plattegronden in de cloud wilt bewaren, aan een activiteit wilt koppelen of met je team wilt delen." },
  { question: "Heb ik een account nodig om te beginnen?", answer: "Nee. Je opent de pagina, klikt op ‘Start de editor’ en kunt direct bouwen. Pas als je je plattegrond voor altijd veilig in de cloud wilt hebben, maak je een gratis GymWiki-account aan." },
  { question: "Waar worden mijn plattegronden bewaard?", answer: "In gastmodus bewaart de editor automatisch een kladversie in je eigen browser (localStorage). Er wordt niets naar onze servers gestuurd. Wis je browsergegevens of gebruik je een ander apparaat, dan is die kladversie weg; exporteer of deel je ontwerp dus als het belangrijk is." },
  { question: "Wat gebeurt er met mijn ontwerp als ik later een account maak?", answer: "De kladversie in je browser blijft bestaan. Na het inloggen of registreren bieden we aan om die plattegrond te herstellen en in je account op te slaan." },
  { question: "Kan ik mijn plattegrond exporteren als afbeelding of PDF?", answer: "Ja. Je kunt een PNG in 3D-weergave of een bovenaanzicht downloaden, en een PDF met de afbeelding en een materiaallijst. Gratis exports bevatten een klein label ‘Gemaakt met GymWiki’." },
  { question: "Hoe deel ik een plattegrond zonder account?", answer: "Kies ‘Deellink kopiëren’. De plattegrond wordt dan gecomprimeerd in de link zelf opgeslagen, dus de ontvanger kan hem direct openen zonder dat er iets op een server staat. Bij heel grote plattegronden is de link te lang; exporteer dan een PDF of PNG." },
  { question: "Werkt de editor op een telefoon of tablet?", answer: "Ja. Op telefoon en tablet is de bediening aangepast: tik om een item te plaatsen, sleep om te verplaatsen en gebruik de onderbalk voor draaien, kopiëren en verwijderen. Op een computer werk je met muis en sneltoetsen." },
  { question: "Kan ik items draaien en kantelen?", answer: "Ja. Items draaien om de verticale as en kantelen voor/achter en zijwaarts, bijvoorbeeld een bank schuin tegen een kast of een mat rechtop. Met slimme standen zet je een item met één tik plat, rechtop of op kop." },
  { question: "Welk materiaal zit er in de bibliotheek?", answer: "Honderden 3D-modellen van gymtoestellen, matten, ballen, doelen, netten, pionnen en klein materiaal. Je kunt ook een veld afzetten met pionnen: kies de afmetingen en de afstand en de pionnen worden automatisch verdeeld." },
  { question: "Is de tool geschikt voor andere ruimtes dan een gymzaal?", answer: "Ja. Naast de gymzaal (in meerdere indelingen) kun je een sportveld, atletiekbaan of zwembad kiezen. Zo ontwerp je ook een buitenles of zwemles." },
] as const;

/** JSON-LD: SoftwareApplication + FAQPage + BreadcrumbList; antwoorden zijn letterlijk TOOL_FAQ. */
export function buildToolStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${TOOL_URL}#app`,
        name: "GymWiki 3D-plattegrondeditor",
        url: TOOL_URL,
        description: TOOL_DESCRIPTION,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web (alle moderne browsers)",
        inLanguage: "nl-NL",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        publisher: { "@type": "Organization", name: "GymWiki", url: SITE_URL },
        featureList: ["3D-plattegrond maken zonder account", "Export als PNG en PDF", "Deellink zonder account", "Veld afzetten met pionnen"],
      },
      {
        "@type": "FAQPage",
        mainEntity: TOOL_FAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "GymWiki", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Gratis 3D-plattegrond maken", item: TOOL_URL },
        ],
      },
    ],
  };
}
