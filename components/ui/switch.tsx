"use client";

import { cn } from "@/lib/utils";

function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors duration-150 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className,
      )}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-150 ease-brand",
          checked ? "translate-x-[22px]" : "translate-x-1",
        )}
      />
    </button>
  );
}

export { Switch };
