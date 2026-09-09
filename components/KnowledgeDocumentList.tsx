"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Clock, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteKnowledgeDocument } from "@/actions/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/format";
import type { KnowledgeBaseDocumentWithUploader, KnowledgeStatus } from "@/types/knowledge";

const STATUS_CONFIG: Record<
  KnowledgeStatus,
  { label: string; icon: typeof Clock; variant: "secondary" | "success" | "destructive" }
> = {
  pending: { label: "Bezig met verwerken", icon: Clock, variant: "secondary" },
  processed: { label: "Verwerkt", icon: CircleCheck, variant: "success" },
  failed: { label: "Mislukt", icon: CircleX, variant: "destructive" },
};

function StatusBadge({ document }: { document: KnowledgeBaseDocumentWithUploader }) {
  const { label, icon: Icon, variant } = STATUS_CONFIG[document.status];

  return (
    <Badge variant={variant} title={document.error_message ?? undefined}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function KnowledgeDocumentList({
  documents,
  currentUserId,
}: {
  documents: KnowledgeBaseDocumentWithUploader[];
  currentUserId: string;
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
        <CardTitle>Geüploade documenten ({documents.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Nog geen documenten"
            description="Upload hierboven het eerste document zodat de AI-checker en -generator vakliteratuur kunnen raadplegen."
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
                  {document.description && (
                    <p className="text-sm text-muted-foreground">{document.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusBadge document={document} />
                    {document.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                    <span>Door {document.uploader_name}</span>
                    {formatDate(document.created_at) && (
                      <span>· {formatDate(document.created_at)}</span>
                    )}
                  </div>
                  {document.status === "failed" && document.error_message && (
                    <p className="text-xs text-destructive">{document.error_message}</p>
                  )}
                </div>
                {document.uploaded_by === currentUserId && (
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
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
