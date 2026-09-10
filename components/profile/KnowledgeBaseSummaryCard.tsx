import Link from "next/link";
import { ArrowRight, Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Samenvattingskaart die doorlinkt naar de bestaande, gedeelde Kennisbank
 * (/kennisbank) — bewust geen eigen upload-UI hier: die bestaat al en is
 * bewust gedeeld (niet per gebruiker), zie lib/services/knowledge.ts.
 */
export function KnowledgeBaseSummaryCard({
  totalCount,
  processedCount,
}: {
  totalCount: number;
  processedCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Kennisbank</CardTitle>
        </div>
        <CardDescription>
          Documenten die de gedeelde Kennisbank vormen — context voor de AI
          Activiteitenchecker en Activiteitengenerator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totalCount === 0
            ? "Nog geen documenten geüpload."
            : `${processedCount} van ${totalCount} document${totalCount === 1 ? "" : "en"} verwerkt.`}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/kennisbank">
            Naar Kennisbank
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
