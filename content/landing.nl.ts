// Alle teksten van de landingspagina (app/page.tsx) op één plek. Pas hier teksten aan; de opmaak staat in components/landing/*.
// Alleen wat aantoonbaar bestaat: cijfers komen live uit de database (zie lib/services/landing.ts), prijzen uit
// lib/constants/subscriptionPlans.ts. Open punten voor de eigenaar staan als `TODO(eigenaar)`.

import { GUEST_TOOL_PATH } from "@/lib/guest/constants";
import {
  FREE_PLAN_INFO,
  MONTHLY_CONTRIBUTION_REQUIRED_COUNT,
  SUBSCRIPTION_PLANS,
  TEAM_PLANS,
  TEAM_PLAN_ORDER,
} from "@/lib/constants/subscriptionPlans";

export const SITE_URL = "https://www.gymwiki.nl";

export const meta = {
  // ~59 tekens
  title: "GymWiki — activiteiten en lesideeën voor bewegingsonderwijs",
  description:
    "Vind, maak en deel activiteiten voor je gymles. Bibliotheek met lesideeën voor bewegingsonderwijs, een gratis 3D-plattegrondeditor en planning voor docenten LO.",
};

export const links = {
  register: "/register",
  login: "/login",
  library: "/activiteiten",
  editor: GUEST_TOOL_PATH,
  aboutPage: "/over-gymwiki",
};

export const nav = {
  items: [
    { label: "Hoe het werkt", href: "#hoe-het-werkt" },
    { label: "3D-editor", href: "#editor" },
    { label: "Prijzen", href: "#prijzen" },
    { label: "Veelgestelde vragen", href: "#veelgestelde-vragen" },
  ],
  login: "Inloggen",
  cta: "Gratis beginnen",
};

export const hero = {
  eyebrow: "Voor docenten bewegingsonderwijs",
  title: "Alle activiteiten voor je gymles op één plek",
  subtitle:
    "GymWiki is een bibliotheek met lesideeën voor bewegingsonderwijs, gedeeld en gecontroleerd door vakleerkrachten. Zoek een activiteit, pas hem aan of maak een eigen, en bereid je les in een paar minuten voor.",
  primaryCta: "Gratis beginnen",
  secondaryCta: "Bekijk de bibliotheek",
  note: `Gratis zolang je ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten per maand deelt, of vanaf ${SUBSCRIPTION_PLANS.monthly.priceLabel} per maand.`,
  showcaseLabel: "Een greep uit de bibliotheek",
  threeDBadge: "3D-plattegrond",
};

export const problems = {
  eyebrow: "Waarom GymWiki",
  title: "Een goede les voorbereiden kost te veel tijd",
  items: [
    {
      title: "Je zoekt je suf",
      text: "Een passend spel of een oefenvorm voor groep 5/6 vinden betekent door oude mappen, websites en groepsapps bladeren.",
    },
    {
      title: "Alles staat verspreid",
      text: "Het idee staat in een document, de opstelling op een schets en het materiaal in je hoofd. Bij de volgende les begin je weer opnieuw.",
    },
    {
      title: "Delen blijft lastig",
      text: "Een les doorgeven aan een collega of invaller gaat met losse foto's en berichtjes, en niemand weet welke versie de goede is.",
    },
  ],
  solution: "GymWiki brengt het samen: één doorzoekbare bibliotheek, een vaste opbouw per activiteit en een link om te delen.",
};

export const howItWorks = {
  id: "hoe-het-werkt",
  eyebrow: "Zo werkt het",
  title: "In drie stappen van idee naar les",
  steps: [
    {
      title: "Vind een activiteit",
      text: "Zoek op trefwoord en filter op categorie, leerlijn, groep of weinig materiaal. Elke activiteit laat doel, beginsituatie en leeruitkomsten zien.",
    },
    {
      title: "Pas aan of maak er zelf een",
      text: "Gebruik een activiteit als startpunt of bouw je eigen activiteit stap voor stap op. Een concept bewaar je en werk je later af.",
    },
    {
      title: "Deel hem of gebruik hem in je les",
      text: "Deel een activiteit met een link, download hem als PDF of zet hem in je planning. Eigen activiteiten kun je met de bibliotheek delen.",
    },
  ],
};

export const features = {
  eyebrow: "Wat je kunt",
  title: "Alles voor je lesvoorbereiding op één plek",
  // Het eerste blok krijgt het live aantal activiteiten (zie components/landing/FeatureBlocks.tsx).
  items: [
    {
      key: "bibliotheek",
      title: "Activiteitenbibliotheek met filters",
      text: "Doorzoek de bibliotheek op categorie, leerlijn, groep en materiaal. Bewaar wat je wilt terugvinden.",
      linkLabel: "Bekijk de bibliotheek",
      href: links.library,
    },
    {
      key: "maken",
      title: "Activiteit maken",
      text: "Een wizard leidt je door doel, beginsituatie, opzet en materiaal. Werk eerst als concept en rond later af.",
    },
    {
      key: "plattegrond",
      title: "3D-plattegrond bij je activiteit",
      text: "Teken de opstelling in 3D en koppel hem aan je activiteit. Je kunt de editor ook los gebruiken.",
      linkLabel: "Probeer de editor",
      href: links.editor,
    },
    {
      key: "kennisbank",
      title: "Kennisbank en AI-hulp",
      text: "Vakliteratuur waar de AI Activiteitenchecker en de AI Lescoach op leunen. Voeg ook je eigen documenten toe.",
    },
    {
      key: "plannen",
      title: "Plannen, delen en samenwerken",
      text: "Zet lessen in je weekrooster per klas, deel met een link en werk met collega's in een team.",
    },
  ],
};

export const editor = {
  id: "editor",
  eyebrow: "Uitgelicht: 3D-plattegrond",
  title: "Maak een opstelling in 3D",
  intro:
    "Zie vooraf hoe je zaal eruitziet: sleep toestellen, matten en pionnen op hun plek en bekijk het van alle kanten. Gratis te proberen, zonder account.",
  points: [
    "Veld afzetten met pionnen: kies de afmetingen en de pionnen worden verdeeld en geteld",
    "Materialen uit de bibliotheek, in gymzaal, sportveld, atletiekbaan of zwembad",
    "Items draaien en kantelen, bijvoorbeeld een bank schuin tegen een kast",
    "Werkt op telefoon, tablet en computer",
    "Exporteer als PNG of PDF met materiaallijst, of deel met een link",
  ],
  cta: "Probeer de editor gratis",
  caption: "Schets van de editor: een opstelling die zich opbouwt.",
};

export const audiences = {
  eyebrow: "Voor wie",
  title: "Gemaakt voor iedereen die bewegingsonderwijs geeft",
  // TODO(eigenaar): voortgezet onderwijs, verenigingen en buitenschoolse opvang staan hier bewust niet: de data kent alleen de
  // groepen 1/2 t/m 7/8 plus "Onderbouw"/"Bovenbouw". Voeg ze toe als je ze echt bedient.
  items: [
    { title: "Vakleerkrachten bewegingsonderwijs", text: "Bouw een eigen bibliotheek op en deel die met collega's." },
    { title: "Groepsleerkrachten basisonderwijs", text: "Filter op groep 1/2 tot en met 7/8 en vind meteen iets wat past." },
    { title: "CALO-, ALO- en PABO-studenten", text: "Bereid lessen voor met een vaste opbouw van doel, beginsituatie en leeruitkomsten." },
    { title: "Teams en scholen", text: "Eén beheerder nodigt collega's uit; samen gebruik je dezelfde teambibliotheek." },
  ],
};

export const libraryPreview = {
  id: "bibliotheek",
  eyebrow: "Uit de bibliotheek",
  title: "Een greep uit de activiteiten",
  // {count} wordt het live aantal publieke activiteiten.
  linkLabel: (count: number | null) => (count ? `Bekijk alle ${count} activiteiten` : "Bekijk alle activiteiten"),
  empty: "De voorbeelden laden even niet. Je vindt alle activiteiten in de bibliotheek.",
};

export const pricing = {
  id: "prijzen",
  eyebrow: "Gratis en betaald",
  title: "Begin gratis, kies later wat past",
  intro: `Je kunt de 3D-editor en de openbare activiteitenpagina's gebruiken zonder account. Met een account krijg je de volledige bibliotheek: gratis zolang je ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten per maand deelt die onze AI-kwaliteitscontrole doorstaan, of met een abonnement als je liever niet bijdraagt.`,
  plans: [
    { info: FREE_PLAN_INFO, href: links.register, cta: "Gratis beginnen" },
    { info: SUBSCRIPTION_PLANS.monthly, href: `${links.register}?plan=monthly`, cta: "Kies maandelijks" },
    { info: SUBSCRIPTION_PLANS.yearly, href: `${links.register}?plan=yearly`, cta: "Kies jaarlijks" },
    { info: SUBSCRIPTION_PLANS.lifetime, href: `${links.register}?plan=lifetime`, cta: "Kies lifetime" },
  ],
  team: `Voor scholen en teams zijn er jaarpakketten op factuur: ${TEAM_PLAN_ORDER.map((id) => `${TEAM_PLANS[id].label} ${TEAM_PLANS[id].priceLabel} (tot ${TEAM_PLANS[id].seatLimit} leden)`).join(", ")}.`,
};

export const proof = {
  eyebrow: "In cijfers",
  title: "Wat er nu in GymWiki staat",
  // Waarden komen live uit de database; een cijfer dat niet geladen kon worden verdwijnt uit de rij.
  labels: {
    activities: "publieke activiteiten",
    leerlijnen: "leerlijnen",
    materials: "3D-modellen voor je plattegrond",
  },
  note: "Cijfers worden elk uur bijgewerkt.",
  // TODO(eigenaar): voeg echte testimonials toe (met toestemming), bijv. { quote, naam, functie }. Er worden geen verzonnen reviews of logo's getoond.
  testimonials: [] as { quote: string; name: string; role: string }[],
};

export const faq = {
  id: "veelgestelde-vragen",
  eyebrow: "Veelgestelde vragen",
  title: "Wat je misschien wilt weten",
  items: [
    {
      question: "Wat is GymWiki?",
      answer:
        "GymWiki is een webapp voor bewegingsonderwijs. Je vindt er activiteiten en lesideeën die door vakleerkrachten zijn gedeeld, je maakt eigen activiteiten, je tekent opstellingen in 3D en je plant je lessen in een weekrooster.",
    },
    {
      question: "Voor wie is GymWiki?",
      answer:
        "Voor vakleerkrachten bewegingsonderwijs, groepsleerkrachten in het basisonderwijs en CALO-, ALO- en PABO-studenten. Scholen kunnen met een teamabonnement collega's uitnodigen.",
    },
    {
      question: "Is GymWiki gratis?",
      answer: `Je kunt de 3D-editor en de openbare activiteitenpagina's gratis gebruiken, zonder account. Met een account is de bibliotheek gratis zolang je ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten per maand deelt die de AI-kwaliteitscontrole doorstaan. Deel je die maand minder, dan is je toegang beperkt tot je eigen activiteiten. Wil je niet bijdragen, dan kan met een abonnement: ${SUBSCRIPTION_PLANS.monthly.priceLabel} per maand, ${SUBSCRIPTION_PLANS.yearly.priceLabel} per jaar of ${SUBSCRIPTION_PLANS.lifetime.priceLabel} eenmalig.`,
    },
    {
      question: "Wat kan ik met de 3D-editor?",
      answer:
        "Je zet toestellen, matten, ballen en pionnen in een gymzaal, sportveld, atletiekbaan of zwembad, draait en kantelt items en zet een veld af met pionnen. Daarna download je een PNG of PDF met materiaallijst, of deel je een link. Je kunt de editor zonder account gebruiken; je werk blijft dan op je eigen apparaat.",
    },
    {
      question: "Kan ik eigen activiteiten toevoegen?",
      answer:
        "Ja. Met de wizard bouw je een activiteit stap voor stap op en bewaar je hem als concept. Activiteiten die je met de bibliotheek deelt, gaan eerst langs een AI-kwaliteitscontrole.",
    },
    {
      question: "Werkt het op telefoon en tablet?",
      answer:
        "Ja. De website en de 3D-editor werken in de browser op telefoon, tablet en computer, met een bediening die is aangepast aan touchschermen.",
    },
    {
      question: "Hoe zit het met privacy en gegevens?",
      // TODO(eigenaar): link naar een privacyverklaring toevoegen; die bestaat nog niet in de app.
      answer:
        "In de gratis editor blijft je plattegrond op je eigen apparaat; er wordt niets naar onze servers gestuurd. Met een account bewaren we je activiteiten, plattegronden en accountgegevens in onze database. Een activiteit is alleen voor anderen zichtbaar als je hem zelf deelt.",
    },
    {
      question: "Sluit het aan bij leerlijnen en het Basisdocument?",
      // TODO(eigenaar): controleer of een koppeling met kerndoelen gewenst is; die is er nu niet.
      answer:
        "Activiteiten zijn ingedeeld in categorieën en leerlijnen, bijvoorbeeld tikspelen, trefspelen en springen, en bevatten een doel, beginsituatie en leeruitkomsten. Een directe koppeling met de kerndoelen is er niet.",
    },
  ],
};

export const finalCta = {
  title: "Begin met je volgende gymles",
  text: "Maak gratis een account en zoek je eerste activiteit, of probeer eerst de 3D-editor.",
  primary: "Gratis beginnen",
  secondary: "Bekijk de bibliotheek",
};

export const footer = {
  tagline: "GymWiki, gebouwd voor docenten bewegingsonderwijs en CALO-studenten.",
  links: [
    { label: "Activiteitenbibliotheek", href: links.library },
    { label: "Gratis 3D-plattegrond maken", href: links.editor },
    { label: "Over GymWiki", href: links.aboutPage },
  ],
};
