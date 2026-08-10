import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { UserProfile } from "@/lib/types";

export const getCurrentUserProfile = cache(
  async (): Promise<UserProfile | null> => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("users")
      .select(
        "id, role, first_name, last_name, avatar_url, available_for_internship",
      )
      .eq("id", user.id)
      .single();

    if (!profile) {
      return null;
    }

    return { ...profile, email: user.email ?? null } as UserProfile;
  },
);
