import { studentModels } from "@/lib/students/catalog";
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
  model("springplank_test", "Springplank test", "toestellen", "springtoestellen", ["turnen"], [1.2, 0.6, 0.25], "#15803d"),
  model("evenwichtsbalk_test", "Evenwichtsbalk test", "toestellen", "balken", ["turnen"], [3, 0.2, 0.2], "#be123c"),
  model("turnkast_test", "Turnkast test", "toestellen", "kasten", ["turnen"], [1.4, 0.8, 1.1], "#a16207"),
  model("korfbalpaal_test", "Korfbalpaal test", "doelen_netten", null, ["korfbal"], [0.4, 0.4, 3.5], "#2563eb"),
  // Zelfde slug als het echte asset (bevestigingspunten komen uit anchors.generated.ts: een paal met een gele korf, touwpunt op de paal onder de korf).
  // Grote testmaten, zodat een sleepbeweging het item altijd raakt; de anchor hangt alleen van de slug af.
  model("korfbalpaal_compleet_250", "Paal met korf (anchor-test)", "doelen_netten", null, ["korfbal"], [5, 4, 2.5], "#eab308"),
  // Zelfde slug als het echte asset (botsingsregels en vorm komen van de slug): net met palen, 10,85 m breed.
  model("volleybal_veldopstelling_compleet_dames", "Volleybalopstelling (test)", "doelen_netten", null, ["volleybal"], [10.85, 0.16, 3.04], "#0ea5e9"),
  // Zelfde slugs als de echte assets (families: lib/constants/itemFamilies.ts) met de echte maten; de kaart en het maatmenu hangen van de slug af.
  model("turnkast_2_delig", "Turnkast 2 delig", "toestellen", "kasten", ["turnen"], [1.42, 0.616, 0.515], "#a16207"),
  model("turnkast_4_delig", "Turnkast 4 delig", "toestellen", "kasten", ["turnen"], [1.421, 0.781, 0.935], "#a16207"),
  model("turnkast_6_delig_1_recht", "Turnkast 6 delig", "toestellen", "kasten", ["turnen"], [1.55, 0.864, 1.355], "#a16207"),
  model("basketbal_maat_5", "Basketbal maat 5", "ballen", "basketbal", ["basketbal"], [0.22, 0.22, 0.22], "#ea580c"),
  model("basketbal_maat_7", "Basketbal maat 7", "ballen", "basketbal", ["basketbal"], [0.239, 0.239, 0.239], "#c2410c"),
  model("dodgeball_vinyl_blauw", "Dodgeball vinyl blauw", "ballen", "trefbal", ["trefbal"], [0.178, 0.178, 0.178], "#2563eb"),
  model("dodgeball_vinyl_rood", "Dodgeball vinyl rood", "ballen", "trefbal", ["trefbal"], [0.178, 0.178, 0.178], "#dc2626"),
  model("pion_test", "Pion test", "klein_materiaal", "afzetten", ["algemeen"], [0.3, 0.3, 0.3], "#f97316"),
  model("kettlebell_test", "Kettlebell test", "fitness", null, ["fitness"], [0.25, 0.2, 0.3], "#0891b2"),
  model("ballenkar_test", "Ballenkar test", "opslag_karren", null, ["algemeen"], [1, 0.7, 1], "#64748b"),
  model("leerling_test", "Leerling test", "personen", null, ["algemeen"], [0.5, 0.4, 1.4], "#db2777"),
  // Leerling-poses als gekleurde dozen op de echte maten (zonder GLB of netwerk).
  ...studentModels("").map((student) => ({ ...student, model_url: "", preview_url: "", devColor: "#db2777" })),
];
