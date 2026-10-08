import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import {
  recordNotificationEffect,
  resetNotificationDoubles,
  takeNotificationCalls,
} from "@/testing/notification-doubles";

// Caracterizacion de ConfirmDeleteButton (entrega 7). Se ejecuta el componente
// real con sweetalert2 simulado: el snapshot fija, en orden, la ventana de
// confirmacion que abre (textos, icono y clases) y lo que ocurre despues:
// enviar el formulario, llamar a onConfirm o nada.
//
// El componente no usa hooks: el clic se simula llamando a su onClick con un
// evento minimo. Los 15 usos actuales pasan title, asi que entityName nunca
// llega a showDeleteConfirm; ese camino tambien queda fijado.

vi.mock("react-toastify", async () =>
  (await import("@/testing/notification-doubles")).toastifyModuleMock(),
);
vi.mock("sweetalert2", async () =>
  (await import("@/testing/notification-doubles")).sweetAlertModuleMock(),
);

type Props = Omit<ComponentProps<typeof ConfirmDeleteButton>, "children">;

type ClickEvent = {
  preventDefault: () => void;
  currentTarget: { form: { requestSubmit: () => void } | null };
};

async function click(props: Props, { withForm = true } = {}) {
  const button = ConfirmDeleteButton({ children: "Anular", ...props }) as ReactElement<{
    onClick: (event: ClickEvent) => Promise<void>;
  }>;

  await button.props.onClick({
    preventDefault: () => recordNotificationEffect("preventDefault"),
    currentTarget: {
      form: withForm
        ? { requestSubmit: () => recordNotificationEffect("form.requestSubmit") }
        : null,
    },
  });

  return takeNotificationCalls();
}

// Propiedades del boton de cancelar pedido (commercial/orders/page.tsx).
const orderCancelProps: Props = {
  title: "¿Cancelar pedido?",
  description:
    "Esta acción cambiará el estado del pedido y no debe ejecutarse sin verificación previa.",
  confirmText: "Confirmar cancelación",
  entityName: "pedido",
  className: "hover:bg-destructive/20",
};

beforeEach(() => {
  resetNotificationDoubles();
});

describe("clic", () => {
  it("con titulo, como en los 15 usos: confirma con showConfirm destructivo y envia el formulario", async () => {
    expect(await click(orderCancelProps)).toMatchSnapshot();
  });

  it("sin titulo pero con otro texto propio usa showConfirm con los textos por defecto", async () => {
    expect(await click({ confirmText: "Desactivar", entityName: "usuario" })).toMatchSnapshot();
  });

  it("sin textos propios usa showDeleteConfirm con la entidad", async () => {
    expect(await click({ entityName: "proforma" })).toMatchSnapshot();
  });

  it("sin ninguna propiedad pide eliminar un registro", async () => {
    expect(await click({})).toMatchSnapshot();
  });

  it("si el usuario cancela no envia el formulario", async () => {
    resetNotificationDoubles(false);

    expect(await click(orderCancelProps)).toMatchSnapshot();
  });

  it("deshabilitado no pide confirmacion ni envia", async () => {
    expect(await click({ ...orderCancelProps, disabled: true })).toEqual([
      { effect: "preventDefault" },
    ]);
  });

  it("con onConfirm lo llama en lugar de enviar el formulario", async () => {
    const calls = await click({
      ...orderCancelProps,
      onConfirm: () => recordNotificationEffect("onConfirm"),
    });

    expect(calls.map((call) => ("effect" in call ? call.effect : "swal"))).toEqual([
      "preventDefault",
      "swal",
      "onConfirm",
    ]);
  });

  it("sin formulario confirma y no falla", async () => {
    const calls = await click(orderCancelProps, { withForm: false });

    expect(calls.map((call) => ("effect" in call ? call.effect : "swal"))).toEqual([
      "preventDefault",
      "swal",
    ]);
  });
});

describe("HTML", () => {
  // Las clases que pasan los usos actuales: ninguna, la de las tablas y la de
  // los menus de acciones por fila. Sin hooks, llamar al componente da el
  // mismo elemento que createElement.
  it.each([
    ["sin clase", {}],
    ["clase de tabla", { className: "hover:bg-destructive/20" }],
    [
      "clase de menu",
      { className: "rounded-none border-0 bg-transparent px-0 py-0 hover:bg-transparent" },
    ],
    ["deshabilitado", { disabled: true }],
  ] as const)("%s", (_name, props: Props) => {
    expect(
      renderToStaticMarkup(ConfirmDeleteButton({ children: "Anular", ...props })),
    ).toMatchSnapshot();
  });
});
