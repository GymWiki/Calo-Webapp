"use client";

import { useState } from "react";
import { BookOpen, Database } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";

type SourceGroup = {
  documentId: string;
  documentTitle: string;
  sourceLabel: string;
  sourceType: UsedKnowledgeChunk["sourceType"];
  fragments: UsedKnowledgeChunk[];
};

// Meerdere gebruikte chunks uit hetzelfde document horen visueel bij elkaar
// (bijv. 2 fragmenten uit "Leerlijnen en Kaders — Hoofdstuk 3") i.p.v. los
// per chunk-rij, zoals Stap 3/4 van de brief vragen ("uit welk pakket/
// document elk fragment komt").
function groupByDocument(chunks: UsedKnowledgeChunk[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  // Ontdubbelen op chunk_id: aanroepers combineren soms meerdere bronnen
  // (bijv. live gegenereerde chunks + al eerder gelogde DB-chunks) die
  // elkaar kunnen overlappen — zonder dit zou hetzelfde fragment twee keer
  // getoond worden én zou React een dubbele key-waarschuwing geven.
  const seenChunkIds = new Set<string>();
  for (const chunk of chunks) {
    if (seenChunkIds.has(chunk.chunkId)) continue;
    seenChunkIds.add(chunk.chunkId);

    const existing = groups.get(chunk.documentId);
    if (existing) {
      existing.fragments.push(chunk);
      continue;
    }
    groups.set(chunk.documentId, {
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      sourceLabel: chunk.sourceLabel,
      sourceType: chunk.sourceType,
      fragments: [chunk],
    });
  }
  return [...groups.values()];
}

function SourceGroupItem({ group }: { group: SourceGroup }) {
  const [open, setOpen] = useState(false);
  const Icon = group.sourceType === "knowledge_package" ? BookOpen : Database;

  return (
    <li className="rounded-lg border p-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{group.documentTitle}</span>
              <span className="block text-xs text-muted-foreground">
                {group.sourceLabel} ·{" "}
                {group.fragments.length === 1
                  ? "1 fragment"
                  : `${group.fragments.length} fragmenten`}
              </span>
            </span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2">
          {group.fragments.map((fragment) => (
            <blockquote
              key={fragment.chunkId}
              className="rounded-md border-l-2 border-primary/40 bg-muted/40 p-2.5 text-sm text-muted-foreground italic"
            >
              &ldquo;{fragment.content}&rdquo;
            </blockquote>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/**
 * Toont expliciet welke Kennisbank/Standaardbibliotheek-fragmenten de AI
 * daadwerkelijk gebruikte — gegroepeerd per brondocument, per document
 * uitklapbaar (niet standaard alles open, om de sectie compact te houden).
 * Herbruikt op de activiteit-detailpagina ("Gebruikte bronnen", uit de DB-
 * log), live na een AI-generatie (les-maken/lesson-form.tsx, vóór opslaan)
 * en in de AI Lescoach-sheet.
 */
export function UsedSourcesList({
  chunks,
  title = "Gebruikte bronnen",
  description,
}: {
  chunks: UsedKnowledgeChunk[];
  title?: string;
  description?: string;
}) {
  if (chunks.length === 0) return null;

  const groups = groupByDocument(chunks);

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">
          {description ??
            "Deze fragmenten uit de Kennisbank zijn daadwerkelijk gebruikt om dit te onderbouwen."}
        </p>
      </div>
      <ul className="space-y-2">
        {groups.map((group) => (
          <SourceGroupItem key={group.documentId} group={group} />
        ))}
      </ul>
    </div>
  );
}
