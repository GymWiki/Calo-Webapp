"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Collapsible({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="collapsible" data-state={open ? "open" : "closed"} className={className}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type === CollapsibleTrigger) {
          return React.cloneElement(
            child as React.ReactElement<CollapsibleTriggerProps>,
            { open, onOpenChange },
          );
        }
        if (child.type === CollapsibleContent) {
          return React.cloneElement(
            child as React.ReactElement<{ open: boolean }>,
            { open },
          );
        }
        return child;
      })}
    </div>
  );
}

type CollapsibleTriggerProps = {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function CollapsibleTrigger({
  children,
  className,
  open,
  onOpenChange,
}: CollapsibleTriggerProps) {
  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      aria-expanded={open}
      onClick={() => onOpenChange?.(!open)}
      className={cn(
        "flex w-full items-center justify-between gap-2 text-left",
        className,
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-brand",
          open && "rotate-180",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function CollapsibleContent({
  children,
  className,
  open,
}: {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
}) {
  if (!open) return null;
  return (
    <div data-slot="collapsible-content" className={cn("animate-fade-up", className)}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
