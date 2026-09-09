"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadKnowledgeDocument } from "@/actions/knowledge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Mode = "file" | "text";

const EMPTY_FORM = { title: "", description: "", tags: "", pastedText: "" };

export function KnowledgeUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("file");
  const [form, setForm] = useState(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);

  function resetForm() {
    setForm(EMPTY_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("title", form.title);
    formData.set("description", form.description);
    formData.set("tags", form.tags);

    if (mode === "file") {
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        toast.error("Kies een bestand om te uploaden.");
        return;
      }
      formData.set("file", file);
    } else {
      if (form.pastedText.trim().length < 50) {
        toast.error("Plak minimaal 50 tekens tekst.");
        return;
      }
      const blob = new Blob([form.pastedText], { type: "text/plain" });
      const fileName = `${form.title || "document"}.txt`;
      formData.set("file", new File([blob], fileName, { type: "text/plain" }));
    }

    setIsUploading(true);
    try {
      const result = await uploadKnowledgeDocument(formData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Document geüpload en verwerkt.");
      resetForm();
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document toevoegen</CardTitle>
        <CardDescription>
          Upload een PDF, Word-bestand of tekstbestand — of plak tekst rechtstreeks. Het
          document wordt automatisch verwerkt en is daarna beschikbaar als context voor de AI
          Activiteitenchecker en Activiteitengenerator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="kb-title">Titel</Label>
              <Input
                id="kb-title"
                className="mt-1.5"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Bijv. Game-Based Pedagogy"
                required
              />
            </div>
            <div>
              <Label htmlFor="kb-tags">Tags (optioneel, komma-gescheiden)</Label>
              <Input
                id="kb-tags"
                className="mt-1.5"
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Bijv. onderbouw, spel"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="kb-description">Beschrijving (optioneel)</Label>
            <Textarea
              id="kb-description"
              className="mt-1.5"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Korte omschrijving van dit document"
            />
          </div>

          <div className="flex overflow-hidden rounded-md border w-fit">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`min-h-9 px-3 py-2 text-xs font-medium transition-colors ${
                mode === "file" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
              }`}
            >
              Bestand uploaden
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`min-h-9 border-l px-3 py-2 text-xs font-medium transition-colors ${
                mode === "text" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
              }`}
            >
              Tekst plakken
            </button>
          </div>

          {mode === "file" ? (
            <div>
              <Label htmlFor="kb-file">Bestand (PDF, Word of tekst)</Label>
              <Input
                id="kb-file"
                type="file"
                ref={fileInputRef}
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="mt-1.5"
                required
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="kb-pasted-text">Tekst</Label>
              <Textarea
                id="kb-pasted-text"
                className="mt-1.5 min-h-48"
                value={form.pastedText}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, pastedText: event.target.value }))
                }
                placeholder="Plak hier de volledige tekst van het document..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.pastedText.length} tekens
              </p>
            </div>
          )}

          <Button type="submit" disabled={isUploading} className="w-full sm:w-auto">
            {isUploading ? (
              <>
                <FileText className="size-4 animate-pulse" />
                Verwerken...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Toevoegen aan Kennisbank
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
