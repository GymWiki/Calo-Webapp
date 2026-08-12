"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  addPersonalKnowledgeDocument,
  deleteOwnKnowledgeDocument,
  toggleDocumentActive,
} from "@/actions/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import {
  KNOWLEDGE_CATEGORY_LABELS,
  type UserKnowledgeDocument,
} from "@/types/knowledge";

const EMPTY_UPLOAD_FORM = { title: "", content: "" };

function DocumentToggleRow({
  document,
  isActive,
  isPending,
  onToggle,
  onDelete,
}: {
  document: UserKnowledgeDocument;
  isActive: boolean;
  isPending: boolean;
  onToggle: (checked: boolean) => void;
  onDelete?: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 space-y-1.5">
        <p className="truncate font-medium">{document.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">
            {KNOWLEDGE_CATEGORY_LABELS[document.category]}
          </Badge>
          <span>
            · {document.chunk_count}{" "}
            {document.chunk_count === 1 ? "chunk" : "chunks"}
          </span>
          {formatDate(document.created_at) && (
            <span>· {formatDate(document.created_at)}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Verwijderen"
            disabled={isPending}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Switch
          checked={isActive}
          onCheckedChange={onToggle}
          disabled={isPending}
          aria-label={`${document.title} ${isActive ? "actief" : "inactief"}`}
        />
      </div>
    </li>
  );
}

/**
 * User-facing Kennisbank: Sectie 1 (standaard vakliteratuur, toggle-only)
 * and Sectie 2 (eigen uploads: toevoegen, toggle, verwijderen). Toggles are
 * optimistic — `activeOverrides` reflects the click immediately and only
 * reverts if the server action reports an error; deletes hide the row via
 * `deletedIds` the same way, then confirm with a router.refresh().
 */
export function UserKnowledgeSections({
  defaultDocuments,
  ownDocuments,
}: {
  defaultDocuments: UserKnowledgeDocument[];
  ownDocuments: UserKnowledgeDocument[];
}) {
  const router = useRouter();
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [form, setForm] = useState(EMPTY_UPLOAD_FORM);

  function setPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function resolveActive(document: UserKnowledgeDocument) {
    return activeOverrides[document.id] ?? document.is_active;
  }

  async function handleToggle(document: UserKnowledgeDocument, nextActive: boolean) {
    const previous = resolveActive(document);
    setActiveOverrides((prev) => ({ ...prev, [document.id]: nextActive }));
    setPending(document.id, true);

    const result = await toggleDocumentActive({
      documentId: document.id,
      isActive: nextActive,
    });

    if ("error" in result) {
      setActiveOverrides((prev) => ({ ...prev, [document.id]: previous }));
      toast.error(result.error);
    }
    setPending(document.id, false);
  }

  async function handleDelete(document: UserKnowledgeDocument) {
    setDeletedIds((prev) => new Set(prev).add(document.id));
    setPending(document.id, true);

    const result = await deleteOwnKnowledgeDocument(document.id);

    if ("error" in result) {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(document.id);
        return next;
      });
      toast.error(result.error);
      setPending(document.id, false);
      return;
    }

    toast.success(`"${document.title}" verwijderd uit je Kennisbank.`);
    router.refresh();
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);

    addPersonalKnowledgeDocument(form)
      .then((result) => {
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Document toegevoegd aan je Kennisbank.");
        setForm(EMPTY_UPLOAD_FORM);
        router.refresh();
      })
      .finally(() => setIsUploading(false));
  }

  const visibleOwnDocuments = ownDocuments.filter(
    (document) => !deletedIds.has(document.id),
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Standaard vakliteratuur</CardTitle>
          <CardDescription>
            Gedeelde bronnen voor alle gebruikers. Zet een bron uit om die
            tijdelijk niet te laten meewegen in AI-antwoorden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {defaultDocuments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nog geen standaard vakliteratuur"
              description="Er zijn nog geen documenten toegevoegd aan de gedeelde Kennisbank."
            />
          ) : (
            <ul className="space-y-2">
              {defaultDocuments.map((document) => (
                <DocumentToggleRow
                  key={document.id}
                  document={document}
                  isActive={resolveActive(document)}
                  isPending={pendingIds.has(document.id)}
                  onToggle={(checked) => handleToggle(document, checked)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mijn uploads</CardTitle>
          <CardDescription>
            Eigen lesplannen, stagescripts of artikelen. Plak de tekst — die
            wordt automatisch doorzoekbaar gemaakt voor de AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            onSubmit={handleUpload}
            className="space-y-4 rounded-xl border border-dashed p-4"
          >
            <div>
              <Label htmlFor="own-kb-title">Titel</Label>
              <Input
                id="own-kb-title"
                className="mt-1.5"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Bijv. Mijn stageverslag zwemmen"
                required
              />
            </div>
            <div>
              <Label htmlFor="own-kb-content">Tekst</Label>
              <Textarea
                id="own-kb-content"
                className="mt-1.5 min-h-40"
                value={form.content}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder="Plak hier de volledige tekst..."
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.content.length} tekens
              </p>
            </div>
            <Button type="submit" disabled={isUploading} className="w-full sm:w-auto">
              <Upload className="size-4" />
              {isUploading ? "Verwerken..." : "+ Document toevoegen"}
            </Button>
          </form>

          {visibleOwnDocuments.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="Nog geen eigen documenten"
              description="Upload hierboven je eerste document."
            />
          ) : (
            <ul className="space-y-2">
              {visibleOwnDocuments.map((document) => (
                <DocumentToggleRow
                  key={document.id}
                  document={document}
                  isActive={resolveActive(document)}
                  isPending={pendingIds.has(document.id)}
                  onToggle={(checked) => handleToggle(document, checked)}
                  onDelete={() => handleDelete(document)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
