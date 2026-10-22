import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

/**
 * Puur semantische HTML (nav > ol > li), geen client-JS nodig — gebruikt op
 * de publieke, niet-ingelogde SEO-pagina's (/activiteiten/[slug],
 * /leerlijn/[leerlijn], /groep/[groep]). De bijbehorende BreadcrumbList
 * JSON-LD wordt per pagina apart gerenderd, naast dit zichtbare kruimelpad.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Kruimelpad" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden="true" className="text-muted-foreground/60">
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
