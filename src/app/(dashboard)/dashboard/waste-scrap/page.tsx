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

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatMoney(value: unknown) {
  return `S/ ${formatNumber(value)}`;
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getStatusClass(status: string) {
  if (["disponible", "acumulada"].includes(status)) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (["reutilizado", "vendida"].includes(status)) {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "descartado") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function WasteScrapDashboardPage() {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canRegisterSale = session.user.role === APP_ROLES.ADMIN;

  const [
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
    totalChatarra,
    chatarraAcumulada,
    chatarraVendida,
    ventasChatarra,
    ingresosChatarra,
    latestRetazos,
    pendingScraps,
    latestSales,
  ] = await Promise.all([
    prisma.retazo_reutilizable.count(),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "disponible",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "reutilizado",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "descartado",
      },
    }),

    prisma.chatarra.count(),

    prisma.chatarra.count({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
    }),

    prisma.chatarra.count({
      where: {
        estado: "vendida",
      },
    }),

    prisma.venta_chatarra.count(),

    prisma.venta_chatarra.aggregate({
      _sum: {
        monto_recibido: true,
        peso_vendido_kg: true,
        cantidad_vendida: true,
      },
    }),

    prisma.retazo_reutilizable.findMany({
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        material: true,
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
    }),

    prisma.chatarra.findMany({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        material: true,
      },
    }),

    prisma.venta_chatarra.findMany({
      orderBy: {
        fecha_venta: "desc",
      },
      take: 5,
      include: {
        chatarra: {
          include: {
            material: true,
          },
        },
        movimiento_caja: true,
      },
    }),
  ]);

  const totalIngresos = toNumber(ingresosChatarra._sum.monto_recibido);
  const totalPesoVendido = toNumber(ingresosChatarra._sum.peso_vendido_kg);
  const totalCantidadVendida = toNumber(
    ingresosChatarra._sum.cantidad_vendida,
  );

  const moduleReady =
    totalRetazos > 0 || totalChatarra > 0 || ventasChatarra > 0;

  const hasAvailableReusableScraps = retazosDisponibles > 0;
  const hasPendingScrapSales = chatarraAcumulada > 0;
  const hasScrapIncome = totalIngresos > 0;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Fase 6
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Mermas, Retazos y Chatarra
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Controla los sobrantes generados en producción, diferenciando
            retazos reutilizables, chatarra acumulada y ventas de chatarra como
            ingreso menor del taller.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/waste-scrap/reusable-scraps/new"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Registrar retazo
          </Link>

          <Link
            href="/dashboard/waste-scrap/scraps/new"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Registrar chatarra
          </Link>

          {canRegisterSale ? (
            <Link
              href="/dashboard/waste-scrap/scrap-sales/new"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Registrar venta
            </Link>
          ) : null}

          <Link
            href="/dashboard/waste-scrap/reusable-scraps"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Ver retazos
          </Link>

          <Link
            href="/dashboard/waste-scrap/scraps"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Ver chatarra
          </Link>
        </div>
      </section>

      <section
        className={`rounded-xl border p-5 text-sm ${
          moduleReady
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <p className="font-semibold">
          {moduleReady
            ? "✅ Módulo operativo y con registros"
            : "⚠️ Módulo listo para iniciar registros"}
        </p>

        <p className="mt-1">
          {moduleReady
            ? "El módulo ya permite registrar, consultar y controlar retazos, chatarra y ventas de chatarra."
            : "Aún no hay registros. Empieza registrando retazos reutilizables o chatarra generada."}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Retazos registrados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{totalRetazos}</p>
            <p className="mt-1 text-xs text-slate-500">
              {retazosDisponibles} disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Retazos reutilizados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{retazosReutilizados}</p>
            <p className="mt-1 text-xs text-slate-500">
              {retazosDescartados} descartados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Chatarra pendiente
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{chatarraAcumulada}</p>
            <p className="mt-1 text-xs text-slate-500">
              {chatarraVendida} registros vendidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Ingresos por chatarra
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{formatMoney(totalIngresos)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {ventasChatarra} venta(s) registradas
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Retazos disponibles
          </p>

          <p className="mt-2 text-2xl font-bold">
            {hasAvailableReusableScraps ? "Sí" : "No"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {hasAvailableReusableScraps
              ? "Existen retazos que pueden ser reutilizados en producción."
              : "No hay retazos disponibles para reutilizar."}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Chatarra pendiente de venta
          </p>

          <p className="mt-2 text-2xl font-bold">
            {hasPendingScrapSales ? "Sí" : "No"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {hasPendingScrapSales
              ? "Hay chatarra acumulada que puede generar ingreso menor."
              : "No hay chatarra acumulada pendiente de venta."}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Ingreso recuperado
          </p>

          <p className="mt-2 text-2xl font-bold">
            {hasScrapIncome ? "Registrado" : "Sin ingresos"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Peso vendido: {formatNumber(totalPesoVendido)} kg · Cantidad:{" "}
            {formatNumber(totalCantidadVendida)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">Últimos retazos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Retazos reutilizables registrados recientemente.
              </p>
            </div>

            <Link
              href="/dashboard/waste-scrap/reusable-scraps"
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              Ver todos →
            </Link>
          </div>

          {latestRetazos.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Aún no hay retazos registrados.
            </div>
          ) : (
            <div className="divide-y">
              {latestRetazos.map((item) => (
                <div
                  key={item.id_retazo}
                  className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-mono text-xs text-slate-500">
                      {item.id_retazo} · {formatDate(item.fecha_registro)}
                    </p>

                    <p className="font-medium">
                      {item.material.nombre_material}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatNumber(item.cantidad)} {item.unidad_medida} ·{" "}
                      {item.medida_aproximada ?? "Sin medida"} ·{" "}
                      {item.ubicacion ?? "Sin ubicación"}
                    </p>

                    {item.orden_trabajo ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Orden: {item.orden_trabajo.id_orden_trabajo} ·{" "}
                        {item.orden_trabajo.producto.nombre_producto}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                      item.estado,
                    )}`}
                  >
                    {item.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">Chatarra pendiente</h2>
              <p className="mt-1 text-sm text-slate-500">
                Chatarra acumulada o disponible para venta.
              </p>
            </div>

            <Link
              href="/dashboard/waste-scrap/scraps"
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              Ver todos →
            </Link>
          </div>

          {pendingScraps.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              No hay chatarra pendiente de venta.
            </div>
          ) : (
            <div className="divide-y">
              {pendingScraps.map((item) => (
                <div key={item.id_chatarra} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-slate-500">
                      {item.id_chatarra}
                    </p>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                        item.estado,
                      )}`}
                    >
                      {item.estado}
                    </span>
                  </div>

                  <p className="mt-2 font-medium">{item.tipo_material}</p>

                  <p className="mt-1 text-sm text-slate-500">
                    Peso:{" "}
                    {item.peso_kg ? `${formatNumber(item.peso_kg)} kg` : "-"} ·
                    Cantidad: {item.cantidad ? formatNumber(item.cantidad) : "-"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Material origen:{" "}
                    {item.material?.nombre_material ?? "No identificado"}
                  </p>

                  {canRegisterSale ? (
                    <Link
                      href={`/dashboard/waste-scrap/scrap-sales/new?id_chatarra=${item.id_chatarra}`}
                      className="mt-3 inline-block text-sm font-medium text-slate-700 hover:text-slate-950"
                    >
                      Registrar venta →
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Últimas ventas de chatarra</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ingresos menores obtenidos por venta de chatarra.
          </p>
        </div>

        {latestSales.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Aún no hay ventas de chatarra registradas.
          </div>
        ) : (
          <div className="divide-y">
            {latestSales.map((item) => (
              <div
                key={item.id_venta_chatarra}
                className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
              >
                <div>
                  <p className="font-mono text-xs text-slate-500">
                    {item.id_venta_chatarra} · {formatDate(item.fecha_venta)}
                  </p>

                  <p className="font-medium">
                    {item.chatarra.tipo_material}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Peso vendido:{" "}
                    {item.peso_vendido_kg
                      ? `${formatNumber(item.peso_vendido_kg)} kg`
                      : "-"}{" "}
                    · Cantidad:{" "}
                    {item.cantidad_vendida
                      ? formatNumber(item.cantidad_vendida)
                      : "-"}{" "}
                    · Monto: {formatMoney(item.monto_recibido)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Destino: {item.destino_dinero ?? "No especificado"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Caja chica:{" "}
                    {item.id_movimiento_caja
                      ? `vinculada al movimiento ${item.id_movimiento_caja}`
                      : "no vinculada"}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  Venta registrada
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Validaciones finales del módulo</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-800">
              ✅ Registro de retazos reutilizables
            </p>
            <p className="mt-1 text-slate-500">
              Se pueden registrar retazos con material, cantidad, unidad,
              ubicación y orden relacionada opcional.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-800">
              ✅ Registro de chatarra generada
            </p>
            <p className="mt-1 text-slate-500">
              Se puede registrar chatarra por tipo, peso, cantidad y material de
              origen opcional.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-800">
              ✅ Venta de chatarra
            </p>
            <p className="mt-1 text-slate-500">
              La venta cambia la chatarra a vendida y puede generar ingreso en
              caja chica.
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-800">
              ✅ Cambio de estado de retazos
            </p>
            <p className="mt-1 text-slate-500">
              Los retazos disponibles pueden marcarse como reutilizados o
              descartados.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}