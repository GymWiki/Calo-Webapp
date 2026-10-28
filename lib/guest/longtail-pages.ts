import type { GuestExampleId } from "@/lib/guest/examples";

export type LongtailPage = {
  slug: string;
  linkTitel: string;
  samenvatting: string;
  title: string;
  description: string;
  h1: string;
  voorbeeld: GuestExampleId;
  intro: string;
  secties: { h2: string; tekst: string[] }[];
  tips: string[];
  faq: { question: string; answer: string }[];
};

/** Vier long-tail pagina's: elk met eigen, inhoudelijke tekst en een eigen voorbeeldplattegrond (geen doorgeschoven kopie van de hoofdpagina). */
export const LONGTAIL_PAGES: LongtailPage[] = [
  {
    slug: "gymzaal-indeling-maken",
    linkTitel: "Gymzaal indeling maken",
    samenvatting: "Deel de zaal logisch in voor een les met meerdere stations.",
    title: "Gymzaal indeling maken in 3D, gratis | GymWiki",
    description: "Maak een gymzaal indeling in 3D: verdeel de zaal in vakken, plaats toestellen en bekijk de looproutes. Gratis en zonder account.",
    h1: "Gymzaal indeling maken",
    voorbeeld: "circuit",
    intro:
      "Een goede gymzaal indeling bepaalt hoe rustig en veilig een les verloopt. In de editor van GymWiki zie je direct of vier stations naast elkaar passen, of er genoeg ruimte tussen de toestellen blijft en waar leerlingen doorheen lopen.",
    secties: [
      {
        h2: "Begin met de zaal en de indeling",
        tekst: [
          "Kies de standaardzaal, of een indeling met 2 × 2 of 4 × 1 vakken als jouw zaal in delen kan worden gesplitst. De afmetingen kloppen met de werkelijkheid, zodat je materiaal niet per ongeluk buiten het veld plaatst.",
          "Zet eerst de grote toestellen op hun plek, dan matten en banken, en tot slot het kleine materiaal. Zo houd je overzicht en blijft er genoeg loopruimte.",
        ],
      },
      {
        h2: "Houd valruimte en looproutes vrij",
        tekst: [
          "Laat rond een springtoestel minstens twee meter vrij, en plaats matten altijd aansluitend aan de landingskant. Draai de plattegrond in de 3D-weergave om te controleren of leerlingen elkaar niet kruisen.",
        ],
      },
    ],
    tips: ["Werk van groot naar klein: toestellen, matten, dan klein materiaal.", "Bekijk je ontwerp ook van boven om looproutes te controleren.", "Exporteer een PDF met materiaallijst voor de conciërge."],
    faq: [
      { question: "Hoeveel stations passen in één gymzaal?", answer: "Dat hangt van het toestel af. In een standaard gymzaal passen meestal vier tot zes stations als je tussen de stations minstens twee meter vrij laat. Met de editor zie je direct of het past." },
      { question: "Kan ik de zaal in vakken verdelen?", answer: "Ja. Kies een zaalindeling met meerdere vakken en leg met pionnen of lijnen de grenzen van elk vak vast." },
    ],
  },
  {
    slug: "opstelling-bewegingsonderwijs-tekenen",
    linkTitel: "Opstelling bewegingsonderwijs tekenen",
    samenvatting: "Teken een toestelopstelling met matten, banken en een springplank.",
    title: "Opstelling bewegingsonderwijs tekenen in 3D | GymWiki",
    description: "Teken een opstelling voor bewegingsonderwijs in 3D: toestellen, matten en banken op schaal. Gratis, zonder account, met PDF-export.",
    h1: "Opstelling bewegingsonderwijs tekenen",
    voorbeeld: "opstelling-turnen",
    intro:
      "Een toestelopstelling uitleggen aan collega’s of aan studenten gaat sneller met een plaatje. Met de 3D-editor teken je een opstelling in een paar minuten, op schaal, en deel je hem als afbeelding, PDF of link.",
    secties: [
      {
        h2: "Een opstelling stap voor stap",
        tekst: [
          "Sleep een mat naar de zaal, zet een bank of kast eraan vast en draai het geheel in de gewenste hoek. Items kantelen ook: een bank schuin tegen een kast maakt een glijbaan, een mat rechtop een klimwand.",
          "Items snappen op een instelbaar raster, zodat toestellen netjes uitgelijnd staan zonder dat je met de hand hoeft te passen.",
        ],
      },
      {
        h2: "Gebruik de opstelling in je lesplan",
        tekst: ["Exporteer een PNG voor in je lesplan of een PDF met de materiaallijst, zodat je collega weet wat er vooraf klaar moet staan."],
      },
    ],
    tips: ["Gebruik de snelle standen (plat, rechtop, schuin) om items te kantelen.", "Vergrendel items die niet mogen verschuiven.", "Maak een kopie van de opstelling voor een tweede groep."],
    faq: [
      { question: "Kan ik een bank schuin tegen een kast zetten?", answer: "Ja. Kantel de bank met het rotatiepaneel of met de snelle stand ‘schuin’ en plaats hem tegen de kast." },
      { question: "Kan ik de opstelling printen?", answer: "Ja. Exporteer een PDF met afbeelding en materiaallijst en print die, of sla hem op in je lesplan." },
    ],
  },
  {
    slug: "veld-afzetten-met-pionnen",
    linkTitel: "Veld afzetten met pionnen",
    samenvatting: "Bereken en teken een speelveld met gelijkmatig verdeelde pionnen.",
    title: "Veld afzetten met pionnen: plattegrond in 3D | GymWiki",
    description: "Zet een veld af met pionnen en zie hoeveel pionnen je nodig hebt. Kies afmetingen en afstand; gratis en zonder account.",
    h1: "Veld afzetten met pionnen",
    voorbeeld: "veld-afzetten",
    intro:
      "Een veld afzetten kost tijd en meestal weet je pas achteraf hoeveel pionnen je nodig had. In de editor kies je de afmetingen en de afstand tussen de pionnen; de pionnen worden automatisch verdeeld en geteld.",
    secties: [
      {
        h2: "Afmetingen en afstand",
        tekst: [
          "Een veld van 12 × 20 meter met een pion om de drie meter vraagt meer pionnen dan een veld van 9 × 18 meter met een interval van vier meter. De editor rekent het uit en toont het aantal in de materiaallijst.",
          "Met de verdeling ‘even’ staan de pionnen gelijkmatig verdeeld langs elke zijde; met ‘exact’ houd je de ingestelde afstand aan en blijft er aan het einde van een zijde een kortere tussenruimte over.",
        ],
      },
      {
        h2: "Hoekpionnen in een andere kleur",
        tekst: ["Geef de hoeken een andere kleur zodat leerlingen de grenzen van het veld meteen herkennen."],
      },
    ],
    tips: ["Gebruik een andere kleur voor de hoekpionnen.", "Controleer het aantal pionnen in de materiaallijst voordat je ze pakt.", "Draai het veld in een hoek als je de zaal diagonaal wilt benutten."],
    faq: [
      { question: "Hoeveel pionnen heb ik nodig voor een veld?", answer: "Voor een veld van 12 × 20 meter met een pion om de drie meter heb je ongeveer 22 pionnen nodig. De editor telt het automatisch voor elke afmeting." },
      { question: "Kan ik twee velden naast elkaar zetten?", answer: "Ja. Je kunt meerdere velden plaatsen, ze draaien en elk een eigen kleur geven." },
    ],
  },
  {
    slug: "volleybalveld-indeling-gymzaal",
    linkTitel: "Volleybalveld indeling gymzaal",
    samenvatting: "Plan een volleybalveld met net, afstand en wisselzones.",
    title: "Volleybalveld indeling in de gymzaal in 3D | GymWiki",
    description: "Plan een volleybalveld in de gymzaal: net, veldmaten en wisselzones in 3D. Gratis plattegrond maken zonder account.",
    h1: "Volleybalveld indeling in de gymzaal",
    voorbeeld: "volleybal",
    intro:
      "Een volleybalveld is 9 × 18 meter, maar in een gymzaal moet je rekening houden met muren, toestellen en een tweede veld. Plan het veld in 3D en zie of er genoeg vrije ruimte rondom overblijft.",
    secties: [
      {
        h2: "Veldmaten en vrije zone",
        tekst: [
          "Rond een volleybalveld is een vrije zone van minstens twee meter nodig voor uitlopen en terugslaan. In veel gymzalen betekent dat dat één veld breed past en twee velden kort naast elkaar.",
          "Zet het net op de middellijn en controleer in de 3D-weergave de hoogte tegenover het plafond en de lampen.",
        ],
      },
      {
        h2: "Meerdere velden en wisselzones",
        tekst: ["Verdeel de zaal in twee verkleinde velden voor 3 tegen 3 en geef elk team een eigen wisselzone met pionnen."],
      },
    ],
    tips: ["Laat minstens twee meter vrije zone rondom het veld.", "Gebruik pionnen voor verkleinde velden bij jongere groepen.", "Controleer de nethoogte in de zijaanzicht-camera."],
    faq: [
      { question: "Welke afmetingen heeft een volleybalveld?", answer: "Een volleybalveld is 9 bij 18 meter. In het voorbeeld hierboven staat een veld van precies die afmetingen." },
      { question: "Past een volleybalveld in elke gymzaal?", answer: "Meestal wel, maar niet altijd met de aanbevolen vrije zone. In de editor zie je direct of het veld past." },
    ],
  },
];

export function getLongtailPage(slug: string): LongtailPage | undefined {
  return LONGTAIL_PAGES.find((page) => page.slug === slug);
}
