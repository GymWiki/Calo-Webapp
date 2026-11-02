// Universal Links: koppelt https://www.gymwiki.nl aan de iOS-app. Vereist
// APPLE_TEAM_ID (Apple Developer → Membership) en de bundle-ID; zonder die
// env-vars antwoordt de route 404 (er wordt niets verzonnen).
export const dynamic = "force-static";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.APPLE_BUNDLE_ID ?? "com.mycompany.gymwiki";
  if (!teamId) return new Response("Not found", { status: 404 });
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${teamId}.${bundleId}`],
            components: [
              { "/": "/activiteit/*" },
              { "/": "/les/share/*" },
              { "/": "/dashboard" },
              { "/": "/zoeken" },
              { "/": "/plattegrond-3d*" },
              { "/": "/pro" },
            ],
          },
        ],
      },
    },
    { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } },
  );
}
