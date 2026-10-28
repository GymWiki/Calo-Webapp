// Deelbare link zonder server-opslag: de plattegrond-JSON wordt gecomprimeerd (deflate-raw) en base64url-gecodeerd in de URL-HASH
// (#p=...). Een hash gaat nooit naar de server (geen logs, geen duplicate content voor Google, geen opslag nodig).
// Formaat: "v1.<base64url>" (gecomprimeerd) of "u1.<base64url>" (ongecomprimeerd, voor browsers zonder CompressionStream).

import { floorplan3dDataSchema, type Floorplan3dData } from "@/types/floorplan3d";

export const SHARE_HASH_KEY = "p";
/** Langer dan dit blijft een link onbetrouwbaar in chat-apps/e-mail: val terug op PNG/PDF. */
export const MAX_SHARE_URL_CHARS = 8000;
/** Bovengrens voor het uitgepakte JSON (bescherming tegen opgeblazen/kwaadaardige links). */
export const MAX_DECODED_BYTES = 400_000;

const round = (value: number) => Math.round(value * 1000) / 1000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Afgeronde, compacte kopie: ids en y blijven (de editor rekent y bij het laden opnieuw uit). */
export function compactFloorplan(data: Floorplan3dData): Floorplan3dData {
  return {
    version: 1,
    room: data.room,
    items: data.items.map((item) => ({
      ...item,
      x: round(item.x),
      y: round(item.y),
      z: round(item.z),
      rot_y_deg: round(item.rot_y_deg),
      ...(item.rot_x_deg !== undefined ? { rot_x_deg: round(item.rot_x_deg) } : {}),
      ...(item.rot_z_deg !== undefined ? { rot_z_deg: round(item.rot_z_deg) } : {}),
    })),
    coneFields: data.coneFields.map((field) => ({ ...field, x: round(field.x), z: round(field.z), rot_y_deg: round(field.rot_y_deg) })),
  };
}

const hasCompression = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array | null> {
  const copy = new Uint8Array(bytes);
  const writer = stream.writable.getWriter();
  void writer.write(copy).then(() => writer.close()).catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await reader.read();
    } catch {
      return null;
    }
    if (result.done) break;
    total += result.value.length;
    if (total > limit) {
      void reader.cancel();
      return null;
    }
    chunks.push(result.value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function encodeFloorplan(data: Floorplan3dData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(compactFloorplan(data)));
  if (hasCompression()) {
    const packed = await pipe(json, new CompressionStream("deflate-raw"));
    if (packed) return `v1.${toBase64Url(packed)}`;
  }
  return `u1.${toBase64Url(json)}`;
}

/** Geeft `null` bij een ongeldige, te grote of gemanipuleerde link; de inhoud wordt met het schema gevalideerd. */
export async function decodeFloorplan(token: string): Promise<Floorplan3dData | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const kind = token.slice(0, dot);
  const bytes = fromBase64Url(token.slice(dot + 1));
  if (!bytes || bytes.length === 0) return null;

  let json: Uint8Array | null = null;
  if (kind === "v1") {
    if (!hasCompression()) return null;
    json = await pipe(bytes, new DecompressionStream("deflate-raw"), MAX_DECODED_BYTES);
  } else if (kind === "u1") {
    json = bytes.length <= MAX_DECODED_BYTES ? bytes : null;
  }
  if (!json) return null;

  try {
    const parsed = floorplan3dDataSchema.safeParse(JSON.parse(new TextDecoder().decode(json)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type ShareLink = { url: string; length: number; tooLong: boolean };

/** `base` = de URL van de gratis tool (zonder hash). */
export function buildShareLink(base: string, token: string): ShareLink {
  const url = `${base.split("#")[0]}#${SHARE_HASH_KEY}=${token}`;
  return { url, length: url.length, tooLong: url.length > MAX_SHARE_URL_CHARS };
}

/** Haalt het token uit `location.hash` (`#p=...`). */
export function readShareToken(hash: string): string | null {
  const match = new RegExp(`(?:^#|&)${SHARE_HASH_KEY}=([A-Za-z0-9_.-]+)`).exec(hash);
  return match ? match[1] : null;
}
