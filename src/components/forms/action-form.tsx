"use client";

import { Fragment, useEffect, useRef, type ComponentProps, type SubmitEvent } from "react";

type ActionFormProps = Omit<ComponentProps<"form">, "action" | "ref"> & {
  /** La accion que devuelve useActionState. */
  action: (formData: FormData) => void;
  /** isPending de useActionState: mientras sea true no se envia otra vez. */
  pending: boolean;
  /**
   * Identifica la ultima respuesta de la accion (por ejemplo state.operationId).
   * Cuando cambia, los campos se remontan con su defaultValue nuevo (los valores
   * que devolvio la accion) y el foco va al primer campo invalido.
   */
  resultKey?: string;
};

// Formulario de una accion con useActionState (entrega 9). Resuelve tres cosas
// que React 19 no hace solo, comprobadas en action-form.test.ts:
// - Mientras la accion esta pendiente, otro envio (Enter en un campo, doble
//   clic) se cancela: React lo encolaria y la accion correria dos veces. Antes
//   lo impedia el disabled del boton; con aria-disabled lo impide esta guarda.
// - Al terminar, React reinicia los campos a su defaultValue aunque la accion
//   devuelva un error. La accion devuelve lo escrito y los campos lo usan como
//   defaultValue; como un select no toma un defaultValue nuevo, se remontan con
//   resultKey.
// - Tras un error, el foco va al primer campo con aria-invalid (Field lo pone).
// SubmitButton funciona dentro: la accion sigue siendo la del <form>.
export function ActionForm({ action, pending, resultKey, onSubmit, children, ...props }: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resultKey === undefined) {
      return;
    }
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [resultKey]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    onSubmit?.(event);
  }

  return (
    <form {...props} ref={formRef} action={action} onSubmit={handleSubmit}>
      <Fragment key={resultKey}>{children}</Fragment>
    </form>
  );
}
