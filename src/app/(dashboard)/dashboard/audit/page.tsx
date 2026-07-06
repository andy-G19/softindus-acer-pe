import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type PageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const usuario = parseStringParam(params, "usuario");
  const accion = parseStringParam(params, "accion");
  const entidad = parseStringParam(params, "entidad");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.bitacora_operacionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { detalle: { contains: q, mode: "insensitive" } },
        { accion: { contains: q, mode: "insensitive" } },
        { entidad_afectada: { contains: q, mode: "insensitive" } },
        { id_registro_afectado: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (usuario) {
    filters.push({ id_usuario: usuario });
  }

  if (accion) {
    filters.push({ accion });
  }

  if (entidad) {
    filters.push({ entidad_afectada: entidad });
  }

  if (dateRange) {
    filters.push({ fecha_hora: dateRange });
  }

  const where: Prisma.bitacora_operacionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [users, actions, entities, logs, totalLogs] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      distinct: ["accion"],
      orderBy: {
        accion: "asc",
      },
      select: {
        accion: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      distinct: ["entidad_afectada"],
      orderBy: {
        entidad_afectada: "asc",
      },
      select: {
        entidad_afectada: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      where,
      orderBy: {
        fecha_hora: "desc",
      },
      take: 150,
      include: {
        usuario: true,
      },
    }),
    prisma.bitacora_operacion.count({ where }),
  ]);

  const exportParams = {
    q,
    usuario,
    accion,
    entidad,
    from,
    to,
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Bitácora de operaciones"
        description="Consulta solo lectura de acciones críticas, entidades afectadas, usuarios responsables, fecha, detalle e IP registrada."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Auditoría" }])}
        actions={
          <>
            <Link href={buildReportExportHref("audit", exportParams)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
              Exportar Excel
            </Link>
            <Link href={buildReportExportHref("audit", exportParams, "pdf")} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Exportar PDF
            </Link>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <input name="q" defaultValue={q} placeholder="Buscar detalle, entidad o accion" className="rounded-md border px-3 py-2 text-sm" />
            <select name="usuario" defaultValue={usuario} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los usuarios</option>
              {users.map((user) => (
                <option key={user.id_usuario} value={user.id_usuario}>
                  {user.apellidos}, {user.nombres}
                </option>
              ))}
            </select>
            <select name="accion" defaultValue={accion} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todas las acciones</option>
              {actions.map((item) => (
                <option key={item.accion} value={item.accion}>
                  {item.accion}
                </option>
              ))}
            </select>
            <select name="entidad" defaultValue={entidad} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todas las entidades</option>
              {entities.map((item) => (
                <option key={item.entidad_afectada} value={item.entidad_afectada}>
                  {item.entidad_afectada}
                </option>
              ))}
            </select>
            <input name="from" type="date" defaultValue={from} className="rounded-md border px-3 py-2 text-sm" />
            <input name="to" type="date" defaultValue={to} className="rounded-md border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Filtrar
              </button>
              <Link href="/dashboard/audit" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                Limpiar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Operaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLogs}</p>
            <p className="text-xs text-muted-foreground">Coincidencias segun filtros.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Set(logs.map((log) => log.id_usuario)).size}</p>
            <p className="text-xs text-muted-foreground">Usuarios en la vista actual.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Entidades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Set(logs.map((log) => log.entidad_afectada)).size}</p>
            <p className="text-xs text-muted-foreground">Entidades afectadas.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operaciones registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron operaciones con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Usuario</th>
                    <th className="py-2 pr-3">Accion</th>
                    <th className="py-2 pr-3">Entidad</th>
                    <th className="py-2 pr-3">Registro</th>
                    <th className="py-2 pr-3">Detalle</th>
                    <th className="py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id_bitacora} className="border-b align-top">
                      <td className="py-2 pr-3">{formatDateTime(log.fecha_hora)}</td>
                      <td className="py-2 pr-3">{log.usuario.apellidos}, {log.usuario.nombres}</td>
                      <td className="py-2 pr-3">{log.accion}</td>
                      <td className="py-2 pr-3">{log.entidad_afectada}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{log.id_registro_afectado ?? "-"}</td>
                      <td className="max-w-xl py-2 pr-3">{log.detalle ?? "-"}</td>
                      <td className="py-2">{log.ip_origen ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}


