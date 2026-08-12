import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Card className="w-full shadow-brand-lg">
      <CardHeader>
        <CardTitle className="text-xl">Inloggen</CardTitle>
        <CardDescription>Log in om verder te gaan naar GymWiki.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Nog geen account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Registreer
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
