"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { testLescoachQuery } from "@/actions/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type LescoachResult = {
  answer: string;
  sources: { title: string; similarity: number }[];
};

export function LescoachTestPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LescoachResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const response = await testLescoachQuery({ query });

      if ("error" in response) {
        toast.error(response.error);
        return;
      }

      setResult({ answer: response.answer, sources: response.sources });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5" />
          Test de AI Lescoach
        </CardTitle>
        <CardDescription>
          Stel een didactische vraag om te controleren of de retriever de
          juiste fragmenten uit de Kennisbank vindt en gebruikt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bijv. Hoe geef ik feedback op een leerling die afhaakt bij een doelspel?"
            className="min-h-24"
          />
          <Button
            type="submit"
            disabled={isPending || query.trim().length < 3}
          >
            <Sparkles className="size-4" />
            {isPending ? "Bezig..." : "Vraag de AI Lescoach"}
          </Button>
        </form>

        {result && (
          <div className="animate-fade-up space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm whitespace-pre-wrap">{result.answer}</p>
            {result.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t pt-3">
                {result.sources.map((source, index) => (
                  <Badge key={`${source.title}-${index}`} variant="outline">
                    {source.title} · {(source.similarity * 100).toFixed(0)}%
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
