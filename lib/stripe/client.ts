import Stripe from "stripe";

let client: Stripe | null = null;

// Lazily constructed so importing this module never throws — only calling
// it does, with a Dutch message an admin will actually understand. Mirrors
// lib/ai/openai-client.ts's pattern.
export function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY ontbreekt. Zet deze omgevingsvariabele om Pro-upgrades te kunnen verwerken.",
    );
  }

  if (!client) {
    client = new Stripe(apiKey);
  }

  return client;
}
