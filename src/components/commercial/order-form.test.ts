// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderForm } from "@/components/commercial/order-form";
import type { OrderFormState } from "@/modules/commercial/orders/actions";

// Formulario de pedidos con React real (10.4c, C3). La edicion ofrece el
// cliente y los productos que el pedido ya tiene aunque esten inactivos (D3 de
// la 10.4a), marcados en la lista para que se vea por que no aparecen en un
// pedido nuevo. La marca solo se ve al abrir la lista: el servidor no la pinta.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/notifications", () => ({ showError: vi.fn() }));
// El formulario importa la accion de alta por defecto: aqui no se envia.
vi.mock("@/modules/commercial/orders/actions", () => ({ createOrderAction: vi.fn() }));

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

const action = async (state: OrderFormState) => state;

async function renderEdit() {
  await act(async () =>
    root.render(
      h(OrderForm, {
        action,
        clients: [
          { id_cliente: "CLI00000001", nombre_razon_social: "Ferretería El Perno", tipo_cliente: "ferreteria" },
          {
            id_cliente: "CLI00000099",
            nombre_razon_social: "Cliente dado de baja",
            tipo_cliente: "cliente_final",
            inactivo: true,
          },
        ],
        products: [
          {
            id_producto: "PRO00000001",
            nombre_producto: "Puerta metálica",
            categoria: "estructuras",
            unidad_medida: "unidad",
            precio_referencial: "450",
          },
          {
            id_producto: "PRO00000099",
            nombre_producto: "Producto dado de baja",
            categoria: "herramientas",
            unidad_medida: "unidad",
            precio_referencial: null,
            inactivo: true,
          },
        ],
        defaultValues: {
          id_pedido: "PED00000020",
          id_cliente: "CLI00000099",
          items: [{ id_producto: "PRO00000099", cantidad: "2", precio_unitario: "10", observacion_detalle: "" }],
        },
        submitLabel: "Guardar cambios",
      }),
    ),
  );
}

function combobox(name: string) {
  const hidden = document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)!;
  return hidden.parentElement!.querySelector<HTMLInputElement>('[role="combobox"]')!;
}

async function openOptions(name: string) {
  const input = combobox(name);
  await act(async () => input.focus());
  // Con el foco la lista se abre filtrada por la etiqueta elegida: se vacia
  // la busqueda (como al borrarla con el teclado) para verlas todas.
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')].map((option) => option.textContent);
}

describe("OrderForm en la edicion", () => {
  it("muestra el cliente actual inactivo y lo marca en la lista", async () => {
    await renderEdit();

    expect(combobox("id_cliente").value).toBe("Cliente dado de baja");
    expect(await openOptions("id_cliente")).toContain("Cliente dado de bajacliente_final - Inactivo");
  });

  it("los activos no llevan la marca", async () => {
    await renderEdit();

    expect(await openOptions("id_cliente")).toContain("Ferretería El Pernoferreteria");
  });

  it("muestra el producto actual inactivo y lo marca en la lista", async () => {
    await renderEdit();

    expect(combobox("id_producto").value).toBe("Producto dado de baja");
    const options = await openOptions("id_producto");
    expect(options).toContain("Producto dado de bajaherramientas - unidad - Sin precio - Inactivo");
    expect(options).toContain("Puerta metálicaestructuras - unidad - S/ 450.00");
  });
});
