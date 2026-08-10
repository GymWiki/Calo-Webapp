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
    <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-4">
      {children}
    </main>
  );
}
