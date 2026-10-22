import type { MaterialModel } from "@/types/materialModel";

// Dev-only placeholders (zie Stap 5 van de brief): zolang materiaal-import/
// leeg is en material_models dus geen rijen heeft, toont de 3D-editor deze
// 3 gekleurde dozen i.p.v. een volledig lege materiaalkeuze — zodat slepen/
// draaien/stapelen/opslaan te testen zijn zonder echte GLB/PNG-bestanden.
// NOOIT gebruikt in productie: Floorplan3dEditorLoader.tsx geeft deze
// alleen door wanneer `process.env.NODE_ENV === "development"` ÉN de
// server-side opgehaalde material_models-lijst leeg is.
export const DEV_PLACEHOLDER_MODELS: MaterialModel[] = [
  {
    id: "dev-kast",
    slug: "__dev_kast",
    material_id: null,
    naam: "(Dev) Kast",
    categorie: "dev-placeholders",
    model_url: "",
    preview_url: "",
    length_m: 1.42,
    width_m: 0.83,
    height_m: 1.35,
    stackable: true,
    sort_order: 0,
    devColor: "#b45309", // amber-700, houtkleur
  },
  {
    id: "dev-mat",
    slug: "__dev_mat",
    material_id: null,
    naam: "(Dev) Mat",
    categorie: "dev-placeholders",
    model_url: "",
    preview_url: "",
    length_m: 3,
    width_m: 2,
    height_m: 0.3,
    stackable: true,
    sort_order: 1,
    devColor: "#2563eb", // blue-600, turnmat-blauw
  },
  {
    id: "dev-bank",
    slug: "__dev_bank",
    material_id: null,
    naam: "(Dev) Bank",
    categorie: "dev-placeholders",
    model_url: "",
    preview_url: "",
    length_m: 3.6,
    width_m: 0.27,
    height_m: 0.32,
    stackable: true,
    sort_order: 2,
    devColor: "#78716c", // stone-500, Zweedse bank-houtkleur
  },
];
