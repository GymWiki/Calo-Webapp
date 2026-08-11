"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { addKnowledgeDocument } from "@/actions/knowledge";
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
import { cn } from "@/lib/utils";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeCategory,
} from "@/types/knowledge";

const SELECT_CLASS =
  "border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const EMPTY_FORM = {
  title: "",
  author: "",
  category: "basisdocument" as KnowledgeCategory,
  content: "",
};

export function KnowledgeUploadForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await addKnowledgeDocument(form);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Document toegevoegd aan de Kennisbank.");
      setForm(EMPTY_FORM);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nieuw document toevoegen</CardTitle>
        <CardDescription>
          Plak de tekst van een boek, artikel of richtlijn. Deze wordt
          automatisch in stukken geknipt en doorzoekbaar gemaakt voor de AI
          Lescoach.
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
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Bijv. Game-Based Pedagogy"
                required
              />
            </div>
            <div>
              <Label htmlFor="kb-author">Auteur (optioneel)</Label>
              <Input
                id="kb-author"
                className="mt-1.5"
                value={form.author}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, author: event.target.value }))
                }
                placeholder="Bijv. Walinga & Koekoek"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="kb-category">Categorie</Label>
            <select
              id="kb-category"
              className={cn(SELECT_CLASS)}
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as KnowledgeCategory,
                }))
              }
            >
              {KNOWLEDGE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {KNOWLEDGE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="kb-content">Tekst</Label>
            <Textarea
              id="kb-content"
              className="mt-1.5 min-h-48"
              value={form.content}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, content: event.target.value }))
              }
              placeholder="Plak hier de volledige tekst van het document..."
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.content.length} tekens
            </p>
          </div>

          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            <Upload className="size-4" />
            {isPending ? "Verwerken..." : "Toevoegen aan Kennisbank"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
