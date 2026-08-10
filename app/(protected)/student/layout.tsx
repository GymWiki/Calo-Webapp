import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (profile?.role !== "student") {
    redirect("/docent/dashboard");
  }

  return <>{children}</>;
}
