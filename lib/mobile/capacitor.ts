import { Capacitor } from "@capacitor/core";

/**
 * True zodra deze code binnen de native iOS/Android-app (Capacitor's
 * WebView) draait — altijd false op www.gymwiki.nl in een gewone browser/
 * PWA, want dat is precies dezelfde build, alleen zonder de Capacitor-
 * native-runtime eromheen. Gebruik dit i.p.v. user-agent-sniffen om native-
 * only gedrag (camera-plugin, status bar, hardware-terugknop) uit te
 * schakelen op het web.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Ent status bar-stijl, splash-screen-afhandeling en Android's hardware-
 * terugknop op de native app. Wordt precies één keer aangeroepen vanuit
 * components/mobile/CapacitorBootstrap.tsx (gemount in app/layout.tsx) — een
 * no-op op het web, dus veilig om onvoorwaardelijk te importeren/aan te
 * roepen vanuit een client component die op alle platforms rendert.
 */
export async function initializeNativeApp(): Promise<void> {
  if (!isNativeApp()) return;

  const [{ StatusBar, Style }, { SplashScreen }, { App: CapacitorApp }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/app"),
  ]);

  try {
    // Donkere achtergrond (zie capacitor.config.ts) → lichte statusbalk-
    // iconen, anders zijn tijd/batterij-iconen onleesbaar tegen de ink-
    // kleurige header. GymWiki's eigen dark-mode-toggle wijzigt alleen de
    // webapp-inhoud, niet dit — de statusbalk volgt bewust altijd het
    // native-app-thema, niet de losse in-app dark-mode-voorkeur.
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#14171a" });
    }
  } catch {
    // Best-effort — een niet-gezette statusbalkstijl is geen kritieke fout.
  }

  // launchAutoHide: false in capacitor.config.ts laat het splash-screen tot
  // hier staan — pas verbergen zodra de eerste pagina van de LIVE webapp
  // (niet de lokale www/index.html-placeholder) daadwerkelijk gerenderd is,
  // anders ziet een gebruiker op een trage verbinding een leeg/wit scherm
  // vóór de content er is.
  try {
    await SplashScreen.hide();
  } catch {
    // Best-effort.
  }

  // Zonder dit sluit Android's hardware-/gebaar-terugknop de hele app
  // i.p.v. terug te navigeren binnen de WebView — dat verrast een
  // gebruiker die gewend is dat "terug" een stap terug in de app betekent.
  // canGoBack() is Capacitor's eigen WebView-geschiedenis-check.
  CapacitorApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  });

  // "Terug naar de app"-deeplink vanaf de betaalpagina in de externe
  // browser (zie components/mobile/NativeUpgradeAction.tsx + het
  // custom_url_scheme dat `cap add` al registreerde, nu ook toegevoegd aan
  // ios/App/App/Info.plist en android/.../AndroidManifest.xml). Een volledige
  // reload (niet client-side navigatie) i.p.v. alleen de app naar de
  // voorgrond halen: de WebView bevat nog de OUDE server-gerenderde
  // abonnementsstatus van vóór het bezoek aan de externe browser, en de
  // backend (Stripe-webhook -> Supabase) is inmiddels de enige bron van
  // waarheid — een verse laad van /pro plukt die meteen op, zonder aparte
  // syncstap.
  CapacitorApp.addListener("appUrlOpen", () => {
    window.location.href = "https://www.gymwiki.nl/pro";
  });
}

/**
 * Opent een URL in de systeem-browser (Safari/Chrome via SFSafariViewController
 * resp. Chrome Custom Tabs — een apart browser-surface met eigen adresbalk en
 * cookie-jar, niet de WebView van de app zelf) i.p.v. binnen de app. Gebruikt
 * voor elke plek waar de Store-richtlijnen een ingebedde ervaring verbieden
 * (zie components/mobile/NativeUpgradeAction.tsx voor de betaalmuur) — geen
 * WebView-navigatie naar zo'n URL, want die blijft altijd binnen de app zodra
 * de host bij server.url hoort (zie capacitor.config.ts).
 */
export async function openInSystemBrowser(url: string): Promise<void> {
  if (!isNativeApp()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}
