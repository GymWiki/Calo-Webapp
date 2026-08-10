// Migrates the GymWiki activiteiten export into Supabase: downloads each
// activity's Firebase Storage image, re-uploads it to the
// "activiteiten-afbeeldingen" bucket, and upserts the activity row (with the
// new public image URL) into public.activiteiten, keyed on the source `id`.
//
// English-language rows (taalcode !== "nl") are skipped entirely, per spec.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... node --env-file=.env.local scripts/migrate-activiteiten.mjs
//   (or: npm run migrate:activiteiten, with SUPABASE_SERVICE_ROLE_KEY set)
//
// The service role key is required (bypasses RLS for the bulk upsert and
// storage upload) and is deliberately NOT stored in this repo — get it from
// Project Settings > API in the Supabase dashboard and export it yourself.
// Never commit it or expose it to the browser.
//
// Optional: DRY_RUN=true skips the Supabase storage upload and table upsert
// (still downloads every image, so it verifies the source data/network side
// without writing anything).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(
  __dirname,
  "..",
  "supabase",
  "data",
  "activiteiten-gymwiki-export.json",
);

const BUCKET = "activiteiten-afbeeldingen";
const TABLE = "activiteiten";
const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 750;
const DRY_RUN = process.env.DRY_RUN === "true";

const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text) {
  return (
    (text ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "activiteit"
  );
}

function extensionFromUrl(url) {
  try {
    const decodedPath = decodeURIComponent(new URL(url).pathname);
    const match = decodedPath.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function toDbRow(item, imageUrl) {
  return {
    id: item.id,
    titel: item.titel,
    actcode: item.actcode ?? null,
    afbeelding: imageUrl,
    beginsituatie: item.beginsituatie ?? null,
    beschrijving: item.beschrijving ?? null,
    categorie: item.categorie ?? null,
    beweegthema: item.beweegthema ?? null,
    created_time: item.createdtime?.seconds
      ? new Date(item.createdtime.seconds * 1000).toISOString()
      : null,
    doel: item.doel ?? null,
    in_gymwiki: item.in_gymwiki ?? true,
    leerlijn: item.leerlijn ?? null,
    loopt: item.loopt ?? null,
    lukt: item.lukt ?? null,
    leeft: item.leeft ?? null,
    niveau: item.niveau ?? null,
    materiaal: item.materiaal ?? null,
    onderwijs_type: item.onderwijs_type ?? null,
    veld: item.veld ?? null,
    regels: item.regels ?? null,
    taalcode: item.taalcode,
    doelgroep: item.Doelgroep ?? null,
    filters: item.filters ?? null,
  };
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download mislukt (HTTP ${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

async function migrateImage(item, supabase) {
  const { buffer, contentType } = await downloadImage(item.afbeelding);

  if (DRY_RUN) {
    return item.afbeelding;
  }

  const ext = extensionFromUrl(item.afbeelding) || MIME_EXTENSIONS[contentType] || "jpg";
  const objectPath = `${slugify(item.titel)}-${item.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`Upload naar storage mislukt: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  return publicUrl;
}

async function processItem(item, supabase) {
  const imageUrl = await migrateImage(item, supabase);

  if (DRY_RUN) {
    return;
  }

  const row = toDbRow(item, imageUrl);
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "id" });

  if (error) {
    throw new Error(`Upsert in database mislukt: ${error.message}`);
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || (!serviceRoleKey && !DRY_RUN)) {
    console.error(
      "Ontbrekende env vars. Zet NEXT_PUBLIC_SUPABASE_URL (staat al in .env.local) " +
        "en SUPABASE_SERVICE_ROLE_KEY (Project Settings > API in het Supabase " +
        "dashboard — nooit committen). Of run met DRY_RUN=true om alleen de " +
        "downloads te testen zonder Supabase-credentials.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

  const raw = await readFile(DATA_FILE, "utf-8");
  const allItems = JSON.parse(raw);
  const items = allItems.filter((item) => item.taalcode === "nl");

  console.log(
    `${allItems.length} rows gelezen, ${items.length} in het Nederlands ` +
      `(${allItems.length - items.length} Engelstalige rows overgeslagen).${DRY_RUN ? " [DRY RUN]" : ""}`,
  );

  const succeeded = [];
  const failed = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((item) => processItem(item, supabase)),
    );

    results.forEach((result, idx) => {
      const item = batch[idx];
      if (result.status === "fulfilled") {
        succeeded.push(item.id);
      } else {
        failed.push({
          id: item.id,
          titel: item.titel,
          reason: result.reason?.message ?? String(result.reason),
        });
      }
    });

    const done = Math.min(i + BATCH_SIZE, items.length);
    console.log(
      `${done}/${items.length} verwerkt (${succeeded.length} gelukt, ${failed.length} mislukt)`,
    );

    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log("\n=== Samenvatting ===");
  console.log(`Totaal (NL-only): ${items.length}`);
  console.log(`Succesvol: ${succeeded.length}`);
  console.log(`Mislukt: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nMislukte rows:");
    for (const f of failed) {
      console.log(`  - [${f.id}] ${f.titel}: ${f.reason}`);
    }
  }

  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("Onverwachte fout:", error);
  process.exitCode = 1;
});
