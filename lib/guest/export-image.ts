// Gratis exports krijgen een subtiel label "Gemaakt met GymWiki" (met link/URL). Client-only (canvas).

export const WATERMARK_TEXT = "Gemaakt met GymWiki · www.gymwiki.nl";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Afbeelding kon niet worden geladen."));
    image.src = src;
  });
}

/** Zet het label rechtsonder in de afbeelding en geeft een PNG-blob terug. */
export async function withWatermark(dataUrl: string, background = "#f8fafc"): Promise<Blob> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar.");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  const fontSize = Math.max(14, Math.round(canvas.width / 70));
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const padding = Math.round(fontSize * 0.7);
  const textWidth = ctx.measureText(WATERMARK_TEXT).width;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = fontSize + padding * 1.2;
  const x = canvas.width - boxWidth - padding;
  const y = canvas.height - boxHeight - padding;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, boxHeight / 2);
  ctx.fill();
  ctx.fillStyle = "#c2410c"; // oranje, leesbaar op licht
  ctx.textBaseline = "middle";
  ctx.fillText(WATERMARK_TEXT, x + padding, y + boxHeight / 2 + 1);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG maken mislukt."))), "image/png"));
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Lezen mislukt."));
    reader.readAsDataURL(blob);
  });
}
