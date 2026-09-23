import type { CapacitorConfig } from "@capacitor/cli";

// Bundle ID/package name — MOET overeenkomen met wat al in App Store Connect
// / Google Play Console staat als je een bestaande listing update i.p.v. een
// nieuwe aanmaakt. Wijzig hier ÉN volg daarna STAP "Bundle ID wijzigen" in
// docs/mobile-app/README.md (de native projecten hebben deze waarde ook op
// een paar andere plekken vastgelegd, zie die doc voor de volledige lijst).
const appId = "com.mycompany.gymwiki";
// Icoon/splash regenereren: `npm run mobile:icons` (zie scripts/generate-app-icon.mjs).

const config: CapacitorConfig = {
  appId,
  appName: "GymWiki",
  // Alleen gebruikt als fallback/eerste-paint vóórdat de WebView naar
  // server.url hieronder navigeert — zie www/index.html. De native app
  // toont verder ALTIJD de live, gehoste webapp, nooit deze lokale map:
  // zo hoeft een content-wijziging aan de webapp nooit een nieuwe
  // store-release te krijgen, alleen wijzigingen aan native functionaliteit
  // zelf (nieuwe plugin, gewijzigd icoon/splash, permissies, etc.).
  webDir: "www",
  server: {
    url: "https://www.gymwiki.nl",
    // https (niet het Capacitor-default "http" voor Android's WebView-
    // origin) — nodig omdat de webapp zelf HSTS/een strikte CSP afdwingt
    // (zie next.config.ts) die een gemengd http/https-origin zou blokkeren.
    androidScheme: "https",
    // Staat de WebView toe om van de live URL naar login/registratie/
    // wachtwoord-reset-pagina's op hetzelfde domein te navigeren zonder dat
    // Capacitor dat als "externe navigatie" behandelt (dat zou anders de
    // systeembrowser openen i.p.v. binnen de app te blijven).
    allowNavigation: ["www.gymwiki.nl", "gymwiki.nl"],
  },
  ios: {
    // Voorkomt een wit/leeg fragment tussen het native splash-screen en het
    // moment dat de WebView content toont — de body-achtergrond in
    // www/index.html en de webapp zelf zijn allebei donker/ink-kleurig.
    backgroundColor: "#14171a",
  },
  android: {
    backgroundColor: "#14171a",
  },
  plugins: {
    SplashScreen: {
      // Blijft staan tot de webapp zelf klaar is (zie
      // lib/mobile/capacitor.ts's hideSplashScreenWhenReady) i.p.v. na een
      // vaste timer te verdwijnen — een vaste timer zou op een trage
      // verbinding een leeg/wit scherm tonen vóórdat de live pagina geladen
      // is.
      launchAutoHide: false,
      backgroundColor: "#14171a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#14171a",
    },
  },
};

export default config;
