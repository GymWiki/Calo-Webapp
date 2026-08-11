import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();

  if (profile?.role === "admin") {
    redirect("/admin/kennisbank");
  }

  redirect(profile?.role === "docent" ? "/docent/dashboard" : "/student/dashboard");
}
