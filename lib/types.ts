export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  available_for_internship: boolean;
  is_pro: boolean;
  xp: number;
  email: string | null;
};
