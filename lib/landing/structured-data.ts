import { SITE_URL, faq, meta } from "@/content/landing.nl";
import {
  FREE_PLAN_INFO,
  SUBSCRIPTION_PLANS,
  TEAM_PLANS,
  TEAM_PLAN_ORDER,
} from "@/lib/constants/subscriptionPlans";

const price = (label: string) => label.replace(/[^0-9]/g, "");

/** JSON-LD voor de landingspagina: Organization, WebSite, SoftwareApplication (prijzen uit de centrale config) en FAQPage (letterlijk dezelfde tekst als zichtbaar). */
export function buildLandingStructuredData(now: Date = new Date()) {
  const validUntil = new Date(now);
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  const priceValidUntil = validUntil.toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "GymWiki",
        url: SITE_URL,
        description: "GymWiki is een webapp voor bewegingsonderwijs: activiteiten vinden, maken, delen en plannen.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "GymWiki",
        url: SITE_URL,
        inLanguage: "nl-NL",
        description: meta.description,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: "GymWiki",
        url: SITE_URL,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: "nl-NL",
        description: meta.description,
        offers: [
          { "@type": "Offer", name: FREE_PLAN_INFO.label, price: "0", priceCurrency: "EUR", description: FREE_PLAN_INFO.description },
          ...(["monthly", "yearly", "lifetime"] as const).map((id) => ({
            "@type": "Offer",
            name: SUBSCRIPTION_PLANS[id].label,
            price: price(SUBSCRIPTION_PLANS[id].priceLabel),
            priceCurrency: "EUR",
            priceValidUntil,
            description: SUBSCRIPTION_PLANS[id].description,
          })),
          ...TEAM_PLAN_ORDER.map((id) => ({
            "@type": "Offer",
            name: `${TEAM_PLANS[id].label} (teamabonnement)`,
            price: price(TEAM_PLANS[id].priceLabel),
            priceCurrency: "EUR",
            priceValidUntil,
            eligibleQuantity: { "@type": "QuantitativeValue", maxValue: TEAM_PLANS[id].seatLimit },
          })),
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faq.items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
      },
    ],
  };
}
