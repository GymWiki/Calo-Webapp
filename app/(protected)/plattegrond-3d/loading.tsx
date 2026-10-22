import { Loader2 } from "lucide-react";

export default function Plattegrond3dLoading() {
  return (
    <div className="flex h-[100dvh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Plattegrond laden...
    </div>
  );
}
