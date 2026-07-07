import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SearchableSelectFilter } from "@/components/forms/searchable-select-filter";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
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
  const returnTo = createReturnToHref(navigationHrefs.clients, params);
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
      <PageHeader
        title="Clientes"
        description="Lista de clientes registrados en el sistema."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Clientes" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/commercial/clients/new">Nuevo cliente</Link>
          </Button>
        }
      />

      <form
        method="GET"
        className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-3 xl:grid-cols-5"
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
          <Label htmlFor="q">Búsqueda general</Label>
          <Input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Buscar por nombre, documento, teléfono o correo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <NativeSelect id="type" name="type" defaultValue={type}>
            <option value="">Todos los tipos</option>
            {clientTypes.map((clientType) => (
              <option key={clientType} value={clientType}>
                {clientType}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="origin">Origen</Label>
          <Input
            id="origin"
            name="origin"
            type="text"
            defaultValue={origin}
            placeholder="Origen"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2 md:col-span-3 xl:col-span-5">
          <Button type="submit">Filtrar</Button>

          <Button variant="outline" asChild>
            <Link href="/dashboard/commercial/clients">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        Resultados encontrados: {clients.length}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((clientItem) => (
            <TableRow key={clientItem.id_cliente}>
              <TableCell>{clientItem.id_cliente}</TableCell>
              <TableCell className="font-medium">
                {clientItem.nombre_razon_social}
              </TableCell>
              <TableCell>{clientItem.tipo_cliente}</TableCell>
              <TableCell>{clientItem.telefono ?? "-"}</TableCell>
              <TableCell>{clientItem.lugar_origen ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={clientItem.estado ? "success" : "outline"}>
                  {clientItem.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={withReturnTo(
                        `${navigationHrefs.clients}/${clientItem.id_cliente}/edit`,
                        returnTo,
                      )}
                    >
                      Editar
                    </Link>
                  </Button>

                  <form action={toggleClientStatusAction}>
                    <input
                      type="hidden"
                      name="id_cliente"
                      value={clientItem.id_cliente}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {clientItem.estado ? "Inactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {clients.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  className="border-0"
                  label="No se encontraron clientes con los filtros aplicados."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
