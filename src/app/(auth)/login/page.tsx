import Image from "next/image";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="industrial-dark dark relative min-h-screen overflow-hidden bg-[#0f1011] px-4 py-8 text-foreground sm:px-6">
      <Image
        src="/images/login-image.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 z-0 scale-100 object-cover opacity-100 blur-[1.5px] saturate-125"
      />
      <div className="absolute inset-0 z-10 bg-[#07101f]/45" />
      <div className="absolute inset-0 z-20 bg-[linear-gradient(90deg,rgba(2,6,23,0.68)_0%,rgba(15,16,17,0.24)_48%,rgba(245,158,11,0.12)_100%)]" />
      <div
        className="absolute inset-0 z-20"
        style={{
          background:
            "radial-gradient(circle at center, rgba(15, 16, 17, 0.72) 0%, rgba(15, 16, 17, 0.44) 30%, rgba(15, 16, 17, 0.08) 62%, transparent 100%)",
        }}
      />

      <section className="relative z-30 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6">
        <LoginForm />

        <p className="max-w-md text-center text-xs leading-relaxed text-zinc-400">
          © 2026 Industrias Aceros Perú. Sistema interno de gestión.
          <br />
          Acceso restringido a personal autorizado.
        </p>
      </section>
    </main>
  );
}
