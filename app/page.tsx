import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">GymBase</h1>
      <p className="max-w-md text-muted-foreground">
        Het platform voor CALO-studenten en vakdocenten lichamelijke opvoeding.
      </p>
      <Link
        href="/dashboard"
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
      >
        Naar dashboard
      </Link>
    </main>
  );
}
