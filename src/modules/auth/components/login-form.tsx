"use client";

import { useActionState, useState } from "react";

import { loginAction } from "@/modules/auth/actions/login.action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState = {
  error: "",
};

function APMonogram() {
  return (
    <svg
      aria-hidden="true"
      className="h-10 w-10 shrink-0"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="9" fill="#1c2027" />
      <path
        d="M8 28L14 12H18L24 28H20.5L19.2 24.5H12.8L11.5 28H8Z"
        fill="#4a6fa5"
      />
      <path d="M13.8 21.5H18.2L16 15.5L13.8 21.5Z" fill="#15181d" />
      <path
        d="M23 28V12H30C32.7 12 34.5 13.6 34.5 16.3C34.5 19 32.7 20.6 30 20.6H26.4V28H23ZM26.4 17.8H29.6C30.7 17.8 31.3 17.2 31.3 16.3C31.3 15.4 30.7 14.8 29.6 14.8H26.4V17.8Z"
        fill="#f59e0b"
      />
      <path
        d="M17 30C15 32 12 32 10 30"
        stroke="#4f9142"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="M2 6.5l10 7 10-7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
        <path d="M9.9 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a13.5 13.5 0 0 1-3.1 3.9" />
        <path d="M6.6 6.6C3.5 8.3 1 12 1 12s4 7 11 7a10.6 10.6 0 0 0 5-1.2" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card
      className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-white/10 py-0 text-card-foreground shadow-2xl"
      style={{
        background: "linear-gradient(180deg, #15181d, #1c2027)",
        boxShadow:
          "0 40px 80px -30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div className="heat-bar w-full" aria-hidden="true" />

      <div className="px-6 py-7 sm:px-9 sm:py-9">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <APMonogram />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-foreground">
                Aceros Perú
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sistema de gestión
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
            Acceso seguro
          </span>
        </div>

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          Panel administrativo
        </p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">
          Acceso al sistema
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ingresa tus credenciales para entrar al Sistema de Gestión Integral.
          El acceso queda registrado por motivos de seguridad.
        </p>

        <div className="my-6 h-px bg-white/10" />

        <form action={formAction} className="space-y-5">
          {state.error ? (
            <Alert
              variant="destructive"
              className="border-red-400/30 bg-red-950/30 text-red-200"
            >
              <AlertDescription className="text-red-200/90">
                {state.error}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold">
              Correo electrónico
            </Label>
            <div className="group relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
                <MailIcon />
              </span>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Ingrese su correo electrónico"
                autoComplete="email"
                required
                className="h-11 border-white/10 bg-white/[0.03] pl-10 pr-3 text-foreground placeholder:text-muted-foreground/70 hover:border-white/20 focus-visible:border-primary focus-visible:bg-white/[0.045] focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold">
              Contraseña
            </Label>
            <div className="group relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
                <LockIcon />
              </span>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Ingrese su contraseña"
                autoComplete="current-password"
                required
                className="h-11 border-white/10 bg-white/[0.03] pl-10 pr-11 text-foreground placeholder:text-muted-foreground/70 hover:border-white/20 focus-visible:border-primary focus-visible:bg-white/[0.045] focus-visible:ring-primary/20"
              />
              <button
                type="button"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => setShowPassword((current) => !current)}
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="mt-1 h-11 w-full gap-2 bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(245,158,11,0.5)] transition hover:bg-[#ffab3d] active:translate-y-px focus-visible:ring-primary/45"
            disabled={isPending}
          >
            {isPending ? "Ingresando..." : "Ingresar"}
            <ArrowIcon />
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground/80">
          © 2026 Industrias Aceros Perú. Sistema interno de gestión.
          <br />
          Acceso restringido a personal autorizado.
        </p>
      </div>
    </Card>
  );
}
