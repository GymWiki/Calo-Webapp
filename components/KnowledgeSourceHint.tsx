import Link from "next/link";

/**
 * Subtiel informatielabel bij de AI Lescoach / Activiteiten Generator: laat
 * zien op hoeveel actieve Kennisbank-bronnen (defaults + eigen uploads met
 * de toggle aan) de AI zich baseert, met een snelkoppeling naar /kennisbank
 * om dat aantal te wijzigen.
 */
export function KnowledgeSourceHint({ count }: { count: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      AI analyseert op basis van {count}{" "}
      {count === 1 ? "actieve bron" : "actieve bronnen"} in jouw Kennisbank ·{" "}
      <Link
        href="/kennisbank"
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        Beheer Kennisbank
      </Link>
    </p>
  );
}
