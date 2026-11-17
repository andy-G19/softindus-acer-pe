// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkOrderProgressPage from "./page";

// La tarjeta de una etapa queda montada cuando la orden se finaliza (C4 de la 11.6c, D81).
// Terminar la ultima etapa finaliza la orden y la revalidacion repinta la pagina con todas las
// tarjetas deshabilitadas en la misma respuesta. Si la pagina remontara la tarjeta (otra key), su
// estado de accion se perderia y el aviso no saldria (hallazgo 9 de la 11.2a). Un snapshot de HTML
// no ve las keys: la prueba pinta la pagina real dos veces sobre la misma raiz, como Next al
// revalidar, y exige el mismo nodo del formulario.

const order = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requireRole: async () => ({ user: { id: "USU00000001", role: "ADMIN" } }) }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn(), showError: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/dashboard/production/work-orders/OTR00000007/progress",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/production/work-order-progress/actions", () => ({
  generateWorkOrderProgressAction: vi.fn(),
  updateWorkOrderProgressAction: vi.fn(),
}));
vi.mock("@/modules/production/work-order-progress/queries", () => ({
  getWorkOrderProgress: async () => order.current,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function advance(id: string, orden: number, estado: string, porcentaje: string) {
  return {
    id_avance: id,
    estado_etapa: estado,
    porcentaje_avance: porcentaje,
    observaciones: null,
    fecha_inicio_etapa: null,
    fecha_fin_etapa: null,
    operario: null,
    usuario: { nombres: "Andrea", apellidos: "Prueba" },
    etapa_ruta: { orden_secuencia: orden, nombre_etapa: `Etapa ${orden}`, descripcion: null, requiere_maquina: false },
    reasignacion_tarea: [],
  };
}

function workOrder(estado: string, segunda: string, porcentaje: string) {
  return {
    id_orden_trabajo: "OTR00000007",
    estado,
    cantidad: "1.00",
    producto: { nombre_producto: "Puerta", unidad_medida: "unidad" },
    ruta_fabricacion: { nombre_ruta: "Ruta", etapa_ruta: [] },
    avance_orden: [
      advance("AVN00000001", 1, "terminada", "100"),
      advance("AVN00000002", 2, segunda, porcentaje),
    ],
  };
}

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

async function renderWith(current: unknown) {
  order.current = current;
  const page = await WorkOrderProgressPage({
    params: Promise.resolve({ id: "OTR00000007" }),
    searchParams: Promise.resolve({}),
  });

  await act(async () => root.render(page));
}

const secondForm = () =>
  document.querySelector<HTMLInputElement>('input[name="id_avance"][value="AVN00000002"]')?.form ?? null;

describe("tarjeta de una etapa al finalizar la orden", () => {
  it("es el mismo formulario, ahora deshabilitado, con lo guardado", async () => {
    await renderWith(workOrder("en_proceso", "en_proceso", "40"));

    const before = secondForm();

    expect(before).not.toBeNull();
    expect(before?.querySelector<HTMLSelectElement>('select[name="estado_etapa"]')?.disabled).toBe(false);

    await renderWith(workOrder("finalizada", "terminada", "100"));

    expect(secondForm()).toBe(before);
    expect(before?.isConnected).toBe(true);
    expect(before?.querySelector<HTMLSelectElement>('select[name="estado_etapa"]')?.disabled).toBe(true);
  });
});
