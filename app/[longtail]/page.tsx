import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuestPageShell } from "@/components/guest/GuestPageShell";
import { Button } from "@/components/ui/button";
import { GUEST_TOOL_PATH, SITE_URL } from "@/lib/guest/constants";
import { LONGTAIL_PAGES, getLongtailPage } from "@/lib/guest/longtail-pages";
import { TOOL_URL } from "@/lib/guest/seo-content";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return LONGTAIL_PAGES.map((page) => ({ longtail: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ longtail: string }> }): Promise<Metadata> {
  const page = getLongtailPage((await params).longtail);
  if (!page) return {};
  const url = `${SITE_URL}/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description: page.description, url, siteName: "GymWiki", locale: "nl_NL", type: "article" },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

export default async function LongtailPage({ params }: { params: Promise<{ longtail: string }> }) {
  const page = getLongtailPage((await params).longtail);
  if (!page) notFound();
  const url = `${SITE_URL}/${page.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "GymWiki", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Gratis 3D-plattegrond maken", item: TOOL_URL },
          { "@type": "ListItem", position: 3, name: page.h1, item: url },
        ],
      },
    ],
  };

  return (
    <GuestPageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <article className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-8">
        <nav aria-label="Kruimelpad" className="mb-4 text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="underline-offset-2 hover:underline">GymWiki</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={GUEST_TOOL_PATH} className="underline-offset-2 hover:underline">Gratis 3D-plattegrond maken</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{page.h1}</li>
          </ol>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.h1}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{page.intro}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href={`${GUEST_TOOL_PATH}#voorbeeld=${page.voorbeeld}`}>Open dit voorbeeld in de gratis editor</Link>
        </Button>

        {page.secties.map((sectie) => (
          <section key={sectie.h2} className="mt-10">
            <h2 className="text-2xl font-bold">{sectie.h2}</h2>
            {sectie.tekst.map((alinea) => (
              <p key={alinea} className="mt-3 text-muted-foreground">{alinea}</p>
            ))}
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Tips</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            {page.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Veelgestelde vragen</h2>
          <dl className="mt-3 divide-y rounded-2xl border bg-card">
            {page.faq.map((item) => (
              <div key={item.question} className="p-5">
                <dt className="font-semibold">{item.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">
          Bekijk ook de <Link href={GUEST_TOOL_PATH} className="font-medium text-primary underline-offset-2 hover:underline">gratis 3D-plattegrondeditor</Link> voor
          meer voorbeelden.
        </p>
      </article>
    </GuestPageShell>
  );
}
