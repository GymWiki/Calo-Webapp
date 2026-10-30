import { notFound } from "next/navigation";

import { AppLayout } from "@/components/app-layout";

/** Testpagina (e2e/app-layout.spec.ts): het app-menu naast een zeer lange pagina. Bestaat alleen buiten productie of met E2E_HARNESS=1. */
export default function AppLayoutHarness() {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  return (
    <AppLayout>
      <div className="p-6" data-testid="lange-pagina" style={{ height: 4000 }}>
        <h1 className="text-lg font-semibold">Lange pagina</h1>
      </div>
    </AppLayout>
  );
}
