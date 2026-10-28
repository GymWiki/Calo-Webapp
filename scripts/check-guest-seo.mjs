// SEO-controle van de gratis tool en de long-tail pagina's tegen een draaiende server (productiebuild):
//   node scripts/check-guest-seo.mjs [http://localhost:3125]
// Controleert op de ruwe HTML (zoals een crawler die zonder JavaScript ziet): title, meta description, canonical, één H1,
// H2's, Open Graph/Twitter, geldige JSON-LD (SoftwareApplication/FAQPage/BreadcrumbList), robots.txt en sitemap.xml.
const base = (process.argv[2] ?? "http://localhost:3125").replace(/\/$/, "");
const pages = [
  { path: "/", h1: "Alle activiteiten voor je gymles op één plek", types: ["Organization", "WebSite", "SoftwareApplication", "FAQPage"], minFaq: 6 },
  { path: "/gratis-gymzaal-plattegrond-maken", h1: "Gratis gymzaal plattegrond maken in 3D", types: ["SoftwareApplication", "FAQPage", "BreadcrumbList"], minFaq: 8 },
  { path: "/gymzaal-indeling-maken", types: ["FAQPage", "BreadcrumbList"] },
  { path: "/opstelling-bewegingsonderwijs-tekenen", types: ["FAQPage", "BreadcrumbList"] },
  { path: "/veld-afzetten-met-pionnen", types: ["FAQPage", "BreadcrumbList"] },
  { path: "/volleybalveld-indeling-gymzaal", types: ["FAQPage", "BreadcrumbList"] },
];
let failed = 0;
const check = (ok, message) => {
  if (!ok) failed += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${message}`);
};
const meta = (html, attr, name) => html.match(new RegExp(`<meta[^>]+${attr}="${name}"[^>]+content="([^"]*)"`, "i"))?.[1] ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}="${name}"`, "i"))?.[1];

for (const page of pages) {
  console.log(page.path);
  const response = await fetch(base + page.path);
  const html = await response.text();
  check(response.status === 200, `status 200 (${response.status})`);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check(title.length >= 40 && title.length <= 62, `title ${title.length} tekens: ${title}`);
  const description = meta(html, "name", "description") ?? "";
  check(description.length >= 110 && description.length <= 165, `meta description ${description.length} tekens`);
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
  check(canonical === `https://www.gymwiki.nl${page.path === "/" ? "" : page.path}`, `canonical ${canonical}`);
  check(!/noindex/i.test(meta(html, "name", "robots") ?? ""), "geen noindex");
  const h1s = [...html.matchAll(/<h1[\s>]/g)].length;
  check(h1s === 1, `precies één H1 (${h1s})`);
  if (page.h1) check(html.includes(`>${page.h1}</h1>`), `H1-tekst "${page.h1}"`);
  check([...html.matchAll(/<h2[\s>]/g)].length >= 3, "minstens drie H2's");
  check(Boolean(meta(html, "property", "og:title")) && Boolean(meta(html, "property", "og:description")), "Open Graph title + description");
  check(Boolean(meta(html, "name", "twitter:card")), "Twitter card");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  check(blocks.length >= 1, "JSON-LD aanwezig");
  try {
    const graph = blocks.flatMap((b) => JSON.parse(b)["@graph"] ?? [JSON.parse(b)]);
    for (const type of page.types) check(graph.some((n) => n["@type"] === type), `JSON-LD ${type}`);
    const faq = graph.find((n) => n["@type"] === "FAQPage");
    if (faq) {
      check(faq.mainEntity.every((q) => html.includes(q.name.replace(/&/g, "&amp;").replace(/’/g, "’"))), "FAQ-vragen staan ook zichtbaar op de pagina");
      if (page.minFaq) check(faq.mainEntity.length >= page.minFaq, `FAQ heeft ${faq.mainEntity.length} vragen`);
    }
  } catch (error) {
    check(false, `JSON-LD is geldige JSON (${error.message})`);
  }
}

console.log("robots.txt + sitemap.xml");
const robots = await (await fetch(`${base}/robots.txt`)).text();
for (const page of pages) check(robots.includes(`Allow: ${page.path}`), `robots staat ${page.path} toe`);
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
for (const page of pages) check(sitemap.includes(`https://www.gymwiki.nl${page.path === "/" ? "" : page.path}</loc>`), `sitemap bevat ${page.path}`);

console.log(failed === 0 ? "\nAlle SEO-controles geslaagd." : `\n${failed} controle(s) mislukt.`);
process.exit(failed === 0 ? 0 : 1);
