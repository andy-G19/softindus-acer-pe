// @vitest-environment jsdom
import { act, createElement as h, useActionState, useState, type SubmitEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

// Envio de formularios con React real (entrega 9). Comprobado en este entorno
// antes de escribir ActionForm: React 19 encola un segundo envio mientras la
// accion esta pendiente (la accion corre dos veces) y, al terminar, reinicia
// los campos a su defaultValue aunque la accion devuelva un error; un select
// no toma un defaultValue nuevo, asi que los campos se remontan por respuesta.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function render(node: Parameters<Root["render"]>[0]) {
  await act(async () => {
    root.render(node);
  });
}

function query<T extends Element>(selector: string) {
  const element = host.querySelector<T>(selector);
  if (!element) {
    throw new Error(`No hay ningun ${selector}`);
  }
  return element;
}

describe("Button pendiente en el navegador", () => {
  it("sigue siendo enfocable y no ejecuta su clic ni envia el formulario", async () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    await render(
      h("form", { onSubmit }, h(Button, { type: "submit", pending: true, onClick }, "Guardar")),
    );
    const button = query<HTMLButtonElement>("button");

    button.focus();
    expect(document.activeElement).toBe(button);

    await act(async () => button.click());
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("conserva el foco cuando pasa a pendiente y al terminar", async () => {
    function Toggle() {
      const [pending, setPending] = useState(false);
      return h(Button, { type: "button", pending, onClick: () => setPending(true) }, "Exportar");
    }

    await render(h(Toggle));
    const button = query<HTMLButtonElement>("button");
    button.focus();

    await act(async () => button.click());
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(button);
  });
});

type DemoState = {
  error: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  operationId?: string;
};

const received: string[] = [];
let release: (() => void) | null = null;

// Accion de prueba que espera a que la prueba la suelte y devuelve un error
// en "nombre" con los valores enviados, como hara la de Clientes.
async function demoAction(_prev: DemoState, formData: FormData): Promise<DemoState> {
  received.push(String(formData.get("nombre")));
  await new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    error: "Revisa los datos.",
    fieldErrors: { nombre: ["El nombre es obligatorio."] },
    values: Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])),
    operationId: `op-${received.length}`,
  };
}

async function finishAction() {
  await act(async () => {
    release?.();
    release = null;
  });
}

function DemoForm({ onSubmit }: { onSubmit?: (event: SubmitEvent<HTMLFormElement>) => void }) {
  const [state, formAction, pending] = useActionState(demoAction, { error: "" });
  const values = state.values;

  return h(
    ActionForm,
    { action: formAction, pending, resultKey: state.operationId, onSubmit },
    h(Field, {
      id: "tipo",
      label: "Tipo",
      errors: state.fieldErrors?.tipo,
      children: (control) =>
        h(
          NativeSelect,
          { ...control, name: "tipo", defaultValue: values?.tipo ?? "a" },
          h("option", { value: "a" }, "A"),
          h("option", { value: "b" }, "B"),
        ),
    }),
    h(Field, {
      id: "nombre",
      label: "Nombre",
      errors: state.fieldErrors?.nombre,
      children: (control) => h(Input, { ...control, name: "nombre", defaultValue: values?.nombre ?? "" }),
    }),
    h(Field, {
      id: "obs",
      label: "Observaciones",
      errors: state.fieldErrors?.obs,
      children: (control) => h(Textarea, { ...control, name: "obs", defaultValue: values?.obs ?? "" }),
    }),
    h(SubmitButton, { pendingText: "Guardando..." }, "Guardar"),
  );
}

async function submit() {
  await act(async () => query<HTMLFormElement>("form").requestSubmit());
}

describe("ActionForm", () => {
  beforeEach(() => {
    received.length = 0;
  });

  it("no envia otra vez mientras la accion esta pendiente (Enter en un campo incluido)", async () => {
    await render(h(DemoForm));
    query<HTMLInputElement>("#nombre").value = "Andina";

    await submit();
    expect(query("button").getAttribute("aria-busy")).toBe("true");
    await submit();
    await finishAction();
    await finishAction();

    expect(received).toEqual(["Andina"]);
  });

  it("tras un error conserva lo escrito, select incluido, y enfoca el primer campo invalido", async () => {
    await render(h(DemoForm));
    query<HTMLSelectElement>("#tipo").value = "b";
    query<HTMLInputElement>("#nombre").value = "A";
    query<HTMLTextAreaElement>("#obs").value = "Pago al contado";

    await submit();
    await finishAction();

    expect(query<HTMLSelectElement>("#tipo").value).toBe("b");
    expect(query<HTMLInputElement>("#nombre").value).toBe("A");
    expect(query<HTMLTextAreaElement>("#obs").value).toBe("Pago al contado");
    expect(document.activeElement).toBe(query("#nombre"));
    expect(query("#nombre").getAttribute("aria-invalid")).toBe("true");
  });

  it("el onSubmit propio se llama y puede cancelar el envio", async () => {
    const onSubmit = vi.fn((event: SubmitEvent<HTMLFormElement>) => event.preventDefault());

    await render(h(DemoForm, { onSubmit }));
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);
  });
});
