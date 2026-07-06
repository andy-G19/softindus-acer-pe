import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="industrial-dark dark flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <LoginForm />
    </main>
  );
}
