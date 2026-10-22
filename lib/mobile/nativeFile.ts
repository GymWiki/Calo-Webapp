import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isNativeApp } from "@/lib/mobile/capacitor";

/**
 * Opent de native camera/foto-kiezer (met een "Camera of Bibliotheek?"-
 * keuzescherm, CameraSource.Prompt) en geeft het resultaat terug als een
 * gewone web `File` — bruikbaar in precies dezelfde upload-code die nu al
 * een `<input type="file">`-resultaat verwerkt (FormData, fetch, Supabase
 * Storage-upload, etc.), geen aparte native upload-pad nodig.
 *
 * Nergens verplicht: een kaal `<input type="file" accept="image/*">`
 * opent BINNEN Capacitor's WebView zelf ook al automatisch de
 * camera/bibliotheek-kiezer van het besturingssysteem (bestaand
 * WebView-gedrag, geen plugin voor nodig) — de bestaande upload-
 * componenten (components/KnowledgeUploadForm.tsx,
 * components/ActivityImportUploadCard.tsx, components/
 * KnowledgeLibraryAdmin.tsx) werken dus al zonder wijzigingen in de
 * native app. Deze helper is er voor het geval een scherm ooit een
 * directere "Maak foto"-knop wil i.p.v. de generieke bestandskiezer (bijv.
 * een toekomstige materiaal-foto-flow) — roep 'm alleen aan als
 * isNativeApp() true is.
 *
 * Geeft `null` terug als de gebruiker annuleert of toestemming weigert
 * (nooit een throw voor dat normale pad — alleen echte onverwachte fouten
 * geven een reject).
 */
export async function pickImageNative(): Promise<File | null> {
  if (!isNativeApp()) {
    throw new Error("pickImageNative() is alleen bedoeld voor de native app — check isNativeApp() eerst.");
  }

  let photo;
  try {
    photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 80,
      // Matcht de bestaande web-uploadflow: die schaalt/comprimeert ook al
      // vóór upload (zie de canvas-diagram-exportcompressie), dus een
      // camera-foto op volle resolutie (vaak >10MB) zou onnodig groot zijn.
      width: 1600,
    });
  } catch (error) {
    // Camera.getPhoto verwerpt de promise zowel bij annuleren als bij een
    // geweigerde toestemming — geen manier om dat hier betrouwbaar te
    // onderscheiden van een echte fout, dus behandelen we dit pad als "de
    // gebruiker heeft geen foto gekozen" i.p.v. de aanroeper een generieke
    // fout te tonen voor wat meestal gewoon een annulering is.
    if (error instanceof Error && /cancell?ed/i.test(error.message)) {
      return null;
    }
    return null;
  }

  if (!photo.webPath) return null;

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const extension = photo.format || "jpeg";
  return new File([blob], `foto-${Date.now()}.${extension}`, {
    type: blob.type || `image/${extension}`,
  });
}
