// Side-effect-only module — MOET als eerste import in elk bestand staan dat
// (transitief) "pdf-parse" importeert (zie documentText.ts), vóór de
// "pdf-parse"-import zelf. ES-modules evalueren imports in de volgorde
// waarin ze in het bestand staan, dus deze polyfill staat gegarandeerd al
// klaar tegen de tijd dat pdfjs-dist wordt geladen.
//
// Waarom dit nodig is: pdfjs-dist's Node-build (via pdf-parse) probeert bij
// het laden altijd `globalThis.DOMMatrix` te polyfillen via het optionele,
// native @napi-rs/canvas-pakket. Op Vercel wordt dat pakket echter niet
// betrouwbaar meegebundeld — het wordt diep in pdfjs-dist dynamisch
// gerequire't, wat Vercel's file-tracer kan missen — met als gevolg
// "ReferenceError: DOMMatrix is not defined" bij élke import van pdf-parse
// (dus ook bij server actions die pdf-parse alleen transitief meeslepen,
// zoals het aanmaken van een Standaardbibliotheek-pakket, dat zelf geen PDF
// aanraakt maar in dezelfde "use server"-module staat als de
// documentverwerking).
//
// De fix: DOMMatrix hier zelf, vooraf, met een lichte pure-JS polyfill
// (geen native binary, dus geen bundel-/tracing-problemen) op de global
// zetten. pdfjs-dist's eigen `if (!globalThis.DOMMatrix)`-check ziet 'm dan
// al staan en slaat de native-canvas-poging (en dus de crash) volledig
// over. We gebruiken uitsluitend extractDocumentText()/getText() — nooit
// canvas-rendering — dus de matrix-wiskunde van deze polyfill hoeft nergens
// pixel-perfect te zijn; hij moet alleen bestaan.
import DOMMatrixPolyfill from "dommatrix";

if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = DOMMatrixPolyfill;
}
