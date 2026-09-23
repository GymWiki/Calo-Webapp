import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp } from "@/lib/mobile/capacitor";

/**
 * SCAFFOLD voor toekomstig gebruik (zie de brief: "indien gewenst") — dit
 * regelt alleen het CLIENT-side deel (toestemming vragen + device-token
 * ophalen). Bewust NIET aangeroepen vanuit CapacitorBootstrap/app-startup:
 * ongevraagd bij eerste launch om pushmeldingen-toestemming vragen is
 * slechte praktijk (lagere acceptatiegraad, en iOS staat de systeemdialoog
 * maar één keer toe), en er is nog GEEN server-kant om de token te
 * ontvangen/bewaren of daadwerkelijk meldingen te versturen — dat vereist
 * minimaal:
 *   1. Een Apple Push Notification-certificaat/key (APNs) en een Firebase
 *      Cloud Messaging-project (FCM) — zie docs/mobile-app/README.md.
 *   2. Een kolom/tabel om device-tokens per gebruiker op te slaan (bijv.
 *      public.push_tokens, analoog aan hoe public.subscriptions nu Stripe-
 *      state bijhoudt).
 *   3. Een verzend-pad (server action/edge function) die die tokens
 *      gebruikt om daadwerkelijk iets te versturen.
 * Roep registerForPushNotifications() pas aan vanuit een expliciete
 * gebruikersactie (bijv. een toggle in /profiel/instellingen) zodra dat
 * server-werk er is.
 */
export async function registerForPushNotifications(): Promise<
  { status: "unsupported" | "denied" } | { status: "registered"; token: string }
> {
  if (!isNativeApp()) return { status: "unsupported" };

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    return { status: "denied" };
  }

  return new Promise((resolve) => {
    PushNotifications.addListener("registration", (token) => {
      resolve({ status: "registered", token: token.value });
    });
    PushNotifications.addListener("registrationError", () => {
      resolve({ status: "denied" });
    });
    void PushNotifications.register();
  });
}
