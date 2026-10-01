// Node ESM resolve-hook die "@/..." (dit project se tsconfig.json-paths-alias,
// normaal alleen door Next.js'/webpack's bundler-resolutie begrepen) oplost
// naar een echt bestand onder de repo-root. Nodig omdat scripts/eval-import.mjs
// (zie daar) de ECHTE productiefuncties uit lib/ai/*.ts importeert via node's
// ingebouwde `--experimental-strip-types` i.p.v. een losse testimplementatie
// te schrijven — maar plain Node ESM kent geen tsconfig-paths en geen
// extensieloze imports. Dit bestand is bewust het enige stuk "build-achtige"
// machinerie hier: de rest van de importketen (lib/ai/openai-client.ts,
// lib/constants/learningLines.ts, types/activity.ts, types/lesson.ts) heeft
// zelf verder geen @/-imports nodig (geverifieerd), dus deze loader hoeft
// alleen platte "@/pad/naar/bestand" -> "<repo-root>/pad/naar/bestand.ts" op
// te lossen.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");

const CANDIDATE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const withoutAlias = specifier.slice(2);
    const basePath = path.join(projectRoot, withoutAlias);

    for (const ext of CANDIDATE_EXTENSIONS) {
      const candidate = `${basePath}${ext}`;
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }

    throw new Error(`path-alias-loader: kon "${specifier}" niet oplossen (geprobeerd: ${basePath}{${CANDIDATE_EXTENSIONS.join(",")}})`);
  }

  return nextResolve(specifier, context);
}
