import { vi } from "vitest";

import { definePageSuite, generatedRow } from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

// Caracterizacion de Usuarios (entrega 4.5), escrita antes
// de mover sus consultas a modules/users/queries.ts.

// El usuario editado es el de la sesion: la pagina impide cambiar su propio rol
// y estado.
const sessionUser = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("usuario", "findUnique", args),
  id_usuario: "USU00000001",
});

definePageSuite([
  {
    route: "/dashboard/users",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "ana", rol: "SELLER", estado: "activo", page: "2" },
      },
      { name: "estado desconocido no filtra", searchParams: { estado: "todos" } },
    ],
  },
  {
    route: "/dashboard/users/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar otro usuario", params: { id: "USU00000002" } },
      {
        name: "editar el propio usuario",
        params: { id: "USU00000001" },
        data: { "usuario.findUnique": sessionUser },
      },
      {
        name: "inexistente",
        params: { id: "USU99999999" },
        data: { "usuario.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/users/[id]/reset-password",
    load: () => import("./[id]/reset-password/page"),
    cases: [
      { name: "restablecer", params: { id: "USU00000002" } },
      {
        name: "inexistente",
        params: { id: "USU99999999" },
        data: { "usuario.findUnique": null },
      },
    ],
  },
]);
