// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { RecipeVersionStatusActions } from "@/modules/production/recipe-versions/recipe-version-status-actions";

// Marcar vigente y anular desde la fila (entrega 10.6b), con el Radix real: cada
// accion confirma con su consecuencia, envia los ids y un error queda dentro.

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  notifications.notify.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const confirmation = () => document.querySelector('[role="alertdialog"]');
const SET_CURRENT = { type: "success" as const, message: "Marcada" };
const ANNULLED = { type: "warning" as const, message: "Anulada" };

function buttonIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text);
}

const done = (estado: string): RowStatusState => ({
  status: "success",
  data: { estado },
  values: { id: "VER00000005" },
  operationId: "op",
});

type RenderOptions = {
  estado?: string;
  recipeEstado?: string;
  orders?: number;
  currentVersionNumber?: string;
  state?: RowStatusState;
};

async function renderActions({
  estado = "reemplazada",
  recipeEstado = "activa",
  orders = 0,
  currentVersionNumber = "V3",
  state,
}: RenderOptions = {}) {
  const setCurrentAction = vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(
    async () => state ?? done("vigente"),
  );
  const voidAction = vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(
    async () => state ?? done("anulada"),
  );

  await act(async () =>
    root.render(
      h(RecipeVersionStatusActions, {
        recipe: { id_receta: "REC00000003", estado: recipeEstado },
        version: {
          id_version_receta: "VER00000005",
          numero_version: "V2",
          estado,
          _count: { orden_trabajo: orders },
        },
        currentVersionNumber,
        setCurrentAction,
        voidAction,
        setCurrentNotification: SET_CURRENT,
        annulledNotification: ANNULLED,
      }),
    ),
  );

  return { setCurrentAction, voidAction };
}

describe("marcar vigente", () => {
  it("confirma con boton normal, nombra la version que reemplaza y envia los ids", async () => {
    const { setCurrentAction } = await renderActions();

    await act(async () => buttonIn(document, "Marcar vigente")!.click());

    expect(confirmation()?.textContent).toContain("¿Marcar la versión V2 como vigente?");
    expect(confirmation()?.textContent).toContain(
      "Las nuevas órdenes de trabajo usarán esta versión y la V3 quedará reemplazada.",
    );
    expect(buttonIn(confirmation()!, "Marcar vigente")?.getAttribute("data-variant")).toBe("default");
    expect(setCurrentAction).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Marcar vigente")!.click());
    await settle();

    expect(Object.fromEntries(setCurrentAction.mock.calls[0][1])).toEqual({
      id_receta: "REC00000003",
      id_version_receta: "VER00000005",
    });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(SET_CURRENT);
  });

  it("sin version vigente no habla de reemplazar", async () => {
    await act(async () => root.render(null));
    await act(async () =>
      root.render(
        h(RecipeVersionStatusActions, {
          recipe: { id_receta: "REC00000003", estado: "activa" },
          version: { id_version_receta: "VER00000005", numero_version: "V2", estado: "reemplazada", _count: { orden_trabajo: 0 } },
          setCurrentAction: vi.fn(),
          voidAction: vi.fn(),
          setCurrentNotification: SET_CURRENT,
          annulledNotification: ANNULLED,
        }),
      ),
    );

    await act(async () => buttonIn(document, "Marcar vigente")!.click());

    expect(confirmation()?.textContent).toContain("Las nuevas órdenes de trabajo usarán esta versión.");
    expect(confirmation()?.textContent).not.toContain("reemplazada");
  });

  it("con la receta inactiva no se ofrece (D8)", async () => {
    await renderActions({ recipeEstado: "inactiva" });

    expect(buttonIn(document, "Marcar vigente")).toBeUndefined();
    expect(buttonIn(document, "Anular")).toBeDefined();
  });

  it.each(["vigente", "anulada"])("una version %s no se ofrece", async (estado) => {
    await renderActions({ estado });

    expect(buttonIn(document, "Marcar vigente")).toBeUndefined();
  });

  it("un error queda en la confirmacion sin aviso", async () => {
    await renderActions({
      state: { status: "error", error: "La versión ya estaba vigente.", values: { id: "VER00000005" }, operationId: "op" },
    });

    await act(async () => buttonIn(document, "Marcar vigente")!.click());
    await act(async () => buttonIn(confirmation()!, "Marcar vigente")!.click());
    await settle();

    expect(confirmation()?.textContent).toContain("La versión ya estaba vigente.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe("anular", () => {
  it("una reemplazada confirma con boton destructivo y envia los ids", async () => {
    const { voidAction } = await renderActions();

    await act(async () => buttonIn(document, "Anular")!.click());

    expect(confirmation()?.textContent).toContain("¿Anular la versión V2?");
    expect(confirmation()?.textContent).toContain("Ya no se podrá marcar como vigente.");
    expect(confirmation()?.textContent).toContain("no se puede deshacer");
    expect(buttonIn(confirmation()!, "Anular")?.getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(confirmation()!, "Anular")!.click());
    await settle();

    expect(Object.fromEntries(voidAction.mock.calls[0][1])).toEqual({
      id_receta: "REC00000003",
      id_version_receta: "VER00000005",
    });
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("la vigente avisa que otra toma su lugar", async () => {
    await renderActions({ estado: "vigente" });

    await act(async () => buttonIn(document, "Anular")!.click());

    expect(confirmation()?.textContent).toContain("La versión no anulada más reciente pasará a ser la vigente.");
    expect(confirmation()?.textContent).not.toContain("Ya no se podrá marcar como vigente.");
  });

  it("una version usada por ordenes no se ofrece", async () => {
    await renderActions({ orders: 2 });

    expect(buttonIn(document, "Anular")).toBeUndefined();
  });

  it("una version anulada no se ofrece", async () => {
    await renderActions({ estado: "anulada" });

    expect(buttonIn(document, "Anular")).toBeUndefined();
  });
});
