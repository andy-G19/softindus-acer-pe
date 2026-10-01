import { beforeEach, describe, expect, it, vi } from "vitest";

// Pruebas de caracterizacion del control de acceso de las Server Actions de
// costos, mantenimiento, caja chica, personal y mermas.
//
// La tabla MODULOS registra, por archivo, los roles que cada accion exige.
// Se ejecutan las acciones reales: solo se reemplaza auth() de @/auth por una
// sesion de prueba, redirect() por una senal que corta la ejecucion y Prisma
// por un doble que registra cualquier acceso. Se simula @/auth y no
// @/lib/authz para ejercitar el control completo: la tabla se escribio antes
// de que estas acciones dejaran de leer la sesion por su cuenta y demostro que
// pasar a requireRole no cambio los permisos.
//
// Para cada accion se comprueba:
// - sin sesion: redirige a /login;
// - rol no permitido: redirige a acceso denegado;
// - sesion invalidada (usuario desactivado): redirige a /login con el motivo;
// - rol permitido: supera el control de acceso.
// Un rechazo nunca toca Prisma, la bitacora ni la cache.

const mocks = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(readonly url: string) {
      super(`redirect: ${url}`);
    }
  }

  class PrismaTouched extends Error {
    constructor(readonly property: string) {
      super(`prisma.${property}`);
    }
  }

  const prismaAccesses: string[] = [];

  // Cualquier uso de Prisma queda registrado y corta la accion: basta para
  // saber si el control de acceso dejo pasar la solicitud.
  const prisma = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property === "symbol" || property === "then") {
          return undefined;
        }

        prismaAccesses.push(property);
        throw new PrismaTouched(property);
      },
    },
  );

  return {
    RedirectSignal,
    PrismaTouched,
    prismaAccesses,
    prisma,
    auth: vi.fn(),
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
    registerAuditLog: vi.fn(),
    getNextCorrelativeId: vi.fn(),
    getNextCorrelativeIds: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit", () => ({ registerAuditLog: mocks.registerAuditLog }));
vi.mock("@/lib/correlatives", () => ({
  getNextCorrelativeId: mocks.getNextCorrelativeId,
  getNextCorrelativeIds: mocks.getNextCorrelativeIds,
}));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));

type Rol = "ADMIN" | "SELLER" | "WORKSHOP_MASTER";

const ROLES: Rol[] = ["ADMIN", "SELLER", "WORKSHOP_MASTER"];
const SOLO_ADMIN: Rol[] = ["ADMIN"];
const ADMIN_Y_TALLER: Rol[] = ["ADMIN", "WORKSHOP_MASTER"];

const LOGIN = "/login";
const SESSION_INVALID = `${LOGIN}?reason=session-invalid`;
const ACCESS_DENIED = "/dashboard/access-denied";
const AUTH_REDIRECTS = [LOGIN, SESSION_INVALID, ACCESS_DENIED];

type ModuloDeAcciones = {
  ruta: string;
  cargar: () => Promise<Record<string, unknown>>;
  roles: Rol[];
  acciones: string[];
};

const MODULOS: ModuloDeAcciones[] = [
  {
    ruta: "costs/costings/actions",
    cargar: () => import("@/modules/costs/costings/actions"),
    roles: SOLO_ADMIN,
    acciones: [
      "createCostingFromWorkOrderAction",
      "updateLaborCostAction",
      "recalculateCostingAction",
    ],
  },
  {
    ruta: "costs/indirect-costs/actions",
    cargar: () => import("@/modules/costs/indirect-costs/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createIndirectCostAction", "annulIndirectCostAction"],
  },
  {
    ruta: "costs/margins/actions",
    cargar: () => import("@/modules/costs/margins/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createMarginAction"],
  },
  {
    ruta: "costs/profitability/actions",
    cargar: () => import("@/modules/costs/profitability/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createProfitabilityAction"],
  },
  {
    ruta: "maintenance/failures/actions",
    cargar: () => import("@/modules/maintenance/failures/actions"),
    roles: ADMIN_Y_TALLER,
    acciones: ["createFailureAction", "updateFailureStatusAction"],
  },
  {
    ruta: "maintenance/machines/actions",
    cargar: () => import("@/modules/maintenance/machines/actions"),
    roles: SOLO_ADMIN,
    acciones: [
      "createMachineAction",
      "updateMachineAction",
      "updateMachineStatusAction",
      "toggleMachineStatusAction",
    ],
  },
  {
    ruta: "maintenance/preventive/actions",
    cargar: () => import("@/modules/maintenance/preventive/actions"),
    roles: SOLO_ADMIN,
    acciones: [
      "createPreventiveMaintenanceAction",
      "updatePreventiveMaintenanceStatusAction",
    ],
  },
  {
    ruta: "maintenance/repairs/actions",
    cargar: () => import("@/modules/maintenance/repairs/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createRepairAction", "updateRepairStatusAction"],
  },
  {
    ruta: "maintenance/spare-parts/actions",
    cargar: () => import("@/modules/maintenance/spare-parts/actions"),
    roles: SOLO_ADMIN,
    acciones: [
      "createSparePartAction",
      "updateSparePartAction",
      "updateSparePartStatusAction",
      "toggleSparePartStatusAction",
    ],
  },
  {
    ruta: "petty-cash/boxes/actions",
    cargar: () => import("@/modules/petty-cash/boxes/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createPettyCashBoxAction"],
  },
  {
    ruta: "petty-cash/categories/actions",
    cargar: () => import("@/modules/petty-cash/categories/actions"),
    roles: SOLO_ADMIN,
    acciones: [
      "createExpenseCategoryAction",
      "updateExpenseCategoryAction",
      "toggleExpenseCategoryStatusAction",
    ],
  },
  {
    ruta: "petty-cash/expenses/actions",
    cargar: () => import("@/modules/petty-cash/expenses/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createPettyCashExpenseAction"],
  },
  {
    ruta: "petty-cash/income-adjustments/actions",
    cargar: () => import("@/modules/petty-cash/income-adjustments/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createPettyCashIncomeAdjustmentAction"],
  },
  {
    ruta: "petty-cash/movements/actions",
    cargar: () => import("@/modules/petty-cash/movements/actions"),
    roles: SOLO_ADMIN,
    acciones: ["annulPettyCashMovementAction"],
  },
  {
    ruta: "staff/attendance/actions",
    cargar: () => import("@/modules/staff/attendance/actions"),
    roles: ADMIN_Y_TALLER,
    acciones: ["createAttendanceAction"],
  },
  {
    ruta: "staff/operators/actions",
    cargar: () => import("@/modules/staff/operators/actions"),
    roles: SOLO_ADMIN,
    acciones: [
      "createOperatorAction",
      "updateOperatorAction",
      "toggleOperatorStatusAction",
    ],
  },
  {
    ruta: "staff/payment-history/actions",
    cargar: () => import("@/modules/staff/payment-history/actions"),
    roles: SOLO_ADMIN,
    acciones: ["registerOperatorPaymentAction"],
  },
  {
    ruta: "staff/payrolls/actions",
    cargar: () => import("@/modules/staff/payrolls/actions"),
    roles: SOLO_ADMIN,
    acciones: ["generatePayrollAction", "cancelPayrollAction"],
  },
  {
    ruta: "staff/tasks/actions",
    cargar: () => import("@/modules/staff/tasks/actions"),
    roles: ADMIN_Y_TALLER,
    acciones: ["createOperatorTaskAction", "cancelOperatorTaskAction"],
  },
  {
    ruta: "waste-scrap/reusable-scraps/actions",
    cargar: () => import("@/modules/waste-scrap/reusable-scraps/actions"),
    roles: ADMIN_Y_TALLER,
    acciones: ["createReusableScrapAction"],
  },
  {
    ruta: "waste-scrap/reusable-scraps/status-actions",
    cargar: () => import("@/modules/waste-scrap/reusable-scraps/status-actions"),
    roles: ADMIN_Y_TALLER,
    acciones: ["updateReusableScrapStatusAction"],
  },
  {
    ruta: "waste-scrap/scrap-sales/actions",
    cargar: () => import("@/modules/waste-scrap/scrap-sales/actions"),
    roles: SOLO_ADMIN,
    acciones: ["createScrapSaleAction"],
  },
  {
    ruta: "waste-scrap/scraps/actions",
    cargar: () => import("@/modules/waste-scrap/scraps/actions"),
    roles: ADMIN_Y_TALLER,
    acciones: ["createScrapAction"],
  },
];

const USER_ID = "USU00000001";
const EXPIRES = "2099-01-01T00:00:00.000Z";

function activeSession(role: Rol) {
  return {
    user: { id: USER_ID, name: "Usuario de prueba", role, status: "activo" },
    expires: EXPIRES,
  };
}

/** Lo que deja src/auth.ts cuando la revalidacion contra la base falla. */
const INVALIDATED_SESSION = {
  user: { id: "", name: "Usuario de prueba", role: "", status: "inactivo" },
  expires: EXPIRES,
};

type ServerAction = (...args: unknown[]) => Promise<unknown>;

async function loadAction(modulo: ModuloDeAcciones, name: string) {
  const exports = await modulo.cargar();
  const action = exports[name];

  if (typeof action !== "function") {
    throw new Error(`${modulo.ruta} no exporta ${name}.`);
  }

  return action as ServerAction;
}

/**
 * Ejecuta la accion con un formulario vacio. Las acciones de useActionState
 * reciben (prevState, formData); las de formulario directo, solo formData.
 * Devuelve el destino si la accion redirige; cualquier otro final (retorno,
 * error de validacion o acceso a Prisma) significa que supero el control.
 */
async function run(action: ServerAction) {
  const formData = new FormData();

  try {
    if (action.length >= 2) {
      await action({ error: "" }, formData);
    } else {
      await action(formData);
    }
  } catch (error) {
    if (error instanceof mocks.RedirectSignal) {
      return { redirectedTo: error.url };
    }

    return { redirectedTo: null };
  }

  return { redirectedTo: null };
}

function expectNoSideEffects() {
  expect(mocks.prismaAccesses).toEqual([]);
  expect(mocks.registerAuditLog).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prismaAccesses.length = 0;

  mocks.redirect.mockImplementation((url: string) => {
    throw new mocks.RedirectSignal(url);
  });
  mocks.auth.mockResolvedValue(null);
});

describe.each(MODULOS)("$ruta", (modulo) => {
  const permitidos = modulo.roles;
  const denegados = ROLES.filter((role) => !permitidos.includes(role));

  it("la tabla incluye todas las acciones exportadas", async () => {
    const exports = await modulo.cargar();
    const exported = Object.keys(exports).filter(
      (name) => typeof exports[name] === "function",
    );

    expect(exported.sort()).toEqual([...modulo.acciones].sort());
  });

  describe.each(modulo.acciones)("%s", (name) => {
    it("sin sesion redirige a /login", async () => {
      const action = await loadAction(modulo, name);

      await expect(run(action)).resolves.toEqual({ redirectedTo: LOGIN });
      expectNoSideEffects();
    });

    it("con la sesion invalidada redirige a /login con el motivo", async () => {
      mocks.auth.mockResolvedValue(INVALIDATED_SESSION);
      const action = await loadAction(modulo, name);

      await expect(run(action)).resolves.toEqual({ redirectedTo: SESSION_INVALID });
      expectNoSideEffects();
    });

    it.each(denegados)("con rol %s redirige a acceso denegado", async (role) => {
      mocks.auth.mockResolvedValue(activeSession(role));
      const action = await loadAction(modulo, name);

      await expect(run(action)).resolves.toEqual({ redirectedTo: ACCESS_DENIED });
      expectNoSideEffects();
    });

    it.each(permitidos)("con rol %s supera el control de acceso", async (role) => {
      mocks.auth.mockResolvedValue(activeSession(role));
      const action = await loadAction(modulo, name);

      const { redirectedTo } = await run(action);

      expect(AUTH_REDIRECTS).not.toContain(redirectedTo);
      expect(mocks.auth).toHaveBeenCalledTimes(1);
    });
  });
});
