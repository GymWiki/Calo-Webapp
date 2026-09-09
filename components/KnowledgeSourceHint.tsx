import Link from "next/link";

/**
 * Subtiel informatielabel bij de AI Lescoach / Activiteiten Generator: laat
 * zien op hoeveel verwerkte Kennisbank-documenten de AI zich baseert (de
 * hele, gedeelde Kennisbank — geen per-gebruiker toggle meer), met een
 * snelkoppeling naar /kennisbank om zelf een document toe te voegen.
 */
export function KnowledgeSourceHint({ count }: { count: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      AI baseert zich op {count} {count === 1 ? "bron" : "bronnen"} in de Kennisbank ·{" "}
      <Link
        href="/kennisbank"
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        Kennisbank bekijken
      </Link>
    </p>
  );
}
