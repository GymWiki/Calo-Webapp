export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
