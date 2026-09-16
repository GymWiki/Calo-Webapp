"use client";

// Vangt een fout in de ROOT layout zelf op (app/layout.tsx) — een apart,
// veel zeldzamer geval dan app/(protected)/error.tsx hierboven, want de
// root layout doet geen databevragingen. Moet zijn eigen <html>/<body>
// leveren: dit VERVANGT letterlijk alles, dus hier kan de navigatiebalk
// per definitie niet behouden blijven (er is geen AppLayout meer om in te
// hangen) — maar zonder dit bestand zou zelfs déze fout Next's kale,
// onopgemaakte standaardpagina tonen in plaats van iets bruikbaars.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Er ging iets mis</h1>
          <p style={{ maxWidth: "24rem", color: "#666" }}>
            GymWiki kon niet geladen worden. Probeer het opnieuw.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Probeer opnieuw
          </button>
        </main>
      </body>
    </html>
  );
}
