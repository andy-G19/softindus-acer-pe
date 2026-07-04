import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SearchableSelectFilter } from "@/components/forms/searchable-select-filter";
import { prisma } from "@/lib/db";
import { toggleClientStatusAction } from "@/modules/commercial/clients/actions";
import type { Prisma } from "@/generated/prisma/client";

type ClientsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const client = getSearchParam(params, "client");
  const q = getSearchParam(params, "q");
  const type = getSearchParam(params, "type");
  const status = getSearchParam(params, "status");
  const origin = getSearchParam(params, "origin");
  const filters: Prisma.clienteWhereInput[] = [];

  if (client) {
    filters.push({ id_cliente: client });
  }

  if (q) {
    filters.push({
      OR: [
        { nombre_razon_social: { contains: q, mode: "insensitive" } },
        { numero_documento: { contains: q, mode: "insensitive" } },
        { telefono: { contains: q, mode: "insensitive" } },
        { correo: { contains: q, mode: "insensitive" } },
        { direccion: { contains: q, mode: "insensitive" } },
        { lugar_origen: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (type) {
    filters.push({ tipo_cliente: type });
  }

  if (status === "activo") {
    filters.push({ estado: true });
  }

  if (status === "inactivo") {
    filters.push({ estado: false });
  }

  if (origin) {
    filters.push({
      lugar_origen: { contains: origin, mode: "insensitive" },
    });
  }

  const [clientOptions, clients] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
        tipo_cliente: true,
        numero_documento: true,
        telefono: true,
        lugar_origen: true,
      },
    }),
    prisma.cliente.findMany({
      where: filters.length > 0 ? { AND: filters } : undefined,
      orderBy: {
        fecha_registro: "desc",
      },
    }),
  ]);

  const clientItems = clientOptions.map((item) => ({
    id: item.id_cliente,
    label: item.nombre_razon_social,
    description: [
      item.id_cliente,
      item.tipo_cliente,
      item.numero_documento,
      item.telefono,
      item.lugar_origen,
    ]
      .filter(Boolean)
      .join(" - "),
  }));

  const clientTypes = Array.from(
    new Set(clientOptions.map((item) => item.tipo_cliente).filter(Boolean)),
  ).sort();

  return (
    <main className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Lista de clientes registrados en el sistema.
          </p>
        </div>

        <Link
          href="/dashboard/commercial/clients/new"
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Nuevo cliente
        </Link>
      </div>

      <form
        method="GET"
        className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-3 xl:grid-cols-5"
      >
        <SearchableSelectFilter
          key={client}
          name="client"
          label="Cliente"
          placeholder="Buscar cliente por nombre o código"
          items={clientItems}
          value={client}
          emptyMessage="No se encontraron clientes."
        />

        <div className="space-y-2">
          <label htmlFor="q" className="text-sm font-medium">
            Búsqueda general
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Buscar por nombre, documento, teléfono o correo"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="type" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos los tipos</option>
            {clientTypes.map((clientType) => (
              <option key={clientType} value={clientType}>
                {clientType}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="origin" className="text-sm font-medium">
            Origen
          </label>
          <input
            id="origin"
            name="origin"
            type="text"
            defaultValue={origin}
            placeholder="Origen"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 md:col-span-3 xl:col-span-5">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>

          <Link
            href="/dashboard/commercial/clients"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        Resultados encontrados: {clients.length}
      </p>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Origen</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((clientItem) => (
              <tr key={clientItem.id_cliente} className="border-t">
                <td className="px-4 py-3">{clientItem.id_cliente}</td>
                <td className="px-4 py-3">
                  {clientItem.nombre_razon_social}
                </td>
                <td className="px-4 py-3">{clientItem.tipo_cliente}</td>
                <td className="px-4 py-3">{clientItem.telefono ?? "-"}</td>
                <td className="px-4 py-3">
                  {clientItem.lugar_origen ?? "-"}
                </td>
                <td className="px-4 py-3">
                  {clientItem.estado ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/commercial/clients/${clientItem.id_cliente}/edit`}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      Editar
                    </Link>

                    <form action={toggleClientStatusAction}>
                      <input
                        type="hidden"
                        name="id_cliente"
                        value={clientItem.id_cliente}
                      />
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5 text-xs font-medium"
                      >
                        {clientItem.estado ? "Inactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {clients.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  No se encontraron clientes con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
