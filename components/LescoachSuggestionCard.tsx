"use client";

import { Check, Lightbulb, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DidacticSuggestion, LescoachSuggestion } from "@/types/ai";

/**
 * Losse, kleine suggestie-kaart voor een gewone (tekst/lijst-)sectie — zie
 * de brief "AI Lescoach": elke kaart hoort bij een specifieke sectie, geeft
 * een korte aanbeveling + reden, en laat de gebruiker 'm direct toepassen of
 * negeren. Niets wordt automatisch overschreven zonder deze expliciete
 * bevestiging.
 */
export function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: LescoachSuggestion;
  onApply: (suggestion: LescoachSuggestion) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="animate-fade-up space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="gap-1">
          <Lightbulb className="size-3" />
          {suggestion.type}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label="Negeren"
          onClick={() => onDismiss(suggestion.id)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <p className="text-sm font-medium">{suggestion.suggestion}</p>
      <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
      {suggestion.sourceLabel && (
        <p className="text-xs text-muted-foreground italic">Bron: {suggestion.sourceLabel}</p>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => onApply(suggestion)}>
        <Check className="size-3.5" />
        Toepassen
      </Button>
    </div>
  );
}

export function SuggestionCardList({
  suggestions,
  onApply,
  onDismiss,
}: {
  suggestions: LescoachSuggestion[];
  onApply: (suggestion: LescoachSuggestion) => void;
  onDismiss: (id: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onApply={onApply}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

/**
 * Leerhulp-variant-kaart: geen tekst-vervanging maar een kandidaat-item
 * ("Zie"/"Doe") voor de 3L's-lijst — "Toepassen" voegt 'm toe als los,
 * nieuw item (aanvullend op eventuele bestaande items, nooit een vervanging).
 */
export function DidacticSuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: DidacticSuggestion;
  onApply: (suggestion: DidacticSuggestion) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="animate-fade-up space-y-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="gap-1">
          <Lightbulb className="size-3" />
          AI-variant
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label="Negeren"
          onClick={() => onDismiss(suggestion.id)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <p className="text-sm">
        <span className="font-medium">Zie:</span> {suggestion.observation}
      </p>
      <p className="text-sm">
        <span className="font-medium">Doe:</span> {suggestion.action}
      </p>
      <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => onApply(suggestion)}>
        <Check className="size-3.5" />
        Toepassen
      </Button>
    </div>
  );
}

export function DidacticSuggestionCardList({
  suggestions,
  onApply,
  onDismiss,
}: {
  suggestions: DidacticSuggestion[];
  onApply: (suggestion: DidacticSuggestion) => void;
  onDismiss: (id: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => (
        <DidacticSuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onApply={onApply}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
