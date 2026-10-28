import { BeheerNav } from "@/components/beheer/BeheerNav";
import { requireAdminPage } from "@/lib/auth/admin";

// Alles onder /beheer is alleen voor beheerders (rol admin/owner uit de database): wie dat niet is krijgt een 404, ook als de
// UI wordt omzeild. Anonieme bezoekers worden eerder al door proxy.ts naar /login gestuurd. Elke pagina en actie controleert
// de rol daarnaast zelf, en RLS is de echte grens.
export default async function BeheerLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <>
      <BeheerNav />
      {children}
    </>
  );
}
