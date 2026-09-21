import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full shadow-brand-lg">
      <CardHeader>
        <CardTitle className="text-xl">Wachtwoord vergeten</CardTitle>
        <CardDescription>
          Vul je e-mailadres in en we sturen je een link om een nieuw
          wachtwoord in te stellen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
