// Bestand opslaan/delen: in de native app opent dit het systeem-deelmenu
// (AirDrop, Bestanden, Mail, WhatsApp…), want een `<a download>` doet binnen
// een WebView op iOS niets bruikbaars. Op het web blijft het een gewone
// download. Plugins worden pas bij gebruik geladen (code-splitting).

function webDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Lezen mislukt."));
    reader.readAsDataURL(blob);
  });
}

/** Bewaart of deelt een bestand. Gooit niet bij annuleren van het deelmenu. */
export async function saveOrShareFile(blob: Blob, fileName: string): Promise<void> {
  if (typeof window === "undefined" || !("Capacitor" in window)) {
    webDownload(blob, fileName);
    return;
  }
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) {
    webDownload(blob, fileName);
    return;
  }
  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const written = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Cache });
    await Share.share({ title: fileName, url: written.uri, dialogTitle: "Delen of bewaren" });
  } catch (error) {
    // Annuleren van het deelmenu is geen fout.
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    webDownload(blob, fileName);
  }
}
