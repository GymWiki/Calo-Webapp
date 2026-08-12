import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <Card className="w-full shadow-brand-lg">
      <CardHeader>
        <CardTitle className="text-xl">Account aanmaken</CardTitle>
        <CardDescription>
          Maak een GymWiki-account aan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Heb je al een account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Inloggen
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
