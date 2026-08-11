"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteKnowledgeDocument } from "@/actions/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/format";
import {
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeDocumentWithChunkCount,
} from "@/types/knowledge";

export function KnowledgeDocumentList({
  documents,
}: {
  documents: KnowledgeDocumentWithChunkCount[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string, title: string) {
    startTransition(async () => {
      const result = await deleteKnowledgeDocument(id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`"${title}" verwijderd uit de Kennisbank.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documenten in de Kennisbank ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Nog geen documenten"
            description="Voeg hierboven het eerste document toe zodat de AI Lescoach vakliteratuur kan raadplegen."
          />
        ) : (
          <ul className="space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1.5">
                  <p className="truncate font-medium">{document.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {KNOWLEDGE_CATEGORY_LABELS[document.category]}
                    </Badge>
                    {document.author && <span>{document.author}</span>}
                    <span>
                      · {document.chunk_count}{" "}
                      {document.chunk_count === 1 ? "chunk" : "chunks"}
                    </span>
                    {formatDate(document.created_at) && (
                      <span>· {formatDate(document.created_at)}</span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Verwijderen"
                  disabled={isPending}
                  onClick={() => handleDelete(document.id, document.title)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
