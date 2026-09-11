"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
  Package,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  createKnowledgePackage,
  deleteKnowledgePackage,
  deleteKnowledgePackageDocument,
  reprocessKnowledgePackageDocument,
  setKnowledgePackageActive,
  uploadKnowledgePackageDocument,
} from "@/actions/knowledgePackages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type {
  KnowledgePackageDocument,
  KnowledgePackageWithDocuments,
  PackageProcessingStatus,
} from "@/types/knowledgePackages";

const STATUS_CONFIG: Record<
  PackageProcessingStatus,
  { label: string; icon: typeof Clock; variant: "secondary" | "success" | "destructive" }
> = {
  pending: { label: "Wachtend", icon: Clock, variant: "secondary" },
  processing: { label: "Bezig met verwerken", icon: Loader2, variant: "secondary" },
  processed: { label: "Verwerkt", icon: CircleCheck, variant: "success" },
  failed: { label: "Mislukt", icon: CircleX, variant: "destructive" },
};

function DocumentStatusBadge({ document }: { document: KnowledgePackageDocument }) {
  const { label, icon: Icon, variant } = STATUS_CONFIG[document.processing_status];
  return (
    <Badge variant={variant} title={document.error_message ?? undefined}>
      <Icon className={document.processing_status === "processing" ? "size-3 animate-spin" : "size-3"} />
      {label}
    </Badge>
  );
}

function NewPackageForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createKnowledgePackage(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Pakket aangemaakt.");
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nieuw pakket</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pkg-name">Naam</Label>
            <Input
              id="pkg-name"
              name="name"
              className="mt-1.5"
              placeholder="Bijv. Athletic Skills Model"
              required
            />
          </div>
          <div>
            <Label htmlFor="pkg-description">Beschrijving (optioneel)</Label>
            <Textarea
              id="pkg-description"
              name="description"
              className="mt-1.5"
              placeholder="Korte omschrijving voor gebruikers in de Standaardbibliotheek-tab"
            />
          </div>
          <div>
            <Label htmlFor="pkg-attribution">Bronvermelding (optioneel)</Label>
            <Input
              id="pkg-attribution"
              name="sourceAttribution"
              className="mt-1.5"
              placeholder="Bijv. © Athletic Skills Model, gebruikt met toestemming van ..."
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Bezig..." : "Pakket aanmaken"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Altijd zichtbare, standalone upload-sectie — los van een specifieke
 * pakketkaart, zodat er sowieso een duidelijke "document uploaden"-knop op
 * de pagina staat i.p.v. verstopt binnen een pakket dat je eerst moet
 * hebben aangemaakt. Kiest het pakket via een dropdown; zonder pakketten
 * is het formulier uitgeschakeld met een duidelijke hint.
 */
function UploadDocumentForm({ packages }: { packages: KnowledgePackageWithDocuments[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const hasPackages = packages.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Kies een bestand om te uploaden.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadKnowledgePackageDocument(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Document geüpload en verwerkt.");
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Document uploaden</CardTitle>
      </CardHeader>
      <CardContent>
        {hasPackages ? (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="doc-package">Pakket</Label>
              <select
                id="doc-package"
                name="packageId"
                required
                className="border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="doc-title">Titel</Label>
              <Input
                id="doc-title"
                name="title"
                className="mt-1.5"
                placeholder="Bijv. Hoofdstuk 3 — Motorisch leren"
                required
              />
            </div>
            <div>
              <Label htmlFor="doc-file">Bestand (PDF, Word of tekst)</Label>
              <Input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="mt-1.5"
                required
              />
            </div>
            <Button type="submit" disabled={isPending}>
              <Upload className="size-4" />
              {isPending ? "Bezig met verwerken..." : "Document uploaden"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Maak hierboven eerst een pakket aan — een document hoort altijd bij een pakket.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentRow({ document }: { document: KnowledgePackageDocument }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleReprocess() {
    startTransition(async () => {
      const result = await reprocessKnowledgePackageDocument(document.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Opnieuw verwerkt.");
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteKnowledgePackageDocument(document.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${document.title}" verwijderd.`);
      router.refresh();
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{document.title}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <DocumentStatusBadge document={document} />
          <span>{document.file_type.split("/").pop()}</span>
          {formatDate(document.created_at) && <span>· {formatDate(document.created_at)}</span>}
        </div>
        {document.processing_status === "failed" && document.error_message && (
          <p className="text-xs text-destructive">{document.error_message}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {document.processing_status === "failed" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Opnieuw verwerken"
            disabled={isPending}
            onClick={handleReprocess}
          >
            <RefreshCw className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Verwijderen"
          disabled={isPending}
          onClick={handleDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function PackageCard({ pkg }: { pkg: KnowledgePackageWithDocuments }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggleActive(nextActive: boolean) {
    startTransition(async () => {
      const result = await setKnowledgePackageActive(pkg.id, nextActive);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDeletePackage() {
    startTransition(async () => {
      const result = await deleteKnowledgePackage(pkg.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pakket "${pkg.name}" verwijderd.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Package className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <CardTitle className="text-base">{pkg.name}</CardTitle>
              {pkg.description && (
                <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
              )}
              {pkg.source_attribution && (
                <p className="mt-1 text-xs text-muted-foreground italic">
                  Bron: {pkg.source_attribution}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor={`active-${pkg.id}`} className="text-xs text-muted-foreground">
              {pkg.is_active ? "Actief" : "Inactief"}
            </Label>
            <Switch
              id={`active-${pkg.id}`}
              checked={pkg.is_active}
              disabled={isPending}
              onCheckedChange={handleToggleActive}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Pakket verwijderen"
              disabled={isPending}
              onClick={handleDeletePackage}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pkg.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nog geen documenten in dit pakket — upload er een via &ldquo;Document
            uploaden&rdquo; hierboven.
          </p>
        ) : (
          <ul className="space-y-2">
            {pkg.documents.map((document) => (
              <DocumentRow key={document.id} document={document} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function KnowledgeLibraryAdmin({
  packages,
}: {
  packages: KnowledgePackageWithDocuments[];
}) {
  const [showNewForm, setShowNewForm] = useState(packages.length === 0);

  return (
    <div className="space-y-6">
      {showNewForm ? (
        <NewPackageForm />
      ) : (
        <Button type="button" variant="outline" onClick={() => setShowNewForm(true)}>
          + Nieuw pakket
        </Button>
      )}

      <UploadDocumentForm packages={packages} />

      {packages.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nog geen pakketten"
          description="Maak hierboven het eerste pakket aan en upload er documenten in."
        />
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
