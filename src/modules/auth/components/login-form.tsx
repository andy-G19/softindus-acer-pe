"use client";

import { useActionState } from "react";

import { loginAction } from "@/modules/auth/actions/login.action";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState = {
  error: "",
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <Card className="w-full max-w-md rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.52)]">
      <CardHeader className="space-y-4 border-b border-border/70 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="h-0.5 w-14 rounded-full bg-primary" />
          <span className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Acceso seguro
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Industrias Aceros Perú
          </p>
          <CardTitle className="text-2xl font-semibold tracking-normal text-foreground">
            Acceso al sistema
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Sistema de Gestión Integral
          </CardDescription>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Ingrese sus credenciales para acceder al panel administrativo interno.
        </p>
      </CardHeader>

      <CardContent className="pt-1">
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
            <Label htmlFor="email" className="text-sm font-medium">
              Correo electrónico
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Ingrese su correo electrónico"
              autoComplete="email"
              required
              className="h-10 border-border bg-input/80 px-3 text-foreground placeholder:text-muted-foreground/75 focus-visible:border-primary focus-visible:ring-primary/35"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Ingrese su contraseña"
              autoComplete="current-password"
              required
              className="h-10 border-border bg-input/80 px-3 text-foreground placeholder:text-muted-foreground/75 focus-visible:border-primary focus-visible:ring-primary/35"
            />
          </div>

          <Button
            type="submit"
            className="h-10 w-full bg-primary text-primary-foreground shadow-sm hover:bg-[#d97706] focus-visible:ring-primary/45"
            disabled={isPending}
          >
            {isPending ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
