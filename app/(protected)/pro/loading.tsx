import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// De echte pagina heeft twee varianten (actief abonnement vs. aanbod) die
// pas na getCurrentUserProfile() bekend zijn — deze skeleton benadert de
// gemeenschappelijke vorm (titelblok + één kaart).
export default function ProLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader eyebrow="Abonnement" title="Volledige toegang zonder bijdrage-eis" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </main>
  );
}
