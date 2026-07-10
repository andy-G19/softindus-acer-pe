import Image from "next/image";
import { redirect } from "next/navigation";

import { getActiveUserSession } from "@/lib/authz";
import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  const session = await getActiveUserSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="industrial-dark dark login-industrial-bg relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 text-foreground">
      <Image
        src="/images/login-image.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 z-0 scale-105 object-cover opacity-65 blur-[1px] saturate-125"
      />
      <div className="absolute inset-0 z-0 bg-[#0a0b0d]/45" aria-hidden="true" />
      <div
        className="login-brushed-metal absolute inset-0 z-0"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(15,16,17,0.62)_0%,rgba(15,16,17,0.34)_34%,transparent_68%)]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <span
          className="login-ember"
          style={{ left: "8%", animationDuration: "8s", animationDelay: "0s" }}
        />
        <span
          className="login-ember"
          style={{
            left: "22%",
            animationDuration: "10s",
            animationDelay: "1.5s",
          }}
        />
        <span
          className="login-ember"
          style={{
            left: "63%",
            animationDuration: "11s",
            animationDelay: "2.2s",
          }}
        />
        <span
          className="login-ember"
          style={{
            left: "78%",
            animationDuration: "8.5s",
            animationDelay: "3s",
          }}
        />
        <span
          className="login-ember"
          style={{
            left: "90%",
            animationDuration: "7s",
            animationDelay: "0.8s",
          }}
        />
      </div>

      <LoginForm />
    </main>
  );
}
