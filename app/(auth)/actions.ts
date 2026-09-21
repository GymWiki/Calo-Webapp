"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

type LoginErrorKind = "invalid_credentials" | "rate_limited" | "generic";
type ActionError = { error: string; kind?: LoginErrorKind };

const GENERIC_ERROR =
  "Er ging iets mis. Controleer je verbinding en probeer het opnieuw.";

// Nooit Supabase's eigen error.message doorgeven aan de gebruiker (kan
// technisch/Engels zijn, of — voor "Invalid login credentials" — juist te
// vaag). In plaats daarvan mappen we bekende error.code's (zie
// @supabase/auth-js/src/lib/error-codes.ts) naar duidelijke, Nederlandse
// meldingen. Onbekende codes vallen terug op GENERIC_ERROR i.p.v. de rauwe
// Supabase-tekst te tonen.
function mapLoginError(error: AuthError): ActionError {
  switch (error.code) {
    case "invalid_credentials":
      // Bewust generiek (niet "e-mailadres onbekend" vs. "wachtwoord fout")
      // — anders kan een kwaadwillende aan de respons aflezen welke
      // e-mailadressen geregistreerd zijn (account-enumeratie).
      return { error: "E-mailadres of wachtwoord is onjuist.", kind: "invalid_credentials" };
    case "over_request_rate_limit":
      return {
        error: "Te veel inlogpogingen. Wacht een paar minuten en probeer het daarna opnieuw.",
        kind: "rate_limited",
      };
    default:
      return { error: GENERIC_ERROR, kind: "generic" };
  }
}

async function getOrigin() {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  return `${proto}://${headerList.get("host")}`;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<ActionError | Record<string, never>> {
  // createClient() zelf binnen de try: als het Supabase-project verkeerd
  // geconfigureerd is (ontbrekende/foute env-vars) gooit createServerClient
  // hier direct een exception, buiten de auth-aanroep om. Die mocht eerst
  // ongevangen door de server action heen lekken — een fout die de client
  // niet als een normale { error } kan tonen crasht de aanroep zelf, wat de
  // React-formulierstatus in een kapotte staat kan achterlaten in plaats van
  // gewoon de generieke foutmelding te tonen.
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.signInWithPassword(input);

    if (error) {
      return mapLoginError(error);
    }

    return {};
  } catch {
    return { error: GENERIC_ERROR, kind: "generic" };
  }
}

export async function requestPasswordReset(input: {
  email: string;
}): Promise<ActionError | Record<string, never>> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const origin = await getOrigin();
    // GoTrue's /recover-endpoint geeft altijd succes terug, ongeacht of het
    // e-mailadres bestaat (voorkomt account-enumeratie) — een `error` hier
    // is dus een échte fout (bijv. rate limit), nooit "adres onbekend".
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${origin}/wachtwoord-resetten`,
    });

    if (error) {
      return {
        error:
          error.code === "over_email_send_rate_limit"
            ? "Te veel reset-aanvragen voor dit e-mailadres. Wacht even en probeer het later opnieuw."
            : GENERIC_ERROR,
      };
    }

    return {};
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<ActionError | Record<string, never>> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    // Vereist dat "Confirm email" uitstaat in de Supabase-projectinstellingen
    // (Authentication -> Sign In / Providers -> Email) — anders geeft signUp
    // hierboven geen sessie terug en faalt de daaropvolgende pagina die wél
    // een sessie verwacht.
    return {};
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function logout() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await supabase.auth.signOut();
  } catch {
    // Best-effort: fall through to redirect either way.
  }

  redirect("/");
}
