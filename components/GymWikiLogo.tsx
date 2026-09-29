import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Het GymWiki-beeldmerk (public/gymwiki-logo.png, zie scripts/
 * generate-favicons.mjs) — bevat zelf geen "GymWiki"-tekst, dus overal waar
 * voorheen alleen de tekst "GYMWIKI" stond wordt dat nu icoon + wordmark.
 * Draagt zijn eigen navy-achtergrondchip, dus werkt ongewijzigd op zowel
 * lichte als donkere paginasachtergronden (geen aparte dark-modevariant
 * nodig, zie de STAP1-beoordeling in de PR-samenvatting).
 */
export function GymWikiLogo({
  size = 28,
  href,
  showWordmark = true,
  wordmarkClassName,
  className,
}: {
  /** Iconformaat in px — schaal de wordmark-tekstgrootte er zelf bij via wordmarkClassName. */
  size?: number;
  /** Indien gezet, wordt het geheel een Link (meestal "/"). */
  href?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/gymwiki-logo.png"
        alt="GymWiki logo"
        width={size}
        height={size}
        className="shrink-0"
      />
      {showWordmark && (
        <span className={cn("font-display tracking-wide", wordmarkClassName)}>GymWiki</span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
