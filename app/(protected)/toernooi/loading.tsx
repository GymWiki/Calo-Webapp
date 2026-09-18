import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function ToernooiLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl">
      <PageHeader
        eyebrow="Toernooi Generator"
        title="Genereer een speelschema"
        description="Stel je teams en velden in en krijg binnen een minuut een eerlijk, gebalanceerd wedstrijdschema."
      />
      <Skeleton className="h-96 w-full rounded-xl" />
    </main>
  );
}
