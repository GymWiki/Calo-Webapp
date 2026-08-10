"use client";

import { useEffect, useState } from "react";
import { ImageUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DrawingUploadPlaceholder() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tekening van het arrangement</CardTitle>
        <CardDescription>
          Upload een foto of schets van de opstelling (nog niet opgeslagen —
          binnenkort beschikbaar).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label
          htmlFor="drawing-upload"
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:bg-accent/50"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Voorbeeld van de tekening"
              className="max-h-40 rounded-md object-contain p-2"
            />
          ) : (
            <>
              <ImageUp className="size-6" />
              <span className="text-sm">Klik om een tekening te kiezen</span>
            </>
          )}
        </label>
        <input
          id="drawing-upload"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
