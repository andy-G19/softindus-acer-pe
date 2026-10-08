import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationQueryBridge } from "@/components/notifications/notification-query-bridge";
import { notificationRegistry } from "@/modules/notification-registry";
import {
  recordNotificationEffect,
  resetNotificationDoubles,
  takeNotificationCalls,
} from "@/testing/notification-doubles";

// Caracterizacion del puente ?toast= (entrega 7), escrita antes de sacar su
// catalogo de mensajes a definiciones por area.
//
// Se ejecuta el componente real. React se reemplaza por un doble minimo: el
// efecto corre en cada render y cada montaje conserva su ref entre renders,
// como en React. La navegacion es una URL controlada y router.replace se
// registra. Las librerias de notificacion son los dobles compartidos: el
// snapshot fija el toast exacto (metodo, HTML y clases) y la URL que queda.
//
// La lista de claves esta escrita aqui y no se lee del catalogo: si una
// entrada desapareciera, su caso fallaria en lugar de quedar como snapshot
// obsoleto, que Vitest no marca como error.
//
// Comportamientos actuales que se conservan (se corrigen aparte):
// - F1: el ref evita repetir una clave mientras el puente siga montado. Una
//   segunda operacion igual no muestra su toast y deja ?toast= en la URL.
// - F2: las claves del prototipo de Object (toString, constructor...)
//   encuentran algo y muestran un toast info vacio.
// - F3: con ?toast= vacio no muestra nada y no limpia la URL.

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  search: "",
  refs: [] as Array<{ current: unknown }>,
  nextRef: 0,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useEffect: (effect: () => void) => {
      effect();
    },
    useRef: (initial: unknown) => {
      const index = mocks.nextRef++;
      mocks.refs[index] ??= { current: initial };
      return mocks.refs[index];
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({
    replace: (href: string, options: unknown) => {
      recordNotificationEffect(`router.replace ${href} ${JSON.stringify(options)}`);
    },
  }),
}));
vi.mock("react-toastify", async () =>
  (await import("@/testing/notification-doubles")).toastifyModuleMock(),
);
vi.mock("sweetalert2", async () =>
  (await import("@/testing/notification-doubles")).sweetAlertModuleMock(),
);

// Monta el puente de nuevo: refs vacios, como al recargar la pagina.
function mount() {
  mocks.refs = [];
}

// Renderiza el puente montado con la URL indicada.
function render(pathname: string, search = "") {
  mocks.pathname = pathname;
  mocks.search = search;
  mocks.nextRef = 0;
  NotificationQueryBridge();
}

// Las 124 claves del catalogo al empezar la entrega 7, en su orden.
const CLAVES = [
  "login-success",

  // Comercial
  "client-created", "client-updated", "client-activated", "client-deactivated",
  "product-created", "product-updated", "product-activated",
  "product-deactivated", "product-category-activated",
  "product-category-deactivated", "order-created", "order-updated",
  "order-cancelled", "quote-created", "quote-annulled", "receipt-created",
  "receipt-annulled", "payment-registered",

  // Inventario
  "material-created", "material-updated", "material-activated",
  "material-deactivated", "supplier-created", "supplier-updated",
  "supplier-activated", "supplier-deactivated", "purchase-created",
  "purchase-annulled", "inventory-movement-created",
  "supplier-material-created", "supplier-material-updated",
  "supplier-material-activated", "supplier-material-deactivated",
  "supplier-payment-registered", "supplier-type-activated",
  "supplier-type-deactivated", "material-category-activated",
  "material-category-deactivated", "stock-alert-attended",

  // Mantenimiento
  "spare-part-created", "spare-part-updated", "spare-part-activated",
  "spare-part-deactivated", "machine-created", "machine-updated",
  "machine-status-updated", "machine-activated", "machine-deactivated",
  "failure-created", "failure-updated", "repair-created", "repair-updated",
  "preventive-maintenance-created", "preventive-maintenance-updated",

  // Produccion
  "campaign-created", "campaign-detail-created", "campaign-updated",
  "campaign-status-activa", "campaign-status-finalizada",
  "campaign-status-anulada", "work-order-created",
  "work-order-materials-consumed", "work-order-annulled",
  "work-order-finished", "route-stage-created", "route-stage-updated",
  "route-stage-activated", "route-stage-deactivated", "route-created",
  "route-updated", "route-activated", "route-deactivated",
  "recipe-version-created", "recipe-version-set-current",
  "recipe-version-annulled", "recipe-detail-created", "recipe-detail-updated",
  "recipe-detail-deleted", "recipe-created", "recipe-activated",
  "recipe-deactivated", "work-order-materials-delivered",
  "work-order-additional-delivery", "work-order-material-returned",
  "work-order-materials-closed", "work-order-materials-reopened",
  "work-order-progress-generated", "work-order-progress-updated",
  "work-order-progress-reassigned",

  // Costos
  "indirect-cost-created", "indirect-cost-annulled", "costing-created",
  "costing-updated", "costing-recalculated", "profitability-created",
  "margin-created",

  // Personal
  "operator-created", "operator-updated", "operator-activated",
  "operator-deactivated", "payroll-created", "payroll-annulled",
  "operator-task-created", "operator-task-annulled", "attendance-created",
  "operator-payment-registered",

  // Usuarios
  "user-created", "user-updated", "user-activated", "user-deactivated",
  "user-password-reset", "user-self-deactivate-blocked",

  // Caja chica
  "petty-cash-movement-annulled", "petty-cash-income-registered",
  "petty-cash-expense-registered", "petty-cash-box-created",
  "expense-category-created", "expense-category-updated",
  "expense-category-activated", "expense-category-deactivated",

  // Mermas y chatarra
  "scrap-sale-created", "scrap-created", "reusable-scrap-created",
];

beforeEach(() => {
  resetNotificationDoubles();
  mount();
});

it("la lista fija tiene las 124 claves sin repetir", () => {
  expect(CLAVES).toHaveLength(124);
  expect(new Set(CLAVES).size).toBe(124);
});

// Una clave nueva en el registro tambien entra en la lista y en el snapshot:
// asi cualquier mensaje que muestre el puente queda fijado y revisable.
it("la lista fija cubre todas las claves del registro", () => {
  expect([...CLAVES].sort()).toEqual(Object.keys(notificationRegistry).sort());
});

describe("cada clave del catalogo", () => {
  it.each(CLAVES)("%s: muestra su toast y limpia la URL", (clave) => {
    render("/dashboard", `toast=${clave}`);

    expect(takeNotificationCalls()).toMatchSnapshot();
  });
});

describe("URL", () => {
  it("sin ?toast= no muestra nada ni cambia la URL", () => {
    render("/dashboard/commercial/clients", "page=2");

    expect(takeNotificationCalls()).toEqual([]);
  });

  it("conserva los demas parametros al quitar toast", () => {
    render("/dashboard/commercial/clients", "page=2&toast=client-created&q=acero");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("con toast repetido muestra el primero y quita todos", () => {
    render("/dashboard", "toast=client-created&toast=order-created");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it.each(["no-existe", "Client-Created", "client-created%20"])(
    "clave sin entrada (%s): no muestra nada y limpia la URL",
    (clave) => {
      render("/dashboard/commercial/clients", `page=2&toast=${clave}`);

      expect(takeNotificationCalls()).toEqual([
        {
          effect: 'router.replace /dashboard/commercial/clients?page=2 {"scroll":false}',
        },
      ]);
    },
  );

  it("F3: con ?toast= vacio no muestra nada ni limpia la URL", () => {
    render("/dashboard", "toast=");

    expect(takeNotificationCalls()).toEqual([]);
  });
});

describe("F2: claves del prototipo de Object", () => {
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"])(
    "%s muestra un toast info vacio y limpia la URL",
    (clave) => {
      render("/dashboard", `toast=${clave}`);

      expect(takeNotificationCalls()).toMatchSnapshot();
    },
  );
});

describe("repeticion de claves en un mismo montaje", () => {
  it("el mismo render dos veces (modo estricto) muestra un solo toast", () => {
    render("/dashboard", "toast=client-created");
    render("/dashboard", "toast=client-created");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("F1: la misma clave tras limpiar la URL no se muestra y deja ?toast=", () => {
    render("/dashboard/commercial/clients", "toast=client-created");
    render("/dashboard/commercial/clients");
    takeNotificationCalls();

    render("/dashboard/commercial/clients", "toast=client-created");

    expect(takeNotificationCalls()).toEqual([]);
  });

  it("dos claves distintas seguidas se muestran las dos", () => {
    render("/dashboard/commercial/clients", "toast=client-created");
    render("/dashboard/commercial/clients");
    render("/dashboard/commercial/clients", "toast=client-deactivated");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("al volver a montar, como al recargar, la misma clave se muestra otra vez", () => {
    render("/dashboard", "toast=client-created");
    mount();
    render("/dashboard", "toast=client-created");

    expect(
      takeNotificationCalls().filter((call) => "toast" in call),
    ).toHaveLength(2);
  });
});
