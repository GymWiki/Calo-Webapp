import { redirect } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return <AppLayout>{children}</AppLayout>;
}
