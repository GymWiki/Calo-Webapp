// Beheerrechten volgen de rol in de database (lib/auth/roles.ts, public.users.role); public.is_library_admin() in de database
// is gelijk aan public.is_admin(). Dit bestand blijft als dunne alias voor de bestaande kennisbank-/taalcheck-pagina's.
import { isAdmin } from "@/lib/auth/roles";

export const isLibraryAdmin = isAdmin;
