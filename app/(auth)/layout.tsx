import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (profile) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-paper p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        <div className="absolute top-10 -right-20 size-64 rotate-6 rounded-3xl border-4 border-cone/15 sm:size-80" />
        <div className="absolute -bottom-20 -left-16 size-56 -rotate-3 rounded-3xl border-4 border-line-blue/10 sm:size-72" />
      </div>

      <Link
        href="/"
        className="animate-fade-up font-display relative z-10 mb-8 text-2xl tracking-wide text-ink"
      >
        GYMBASE
      </Link>

      <div
        className="animate-fade-up relative z-10 w-full max-w-sm"
        style={{ animationDelay: "60ms" }}
      >
        {children}
      </div>
    </main>
  );
}
