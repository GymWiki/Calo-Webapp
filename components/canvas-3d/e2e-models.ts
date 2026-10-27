import type { MaterialModel } from "@/types/materialModel";

// Vaste testmodellen voor de Playwright-tests (e2e/*.spec.ts): gekleurde dozen (`devColor`),
// dus zonder Supabase, netwerk of GLB's. Grote afmetingen, zodat een tik of sleepbeweging in de
// testbrowser het item altijd raakt. Alleen gebruikt door app/e2e/plattegrond-3d (niet in productie).
function model(
  slug: string,
  naam: string,
  categorie: string,
  subgroep: string | null,
  sporten: string[],
  dims: [number, number, number],
  devColor: string,
): MaterialModel {
  return {
    id: `e2e-${slug}`,
    slug,
    material_id: null,
    naam,
    categorie,
    subgroep,
    sporten,
    tags: [],
    model_url: "",
    preview_url: "",
    length_m: dims[0],
    width_m: dims[1],
    height_m: dims[2],
    stackable: true,
    sort_order: 0,
    devColor,
  };
}

export const E2E_MODELS: MaterialModel[] = [
  model("testmat_groot", "Testmat groot", "matten", null, ["turnen"], [6, 4, 0.3], "#7c3aed"),
  model("basketbal_test", "Basketbal test", "ballen", "basketbal", ["basketbal"], [0.24, 0.24, 0.24], "#ea580c"),
  model("voetbal_test", "Voetbal test", "ballen", "voetbal", ["voetbal"], [0.22, 0.22, 0.22], "#f1f5f9"),
  model("turnbank_test", "Turnbank test", "toestellen", "banken", ["turnen"], [3, 0.4, 0.5], "#b45309"),
  model("turnkast_test", "Turnkast test", "toestellen", "kasten", ["turnen"], [1.4, 0.8, 1.1], "#a16207"),
  model("korfbalpaal_test", "Korfbalpaal test", "doelen_netten", null, ["korfbal"], [0.4, 0.4, 3.5], "#2563eb"),
  model("pion_test", "Pion test", "klein_materiaal", "afzetten", ["algemeen"], [0.3, 0.3, 0.3], "#f97316"),
  model("kettlebell_test", "Kettlebell test", "fitness", null, ["fitness"], [0.25, 0.2, 0.3], "#0891b2"),
  model("ballenkar_test", "Ballenkar test", "opslag_karren", null, ["algemeen"], [1, 0.7, 1], "#64748b"),
  model("leerling_test", "Leerling test", "personen", null, ["algemeen"], [0.5, 0.4, 1.4], "#db2777"),
];
