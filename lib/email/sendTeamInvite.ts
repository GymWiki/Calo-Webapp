// Lazy, best-effort e-mailverzending voor teamuitnodigingen — mirrort
// lib/stripe/client.ts's patroon (importeren gooit nooit, pas gebruiken
// wel, met een duidelijke Nederlandse foutmelding). Deze codebase heeft nog
// GEEN eigen e-mailinfrastructuur (registratie/wachtwoord-reset lopen
// volledig via Supabase Auth's ingebouwde mail, geen custom content) — dit
// is de eerste plek die zelf een e-mail met vrije inhoud verstuurt.
//
// BEWUSTE KEUZE: de uitnodigingslink werkt ALTIJD, ongeacht of e-mail
// daadwerkelijk verzonden wordt — actions/team.ts geeft 'm ook terug aan de
// eigenaar, die 'm dus altijd zelf kan kopiëren/delen (zie de
// "Kopieer link"-knop in components/team/PendingInvitesList.tsx). Zodra
// RESEND_API_KEY gezet wordt, verstuurt deze functie ook automatisch een
// echte e-mail — tot die tijd faalt sendTeamInviteEmail stil (best-effort,
// nooit de uitnodig-actie zelf blokkeren) en blijft de link de enige, maar
// volledig werkende, manier van delen.
export async function sendTeamInviteEmail(params: {
  to: string;
  teamName: string;
  inviteUrl: string;
  inviterName: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false };
  }

  try {
    // Rechtstreekse REST-aanroep i.p.v. het `resend`-package: voorkomt een
    // extra dependency voor een integratie die pas actief wordt zodra de
    // eigenaar zelf RESEND_API_KEY zet — fetch() is er toch al.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "GymWiki <noreply@gymwiki.nl>",
        to: params.to,
        subject: `${params.inviterName} nodigt je uit voor team "${params.teamName}" op GymWiki`,
        html: `
          <p>${params.inviterName} nodigt je uit om lid te worden van het GymWiki-team "${params.teamName}".</p>
          <p>Als teamlid krijg je volledige toegang tot GymWiki — inclusief de AI Lescoach — zonder zelf te hoeven betalen of maandelijks activiteiten te delen.</p>
          <p><a href="${params.inviteUrl}">Bevestig je uitnodiging</a></p>
          <p>Deze link verloopt over 14 dagen.</p>
        `,
      }),
    });

    return { sent: response.ok };
  } catch (error) {
    console.error("Kon teamuitnodiging niet mailen:", error);
    return { sent: false };
  }
}
