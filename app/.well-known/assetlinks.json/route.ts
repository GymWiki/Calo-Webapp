// Android App Links: koppelt https://www.gymwiki.nl aan de Android-app.
// ANDROID_SHA256_FINGERPRINTS = komma-gescheiden SHA-256 van het
// Play-app-signing-certificaat (Play Console → App-integriteit) en eventueel
// het uploadcertificaat. Zonder env-var: 404.
export const dynamic = "force-static";

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  if (fingerprints.length === 0) return new Response("Not found", { status: 404 });
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: process.env.ANDROID_PACKAGE_NAME ?? "com.mycompany.gymwiki",
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
