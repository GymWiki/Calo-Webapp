import { AppLayout } from "@/components/app-layout";

// Bewust GEEN await getCurrentUserProfile()/redirect hier meer (was er wel
// — zie git-historie): proxy.ts handhaaft de auth-gate al op elke protected
// route (redirect naar /login vóórdat Next.js deze layout zelfs bereikt),
// en elke page.tsx hieronder doet zijn eigen getCurrentUserProfile()-check.
// Een blokkerende await in een layout voorkomt dat Next.js een loading.tsx
// van een onderliggende pagina instant kan tonen — "Without Cache
// Components: Navigation blocks until the layout finishes rendering" (zie
// Next.js' loading.js-docs) — dus deze layout moet synchroon/statisch
// blijven zodat AppLayout (en daarmee de navigatiebalk) nooit op paginadata
// wacht.
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
