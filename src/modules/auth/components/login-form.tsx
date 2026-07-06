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
    <Card className="w-full max-w-md border-border/80 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="mb-2 h-0.5 w-14 rounded-full bg-primary" />
        <CardTitle className="text-xl font-semibold text-foreground">
          Iniciar sesión
        </CardTitle>
        <CardDescription className="leading-relaxed">
          Accede al Sistema de Gestión Integral de Industrias Aceros Perú.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-1">
        <form action={formAction} className="space-y-5">
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@acerosperu.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Ingrese su contraseña"
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
