export type UserRole = "student" | "docent" | "admin";

export type UserProfile = {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  available_for_internship: boolean;
  email: string | null;
};
