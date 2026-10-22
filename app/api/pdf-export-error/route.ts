import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

// PDF-export (ActivityPdfButton/LessonPdfButton) draait volledig client-side
// — er is geen server-actie/Vercel-functie in dat pad, dus een falende
// export laat NERGENS server-side sporen achter. Tot nu toe verdween de
// echte fout (message + stack) in `console.error`, alleen zichtbaar als
// iemand toevallig de DevTools-console open had staan op het moment van
// falen — dat is precies waarom 3 eerdere fixpogingen nooit een bevestigde
// oorzaak hadden. Deze route relayt die client-side fout naar Vercel's
// server-side function-logs (wél doorzoekbaar/bewaard), zodat de eerstvolgende
// mislukking wél een raadpleegbare stacktrace achterlaat.
const MAX_BODY_FIELD_LENGTH = 4000;

function truncate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > MAX_BODY_FIELD_LENGTH ? `${value.slice(0, MAX_BODY_FIELD_LENGTH)}…` : value;
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige payload." }, { status: 400 });
  }

  const {
    component,
    activityId,
    errorName,
    errorMessage,
    errorStack,
    arrangementImageAttempted,
    arrangementImageLoaded,
  } = body as Record<string, unknown>;

  console.error("[pdf-export-error]", {
    userId: profile.id,
    component: truncate(component),
    activityId: truncate(activityId),
    errorName: truncate(errorName),
    errorMessage: truncate(errorMessage),
    errorStack: truncate(errorStack),
    arrangementImageAttempted: Boolean(arrangementImageAttempted),
    arrangementImageLoaded: Boolean(arrangementImageLoaded),
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
