import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function DocentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (profile?.role === "admin") {
    redirect("/admin/kennisbank");
  }

  if (profile?.role !== "docent") {
    redirect("/student/dashboard");
  }

  return <>{children}</>;
}
