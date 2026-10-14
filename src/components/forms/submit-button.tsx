"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

// Omit que respeta cada caso de la union de props de Button (un Omit simple
// las mezclaria y perderia, por ejemplo, el aria-label obligatorio).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type SubmitButtonProps = DistributiveOmit<ButtonProps, "type" | "asChild" | "pending">;

// Boton de envio que se pone pendiente solo (entrega 8): lee el estado del
// <form> que lo contiene con useFormStatus, sin que el formulario le pase
// isPending. Funciona con formularios cuya action es una funcion (las acciones
// del servidor con useActionState); un formulario GET navega y no tiene estado
// pendiente. Debe ir dentro del <form>, no al lado.
export function SubmitButton(props: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return <Button type="submit" pending={pending} {...props} />;
}
