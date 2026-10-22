// Genereert het echte GymWiki app-icoon + splash-screen uit het bronlogo
// (assets/branding/gymwiki-logo-source.png, zie logoCanvas.mjs voor de
// STAP1-beoordeling) en schrijft ze rechtstreeks naar de exacte paden die de
// door `cap add ios`/`cap add android` gegenereerde native projecten
// verwachten. Herdraai dit script (`npm run mobile:icons`) na elke wijziging
// aan het bronlogo.
//
// Bewust GEEN @capacitor/assets (het officiële CLI-hulpmiddel hiervoor): die
// trekt op het moment van schrijven een kritieke `tar`-kwetsbaarheid (path
// traversal, GHSA-34x7-hfp2-rc4v e.a.) binnen via een geneste dependency.
// Voor een eenmalig, lokaal script met een klein, vast aantal vaste-formaten
// is zelf schrijven met de sowieso al aanwezige @napi-rs/canvas (zie
// scripts/lib/logoCanvas.mjs) veiliger dan een zware devDependency erbij die
// niemand ooit hoeft te patchen.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeOpaquePng } from "./lib/pngTools.mjs";
import { LOGO_NAVY, REPO_ROOT, renderLogoCanvas, renderLogoMarkOnly } from "./lib/logoCanvas.mjs";

function write(relPath, buffer) {
  const full = path.join(REPO_ROOT, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, buffer);
  console.log(`  ${relPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// Volledig icoon: ondoorzichtige navy-achtergrond + logo, ZONDER
// alfakanaal — Apple's App Store Connect weigert een AppIcon met
// alfakanaal, ook als elke pixel toch al volledig ondoorzichtig is.
// Gebruikt voor iOS' AppIcon en Android's legacy (niet-adaptive)
// ic_launcher/-_round.
async function fullIconPng(size) {
  const canvas = await renderLogoCanvas(size, { background: LOGO_NAVY });
  const { data } = canvas.getContext("2d").getImageData(0, 0, size, size);
  return encodeOpaquePng(size, size, data);
}

// Transparante voorgrondlaag voor Android's adaptive icon: alleen het
// wit/cyaan beeldmerk (navy-badge weg-chroma-keyed, zie
// renderLogoMarkOnly), ruim binnen de "safe zone" (het middelste ~66% van
// het 108dp-canvas dat na masking altijd zichtbaar blijft) — de
// standaard-padding van renderLogoMarkOnly (0.19) is daar al op afgestemd.
async function foregroundPng(size) {
  const canvas = await renderLogoMarkOnly(size);
  return canvas.toBuffer("image/png");
}

// Splash: logo gecentreerd op de navy-merkachtergrond, ruim ingezoomd
// zodat het niet schermvullend oogt — dezelfde navy als de logo-badge
// zelf, dus de afgeronde hoeken van het bronlogo vallen visueel samen met
// de achtergrond.
async function splashPng(size) {
  const canvas = await renderLogoCanvas(size, { background: LOGO_NAVY, padding: 0.32 });
  const { data } = canvas.getContext("2d").getImageData(0, 0, size, size);
  return encodeOpaquePng(size, size, data);
}

async function main() {
  console.log("App-iconen en splash-screens genereren uit het GymWiki-logo...");

  // --- iOS ---
  const IOS_APPICON = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
  write(IOS_APPICON, await fullIconPng(1024));

  const splash2732 = await splashPng(2732);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    write(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`, splash2732);
  }

  // --- Android ---
  // (density, legacy ic_launcher px, adaptive foreground px)
  const ANDROID_DENSITIES = [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ];

  for (const [density, legacySize, fgSize] of ANDROID_DENSITIES) {
    const dir = `android/app/src/main/res/mipmap-${density}`;
    const legacy = await fullIconPng(legacySize);
    write(`${dir}/ic_launcher.png`, legacy);
    write(`${dir}/ic_launcher_round.png`, legacy);
    write(`${dir}/ic_launcher_foreground.png`, await foregroundPng(fgSize));
  }

  // android:drawable="@color/ic_launcher_background" (mipmap-anydpi-v26/ic_launcher.xml)
  // leest dit bestand — overschrijft Android Studio's wit-standaard door de
  // logo's navy-merkkleur, zodat de adaptive-icon-achtergrond bij het
  // beeldmerk erboven past.
  write(
    "android/app/src/main/res/values/ic_launcher_background.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${LOGO_NAVY}</color>\n</resources>\n`,
    ),
  );

  // Splash: dezelfde afbeelding voor elke dichtheid/oriëntatie — Android
  // schaalt de drawable zelf, en @capacitor/splash-screen kiest de juiste
  // variant op basis van androidSplashResourceName ("splash", zie
  // capacitor.config.ts).
  const androidSplash = await splashPng(2732);
  for (const dir of [
    "drawable",
    "drawable-land-mdpi",
    "drawable-land-hdpi",
    "drawable-land-xhdpi",
    "drawable-land-xxhdpi",
    "drawable-land-xxxhdpi",
    "drawable-port-mdpi",
    "drawable-port-hdpi",
    "drawable-port-xhdpi",
    "drawable-port-xxhdpi",
    "drawable-port-xxxhdpi",
  ]) {
    write(`android/app/src/main/res/${dir}/splash.png`, androidSplash);
  }

  console.log("Klaar.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
