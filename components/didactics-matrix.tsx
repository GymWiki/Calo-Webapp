import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_STYLES } from "@/lib/didactics-styles";
import { cn } from "@/lib/utils";
import {
  DIDACTIC_CATEGORIES,
  DIDACTIC_CATEGORY_LABELS,
  groupDidacticItemsByCategory,
  type DidacticItem,
} from "@/types/lesson";

/** Read-only 3-column "Loopt/Lukt/Leeft" matrix for the lesson detail pages. */
export function DidacticsMatrix({ items }: { items: DidacticItem[] }) {
  const grouped = groupDidacticItemsByCategory(items);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {DIDACTIC_CATEGORIES.map((category) => {
        const style = CATEGORY_STYLES[category];
        const categoryItems = grouped[category];

        return (
          <Card key={category} className={cn("overflow-hidden", style.border)}>
            <CardHeader className={cn("gap-0 py-3", style.header)}>
              <CardTitle className="text-base">
                {style.emoji} {DIDACTIC_CATEGORY_LABELS[category]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {categoryItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">-</p>
              ) : (
                categoryItems.map((item) => (
                  <div key={item.id} className="space-y-1 rounded-lg border p-2.5 text-sm">
                    {item.subTheme && (
                      <Badge variant="secondary">#{item.subTheme}</Badge>
                    )}
                    <p>
                      <span className="font-medium">Zie:</span> {item.observation}
                    </p>
                    <p>
                      <span className="font-medium">Doe:</span> {item.action}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
