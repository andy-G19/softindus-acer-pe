// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commercialNotifications } from "@/modules/commercial/notifications";
import type { OrderFormState, OrderFormValues } from "@/modules/commercial/orders/actions";
import { OrderForm } from "@/modules/commercial/orders/order-form";

// Formulario de pedidos con React real (10.4c). La edicion ofrece el cliente y
// los productos que el pedido ya tiene aunque esten inactivos (D3 de la 10.4a),
// marcados en la lista; la marca solo se ve al abrir la lista (C3).
//
// Desde C5 la accion devuelve un resultado y el formulario decide: con error
// conserva lo escrito, muestra cada error junto a su campo (tambien los de una
// linea), enfoca el primero y deja el mensaje general dentro, sin otro aviso
// (antes daba ademas un SweetAlert y React vaciaba la fecha y las
// observaciones); con exito da un solo aviso y vuelve al returnTo.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/commercial/orders/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  for (const fn of Object.values(navigation)) {
    fn.mockClear();
  }
  notifications.notify.mockClear();
  notifications.showError.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const LIST = "/dashboard/commercial/orders";

const CLIENTS = [
  { id_cliente: "CLI00000001", nombre_razon_social: "Ferretería El Perno", tipo_cliente: "ferreteria" },
  {
    id_cliente: "CLI00000099",
    nombre_razon_social: "Cliente dado de baja",
    tipo_cliente: "cliente_final",
    inactivo: true,
  },
];

const PRODUCTS = [
  {
    id_producto: "PRO00000001",
    nombre_producto: "Puerta metálica",
    categoria: "estructuras",
    unidad_medida: "unidad",
    precio_referencial: "450",
  },
  {
    id_producto: "PRO00000002",
    nombre_producto: "Reja de ventana",
    categoria: "estructuras",
    unidad_medida: "unidad",
    precio_referencial: "120",
  },
  {
    id_producto: "PRO00000099",
    nombre_producto: "Producto dado de baja",
    categoria: "herramientas",
    unidad_medida: "unidad",
    precio_referencial: null,
    inactivo: true,
  },
];

const EDITED = {
  id_pedido: "PED00000020",
  id_cliente: "CLI00000099",
  fecha_entrega_estimada: "2026-07-20",
  observaciones: "Entrega en obra.",
  items: [
    { id_producto: "PRO00000099", cantidad: "2", precio_unitario: "10", observacion_detalle: "" },
    { id_producto: "PRO00000001", cantidad: "1.25", precio_unitario: "10.25", observacion_detalle: "Pintado" },
  ],
};

type Respond = (values: OrderFormValues) => OrderFormState;

function valuesOf(formData: FormData): OrderFormValues {
  const all = (name: string) => formData.getAll(name).map(String);
  const quantities = all("cantidad");
  const prices = all("precio_unitario");
  const observations = all("observacion_detalle");

  return {
    id_cliente: String(formData.get("id_cliente") ?? ""),
    fecha_entrega_estimada: String(formData.get("fecha_entrega_estimada") ?? ""),
    observaciones: String(formData.get("observaciones") ?? ""),
    items: all("id_producto").map((id_producto, index) => ({
      id_producto,
      cantidad: quantities[index],
      precio_unitario: prices[index],
      observacion_detalle: observations[index],
    })),
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: OrderFormState, formData: FormData) => respond(valuesOf(formData)));

  await act(async () =>
    root.render(
      h(OrderForm, {
        action,
        clients: CLIENTS,
        products: PRODUCTS,
        defaultValues: EDITED,
        submitLabel: "Guardar cambios",
        successNotification: commercialNotifications["order-updated"],
        returnTo: LIST,
        ...overrides,
      }),
    ),
  );

  return action;
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_pedido: "PED00000020" },
  values,
  operationId: "op-ok",
});

function byId<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id) as T | null;
  if (!element) {
    throw new Error(`No hay elemento ${id}`);
  }
  return element;
}

function combobox(name: string, line = 0) {
  return document.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)[line].parentElement!.querySelector<HTMLInputElement>('[role="combobox"]')!;
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

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("OrderForm en la edicion", () => {
  it("muestra el cliente actual inactivo y lo marca en la lista", async () => {
    await renderForm(success);

    expect(combobox("id_cliente").value).toBe("Cliente dado de baja");
    expect(await openOptions("id_cliente")).toContain("Cliente dado de bajacliente_final - Inactivo");
  });

  it("los activos no llevan la marca", async () => {
    await renderForm(success);

    expect(await openOptions("id_cliente")).toContain("Ferretería El Pernoferreteria");
  });

  it("muestra el producto actual inactivo y lo marca en la lista", async () => {
    await renderForm(success);

    expect(combobox("id_producto").value).toBe("Producto dado de baja");
    const options = await openOptions("id_producto");
    expect(options).toContain("Producto dado de bajaherramientas - unidad - Sin precio - Inactivo");
    expect(options).toContain("Puerta metálicaestructuras - unidad - S/ 450.00");
  });

  it("asocia cada etiqueta con su campo, tambien en las lineas", async () => {
    await renderForm(success);

    for (const id of ["id_cliente", "id_producto-row-1", "cantidad-row-2", "precio_unitario-row-2", "subtotal-row-2", "observacion_detalle-row-2", "fecha_entrega_estimada", "observaciones"]) {
      expect(document.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
    expect(byId("subtotal-row-2").textContent).toBe("S/ 12.81");
  });
});

describe("OrderForm con el resultado de la accion", () => {
  it("con error conserva lo escrito, pone cada error en su linea, enfoca el primero y no da otro aviso", async () => {
    const action = await renderForm((values) => ({
      status: "error",
      error: "No repitas el mismo producto dentro del pedido.",
      fieldErrors: { "items.1.id_producto": ["No repitas el mismo producto dentro del pedido."] },
      values,
      operationId: "op-1",
    }));
    byId<HTMLInputElement>("fecha_entrega_estimada").value = "2026-07-25";
    byId<HTMLTextAreaElement>("observaciones").value = "Llamar antes de entregar.";

    await submit();

    expect(action).toHaveBeenCalledTimes(1);
    expect(byId<HTMLInputElement>("fecha_entrega_estimada").value).toBe("2026-07-25");
    expect(byId<HTMLTextAreaElement>("observaciones").value).toBe("Llamar antes de entregar.");
    expect(byId<HTMLInputElement>("cantidad-row-2").value).toBe("1.25");
    expect(combobox("id_cliente").value).toBe("Cliente dado de baja");

    const repeated = byId<HTMLInputElement>("id_producto-row-2");
    expect(repeated.getAttribute("aria-invalid")).toBe("true");
    expect(repeated.getAttribute("aria-describedby")).toBe("id_producto-row-2-error");
    expect(byId("id_producto-row-2-error").textContent).toBe("No repitas el mismo producto dentro del pedido.");
    expect(byId("id_producto-row-1").hasAttribute("aria-invalid")).toBe(false);
    expect(document.activeElement).toBe(repeated);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("No repitas el mismo producto dentro del pedido.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("los errores de un campo de linea van con Field y los de la lista bajo el detalle", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Revisa los datos del pedido.",
      fieldErrors: {
        "items.0.cantidad": ["La cantidad no debe superar 99,999,999.99."],
        "items.1": ["El subtotal de un producto no debe superar S/ 9,999,999,999.99."],
        items: ["El monto estimado del pedido no debe superar S/ 9,999,999,999.99."],
        fecha_entrega_estimada: ["La fecha estimada de entrega no es válida."],
      },
      values,
      operationId: "op-2",
    }));

    await submit();

    expect(byId("cantidad-row-1").getAttribute("aria-invalid")).toBe("true");
    expect(byId("cantidad-row-1-error").textContent).toBe("La cantidad no debe superar 99,999,999.99.");
    expect(document.body.textContent).toContain("El monto estimado del pedido no debe superar S/ 9,999,999,999.99.");
    const secondLine = byId("cantidad-row-2").closest(".p-4")!;
    expect(secondLine.textContent).toContain("El subtotal de un producto no debe superar S/ 9,999,999,999.99.");
    expect(byId("cantidad-row-1").closest(".p-4")!.textContent).not.toContain("El subtotal de un producto");
    expect(byId("fecha_entrega_estimada-error").textContent).toBe("La fecha estimada de entrega no es válida.");
    expect(document.activeElement).toBe(byId("cantidad-row-1"));
  });

  it("el error del cliente va en su busqueda y la enfoca", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "El cliente seleccionado no existe o está inactivo.",
      fieldErrors: { id_cliente: ["El cliente seleccionado no existe o está inactivo."] },
      values,
      operationId: "op-3",
    }));

    await submit();

    const client = byId<HTMLInputElement>("id_cliente");
    expect(client.getAttribute("aria-invalid")).toBe("true");
    expect(client.getAttribute("aria-describedby")).toBe("id_cliente-error");
    expect(byId("id_cliente-error").textContent).toBe("El cliente seleccionado no existe o está inactivo.");
    expect(document.activeElement).toBe(client);
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(commercialNotifications["order-updated"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que el pedido puede no aparecer", async () => {
    const returnTo = `${LIST}?status=registrado`;
    await renderForm(success, { returnTo });

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...commercialNotifications["order-updated"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("envia el id del pedido y todas las lineas", async () => {
    const action = await renderForm(success);

    await submit();

    const formData = action.mock.calls[0][1];
    expect(formData.get("id_pedido")).toBe("PED00000020");
    expect(valuesOf(formData)).toEqual({
      id_cliente: "CLI00000099",
      fecha_entrega_estimada: "2026-07-20",
      observaciones: "Entrega en obra.",
      items: EDITED.items,
    });
  });

  it("Cancelar es un enlace al returnTo y no envia", async () => {
    const returnTo = `${LIST}?q=puerta`;
    const action = await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });
});
