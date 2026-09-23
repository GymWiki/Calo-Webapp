// Genereert een TIJDELIJK app-icoon + splash-screen uit de bestaande
// GymWiki-huisstijl (--ink/--cone uit app/globals.css) en schrijft ze
// rechtstreeks naar de exacte paden die de door `cap add ios`/`cap add
// android` gegenereerde native projecten verwachten. Er staat nergens in de
// repo een logo-bestand (alleen de tekst "GYMWIKI" in een display-font),
// dus dit is een placeholder totdat er een echt logo is — herdraai dit
// script (`npm run mobile:icons`) zodra dat er is, of vervang de paden
// hieronder handmatig door een export uit een echt ontwerp.
//
// Bewust GEEN @capacitor/assets (het officiële CLI-hulpmiddel hiervoor):
// die trekt op het moment van schrijven een kritieke `tar`-kwetsbaarheid
// (path traversal, GHSA-34x7-hfp2-rc4v e.a.) binnen via een geneste
// dependency. Voor een eenmalig, lokaal script met een klein, vast aantal
// vaste-formaten is zelf schrijven met de sowieso al aanwezige
// @napi-rs/canvas (zie lib/ai/... voor het andere gebruik daarvan in dit
// project) veiliger dan een zware devDependency erbij die niemand ooit
// hoeft te patchen.
//
// Bekende beperking: @napi-rs/canvas's PNG-export bevat altijd een
// alpha-kanaal, ook al is elke pixel hier volledig ondoorzichtig. Apple's
// App Store Connect wijst een App Store-icoon MET alpha-kanaal af (zelfs
// zonder transparante pixels) — dit valt op bij het archiveren/uploaden in
// Xcode en is dan met een simpele "flatten"-actie in een beeldbewerker op
// te lossen. Geen probleem zolang dit een placeholder is; even opnieuw
// checken zodra dit vervangen wordt door een echt logo-bestand.
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const INK = "#14171a";
const CONE = "#ff5a1f";
const CONE_STRONG = "#d94614";

function drawCone(ctx, cx, cy, scale) {
  ctx.fillStyle = CONE;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 260 * scale);
  ctx.lineTo(cx + 150 * scale, cy + 180 * scale);
  ctx.lineTo(cx - 150 * scale, cy + 180 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = CONE_STRONG;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 200 * scale, 190 * scale, 46 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(cx - 90 * scale, cy + 40 * scale);
  ctx.lineTo(cx + 90 * scale, cy + 40 * scale);
  ctx.lineTo(cx + 108 * scale, cy + 96 * scale);
  ctx.lineTo(cx - 108 * scale, cy + 96 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

// Volledig icoon: ondoorzichtige ink-achtergrond + kegel — gebruikt voor
// iOS' AppIcon en Android's legacy (niet-adaptive) ic_launcher/-_round.
function fullIconPng(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size, size);
  drawCone(ctx, size / 2, size / 2 + size * 0.02, size / 1024);
  return canvas.toBuffer("image/png");
}

// Transparante voorgrondlaag voor Android's adaptive icon: de kegel moet
// ruim binnen de "safe zone" (het middelste ~66% van het 108dp-canvas dat
// na masking altijd zichtbaar blijft) passen, dus fors kleiner geschaald
// dan het volledige icoon.
function foregroundPng(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  drawCone(ctx, size / 2, size / 2 + size * 0.02, (size / 1024) * 0.62);
  return canvas.toBuffer("image/png");
}

function splashPng(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, size, size);
  drawCone(ctx, size / 2, size / 2, size / 2200);
  return canvas.toBuffer("image/png");
}

// --- iOS ---
const IOS_APPICON = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
write(IOS_APPICON, fullIconPng(1024));

const splash2732 = splashPng(2732);
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
  const legacy = fullIconPng(legacySize);
  write(`${dir}/ic_launcher.png`, legacy);
  write(`${dir}/ic_launcher_round.png`, legacy);
  write(`${dir}/ic_launcher_foreground.png`, foregroundPng(fgSize));
}

// android:drawable="@color/ic_launcher_background" (mipmap-anydpi-v26/ic_launcher.xml)
// leest dit bestand — overschrijft Android Studio's wit-standaard door de
// ink-kleur, zodat de adaptive-icon-achtergrond bij de rest klopt.
write(
  "android/app/src/main/res/values/ic_launcher_background.xml",
  Buffer.from(
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INK}</color>\n</resources>\n`,
  ),
);

// Splash: dezelfde afbeelding voor elke dichtheid/oriëntatie — Android
// schaalt de drawable zelf, en @capacitor/splash-screen kiest de juiste
// variant op basis van androidSplashResourceName ("splash", zie
// capacitor.config.ts).
const androidSplash = splashPng(2732);
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

// --- Bron-kopie (voor eventueel gebruik door de webapp zelf, bijv. een
// toekomstig favicon/PWA-icoon dat dezelfde placeholder deelt) ---
mkdirSync("assets", { recursive: true });
writeFileSync("assets/icon.png", fullIconPng(1024));
writeFileSync("assets/splash.png", splashPng(2732));

console.log("App-iconen en splash-screens (placeholder) geschreven voor iOS + Android.");
