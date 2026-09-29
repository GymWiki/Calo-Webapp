// Genereert de volledige favicon-/PWA-iconenset uit het echte GymWiki-logo
// (assets/branding/gymwiki-logo-source.png) — zie de PR-samenvatting voor de
// STAP1-beoordeling van dat bronbestand (512x512 RGBA, navy #002f4f-badge
// met wit/cyaan beeldmerk, geen ingebakken "GymWiki"-tekst).
//
// Alle uitvoerbestanden krijgen een volledig ondoorzichtige navy achtergrond
// (de transparante afgeronde hoekjes van de badge worden opgevuld) behalve
// public/gymwiki-logo.png zelf — die blijft de originele badge-vorm, want
// die wordt op wisselende paginasachtergronden geplaatst (header, e-mail)
// waar de afgeronde rand juist gewenst is.
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { encodeIco, encodeOpaquePng } from "./lib/pngTools.mjs";
import { LOGO_NAVY, REPO_ROOT, SOURCE_LOGO_PATH, renderLogoCanvas, renderLogoMarkOnly } from "./lib/logoCanvas.mjs";

function write(relPath, buffer) {
  const full = path.join(REPO_ROOT, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, buffer);
  console.log(`  ${relPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function opaquePng(size) {
  const canvas = await renderLogoCanvas(size, { background: LOGO_NAVY });
  const { data } = canvas.getContext("2d").getImageData(0, 0, size, size);
  return encodeOpaquePng(size, size, data);
}

async function main() {
  console.log("Favicon-/PWA-iconenset genereren uit het GymWiki-logo...");

  // Browserfavicon (tabblad) — multi-resolutie .ico, PNG-in-ICO-formaat
  // (ondersteund door alle huidige browsers voor favicon.ico).
  const icoSizes = [16, 32, 48];
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => ({ size, png: await opaquePng(size) })),
  );
  write("app/favicon.ico", encodeIco(icoEntries));

  // Losse PNG's — expliciet gekoppeld via metadata.icons in app/layout.tsx
  // (i.p.v. Next.js' app/icon.png-bestandsconventie, die een tweede,
  // overlappende <link rel="icon"> zou genereren naast onze expliciete set).
  write("public/favicon-16x16.png", await opaquePng(16));
  write("public/favicon-32x32.png", await opaquePng(32));
  write("public/apple-touch-icon.png", await opaquePng(180));

  // PWA/Android — paden die public/manifest.json al verwacht.
  write("public/icons/icon-192.png", await opaquePng(192));
  write("public/icons/icon-512.png", await opaquePng(512));

  // Maskable icoon: volledig dekkende navy achtergrond + het beeldmerk
  // ruim binnen de "veilige zone" (zie de toelichting in logoCanvas.mjs) —
  // Android/Chrome mogen dit agressief rond/vierkant/squircle afknippen
  // zonder dat het beeldmerk zelf geraakt wordt.
  {
    const size = 512;
    const bgCanvas = await renderLogoCanvas(size, { background: LOGO_NAVY, padding: 1 }); // enkel de navy-vulling
    const ctx = bgCanvas.getContext("2d");
    const mark = await renderLogoMarkOnly(size);
    ctx.drawImage(mark, 0, 0);
    const { data } = ctx.getImageData(0, 0, size, size);
    write("public/icons/icon-maskable-512.png", encodeOpaquePng(size, size, data));
  }

  // Algemeen webgebruik (header, landingspagina, e-mail) — de originele
  // badge-vorm zelf, ongewijzigd, want die belandt op wisselende
  // paginasachtergronden waar de afgeronde rand juist gewenst is.
  mkdirSync(path.join(REPO_ROOT, "public"), { recursive: true });
  copyFileSync(SOURCE_LOGO_PATH, path.join(REPO_ROOT, "public/gymwiki-logo.png"));
  console.log("  public/gymwiki-logo.png (kopie van het bronlogo)");

  console.log("Klaar.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
