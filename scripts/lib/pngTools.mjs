// Kleine, afhankelijkheidsvrije PNG/ICO-encoders — puur voor de
// asset-generatiescripts (generate-favicons.mjs, generate-app-icon.mjs).
//
// WAAROM ZELF GESCHREVEN I.P.V. EEN PACKAGE (bijv. `png-to-ico`,
// `to-ico`, `sharp`): zelfde afweging als scripts/generate-app-icon.mjs's
// bestaande toelichting over @capacitor/assets vermijden — dit zijn een
// handvol simpele, stabiele binaire formaten (PNG is gewoon een zlib-stream
// + chunks, ICO is gewoon een klein binair archief van PNG's) die geen
// zware devDependency rechtvaardigen voor iets dat maar twee keer per jaar
// draait. @napi-rs/canvas (al aanwezig) levert de pixels, deze helpers
// verpakken ze.
import { createHash } from "node:crypto";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Codeert ruwe RGBA-pixels (bijv. uit canvas.getContext("2d").getImageData())
 * als een PNG ZONDER alfakanaal (colour type 2, truecolor RGB) — nodig voor
 * Apple's App Store Connect, die een iOS-appicoon MET alfakanaal weigert
 * (zelfs als elke pixel toch al volledig ondoorzichtig is; @napi-rs/canvas's
 * eigen PNG-export bevat altijd een alfakanaal, vandaar deze losse encoder
 * i.p.v. canvas.toBuffer("image/png") direct te gebruiken op dat ene bestand).
 */
export function encodeOpaquePng(width, height, rgba) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (1 + stride));
  let pos = 0;
  for (let y = 0; y < height; y++) {
    raw[pos++] = 0; // filter type "none"
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[pos++] = rgba[i];
      raw[pos++] = rgba[i + 1];
      raw[pos++] = rgba[i + 2];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolor, no alpha
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Verpakt een reeks PNG-buffers (elk vierkant, willekeurige grootte) in een
 * enkel .ico-bestand — het "PNG-in-ICO"-formaat dat sinds Windows Vista en
 * door alle huidige browsers wordt ondersteund voor favicon.ico. Behoudt
 * transparantie (elke PNG mag gerust een alfakanaal hebben, in
 * tegenstelling tot het iOS-appicoon hierboven).
 */
export function encodeIco(entries) {
  const count = entries.length;
  const dirEntries = [];
  const dataBufs = [];
  let offset = 6 + 16 * count;
  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // geen kleurenpalet
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    dataBufs.push(png);
    offset += png.length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);
  return Buffer.concat([header, ...dirEntries, ...dataBufs]);
}

/** Puur voor logging tijdens het genereren — geen functionele rol. */
export function shortHash(buf) {
  return createHash("sha1").update(buf).digest("hex").slice(0, 8);
}
