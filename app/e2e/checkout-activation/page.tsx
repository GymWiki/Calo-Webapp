import { notFound } from "next/navigation";

import { CheckoutActivation } from "@/components/subscription/CheckoutActivation";

/** Testpagina voor e2e/checkout-activation.spec.ts. Bestaat alleen buiten productie of met E2E_HARNESS=1. */
export default function CheckoutActivationHarness({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  return <HarnessInner searchParams={searchParams} />;
}

async function HarnessInner({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return (
    <main className="mx-auto max-w-xl p-6">
      <CheckoutActivation sessionId={session_id ?? null} />
    </main>
  );
}
