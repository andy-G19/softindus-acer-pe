import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";

const REPORT_MODULE_OPTIONS = [
  "Reporte de producción",
  "Reporte de inventario",
  "Reporte de ventas y cobranzas",
  "Reporte de proveedores y compras",
  "Reporte financiero",
  "Reporte de mantenimiento",
];

const FORMAT_OPTIONS = [
  { value: "excel", label: "Excel / CSV" },
  { value: "pdf", label: "PDF" },
];

const STATUS_OPTIONS = [
  { value: "generada", label: "Generada" },
  { value: "fallida", label: "Fallida" },
];

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function parseDateInputAsNextDay(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day + 1);
}

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

function getFormatLabel(format: string) {
  return FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format;
}

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatParams(value: string | null) {
  if (!value || value === "{}") {
    return "Sin filtros";
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;

    const entries = Object.entries(parsed).filter(([, entryValue]) => {
      return Boolean(entryValue);
    });

    if (entries.length === 0) {
      return "Sin filtros";
    }

    return entries
      .map(([key, entryValue]) => {
        return `${key}: ${entryValue}`;
      })
      .join(" | ");
  } catch {
    return value;
  }
}

type SummaryCardProps = {
  title: string;
  value: string | number;
  description: string;
};

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function ExportHistoryPage({ searchParams }: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const reportModule = getSearchParam(params, "module");
  const format = getSearchParam(params, "format");
  const status = getSearchParam(params, "status");
  const userId = getSearchParam(params, "userId");
  const searchText = getSearchParam(params, "searchText").trim();

  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);

  const dateRangeFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lt: toDate } : {}),
        }
      : undefined;

  const exportWhere = {
    ...(dateRangeFilter
      ? {
          fecha_exportacion: dateRangeFilter,
        }
      : {}),
    ...(reportModule ? { modulo_origen: reportModule } : {}),
    ...(format ? { formato: format } : {}),
    ...(status ? { estado: status } : {}),
    ...(userId ? { id_usuario: userId } : {}),
    ...(searchText
      ? {
          OR: [
            {
              modulo_origen: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              ruta_archivo: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              parametros: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [users, exports] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        estado: "activo",
      },
      orderBy: [
        {
          apellidos: "asc",
        },
        {
          nombres: "asc",
        },
      ],
    }),

    prisma.exportacion_datos.findMany({
      where: exportWhere,
      orderBy: {
        fecha_exportacion: "desc",
      },
      take: 150,
      include: {
        usuario: true,
      },
    }),
  ]);

  const totalExports = exports.length;

  const excelExports = exports.filter((exportItem) => {
    return exportItem.formato === "excel";
  }).length;

  const pdfExports = exports.filter((exportItem) => {
    return exportItem.formato === "pdf";
  }).length;

  const generatedExports = exports.filter((exportItem) => {
    return exportItem.estado === "generada";
  }).length;

  const uniqueUsers = new Set(
    exports.map((exportItem) => exportItem.id_usuario),
  ).size;

  const uniqueModules = new Set(
    exports.map((exportItem) => exportItem.modulo_origen),
  ).size;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Fase 10 · Subfase 10.4.3
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Historial de exportaciones
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta la trazabilidad de reportes exportados: usuario, módulo,
            formato, filtros aplicados, fecha y archivo generado.
          </p>
        </div>

        <Link
          href="/dashboard/reports"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Volver al dashboard
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del historial</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-2">
              <label htmlFor="dateFrom" className="text-sm font-medium">
                Fecha desde
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dateTo" className="text-sm font-medium">
                Fecha hasta
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="module" className="text-sm font-medium">
                Reporte
              </label>
              <select
                id="module"
                name="module"
                defaultValue={reportModule}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los reportes</option>
                {REPORT_MODULE_OPTIONS.map((moduleOption) => (
                  <option key={moduleOption} value={moduleOption}>
                    {moduleOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="format" className="text-sm font-medium">
                Formato
              </label>
              <select
                id="format"
                name="format"
                defaultValue={format}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los formatos</option>
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
                Usuario
              </label>
              <select
                id="userId"
                name="userId"
                defaultValue={userId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los usuarios</option>
                {users.map((user) => (
                  <option key={user.id_usuario} value={user.id_usuario}>
                    {user.apellidos}, {user.nombres}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="searchText" className="text-sm font-medium">
                Buscar
              </label>
              <input
                id="searchText"
                name="searchText"
                type="text"
                defaultValue={searchText}
                placeholder="Archivo, filtros..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 xl:col-span-7">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/reports/export-history"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Exportaciones"
          value={totalExports}
          description="Registros encontrados según filtros."
        />

        <SummaryCard
          title="Excel / CSV"
          value={excelExports}
          description="Exportaciones registradas como Excel."
        />

        <SummaryCard
          title="PDF"
          value={pdfExports}
          description="Exportaciones PDF registradas."
        />

        <SummaryCard
          title="Generadas"
          value={generatedExports}
          description="Exportaciones completadas correctamente."
        />

        <SummaryCard
          title="Usuarios"
          value={uniqueUsers}
          description="Usuarios que exportaron reportes."
        />

        <SummaryCard
          title="Módulos"
          value={uniqueModules}
          description="Tipos de reporte exportados."
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del historial
          </CardTitle>
        </CardHeader>

        <CardContent>
          {exports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron exportaciones con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Usuario</th>
                    <th className="py-2 pr-3 font-medium">Reporte</th>
                    <th className="py-2 pr-3 font-medium">Formato</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Archivo</th>
                    <th className="py-2 pr-3 font-medium">Filtros usados</th>
                  </tr>
                </thead>

                <tbody>
                  {exports.map((exportItem) => (
                    <tr key={exportItem.id_exportacion} className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">
                        {exportItem.id_exportacion}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDateTime(exportItem.fecha_exportacion)}
                      </td>

                      <td className="py-2 pr-3">
                        <div>
                          <p className="font-medium">
                            {exportItem.usuario.apellidos},{" "}
                            {exportItem.usuario.nombres}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {exportItem.usuario.correo}
                          </p>
                        </div>
                      </td>

                      <td className="py-2 pr-3">
                        {exportItem.modulo_origen}
                      </td>

                      <td className="py-2 pr-3">
                        {getFormatLabel(exportItem.formato)}
                      </td>

                      <td className="py-2 pr-3">
                        {getStatusLabel(exportItem.estado)}
                      </td>

                      <td className="min-w-56 py-2 pr-3">
                        {exportItem.ruta_archivo ?? "-"}
                      </td>

                      <td className="min-w-80 py-2 pr-3 text-xs text-muted-foreground">
                        {formatParams(exportItem.parametros)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Se muestran como máximo 150 exportaciones para mantener una consulta
            rápida.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este historial sirve como trazabilidad administrativa: permite auditar
          qué usuario exportó información, desde qué módulo, con qué filtros y
          en qué fecha.
        </p>
      </section>
    </div>
  );
}