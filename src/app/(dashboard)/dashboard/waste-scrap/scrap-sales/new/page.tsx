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
import { createScrapSaleAction } from "@/modules/waste-scrap/scrap-sales/actions";

type SearchParams = {
  id_chatarra?: string;
};

type NewScrapSalePageProps = {
  searchParams?: Promise<SearchParams>;
};

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

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function NewScrapSalePage({
  searchParams,
}: NewScrapSalePageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};
  const selectedScrapId = params.id_chatarra?.trim() ?? "";

  const [scraps, cashBoxes] = await Promise.all([
    prisma.chatarra.findMany({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
      },
    }),

    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        fecha_apertura: "desc",
      },
      select: {
        id_caja_chica: true,
        nombre_caja: true,
        saldo_actual: true,
        responsable: true,
      },
    }),
  ]);

  const selectedScrap = scraps.find(
    (item) => item.id_chatarra === selectedScrapId,
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Mermas y chatarra · Venta de chatarra
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar venta de chatarra
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra el ingreso obtenido por vender chatarra acumulada. Si
            seleccionas una caja chica abierta, el sistema también generará un
            movimiento de caja de tipo ingreso.
          </p>
        </div>

        <Link
          href="/dashboard/waste-scrap/scraps"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver a chatarra
        </Link>
      </section>

      {scraps.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">No hay chatarra disponible para venta.</p>
          <p className="mt-1">
            Primero registra chatarra generada o verifica que no esté marcada
            como vendida.
          </p>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la venta</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createScrapSaleAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="id_chatarra"
                  className="text-sm font-medium text-slate-700"
                >
                  Chatarra a vender *
                </label>

                <select
                  id="id_chatarra"
                  name="id_chatarra"
                  required
                  defaultValue={selectedScrapId}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="" disabled>
                    Selecciona un registro de chatarra
                  </option>

                  {scraps.map((item) => (
                    <option key={item.id_chatarra} value={item.id_chatarra}>
                      {item.id_chatarra} · {item.tipo_material} · Peso:{" "}
                      {item.peso_kg ? `${item.peso_kg.toString()} kg` : "-"} ·
                      Cantidad: {item.cantidad ? item.cantidad.toString() : "-"}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-slate-500">
                  Solo se muestran registros con estado acumulada o disponible.
                </p>
              </div>

              {selectedScrap ? (
                <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600 md:col-span-2">
                  <p className="font-medium text-slate-800">
                    Chatarra seleccionada
                  </p>
                  <p className="mt-1">
                    Código: {selectedScrap.id_chatarra} · Tipo:{" "}
                    {selectedScrap.tipo_material}
                  </p>
                  <p className="mt-1">
                    Material origen:{" "}
                    {selectedScrap.material?.nombre_material ??
                      "No identificado"}
                  </p>
                  <p className="mt-1">
                    Peso registrado:{" "}
                    {selectedScrap.peso_kg
                      ? `${formatNumber(selectedScrap.peso_kg)} kg`
                      : "-"}{" "}
                    · Cantidad registrada:{" "}
                    {selectedScrap.cantidad
                      ? formatNumber(selectedScrap.cantidad)
                      : "-"}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="fecha_venta"
                  className="text-sm font-medium text-slate-700"
                >
                  Fecha de venta *
                </label>

                <input
                  id="fecha_venta"
                  name="fecha_venta"
                  type="date"
                  required
                  defaultValue={formatDateInput(new Date())}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="monto_recibido"
                  className="text-sm font-medium text-slate-700"
                >
                  Monto recibido *
                </label>

                <input
                  id="monto_recibido"
                  name="monto_recibido"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 80.00"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="peso_vendido_kg"
                  className="text-sm font-medium text-slate-700"
                >
                  Peso vendido en kg
                </label>

                <input
                  id="peso_vendido_kg"
                  name="peso_vendido_kg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedScrap?.peso_kg?.toString() ?? ""}
                  placeholder="Ejemplo: 15.00"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />

                <p className="text-xs text-slate-500">
                  Si lo dejas vacío, se usará el peso registrado en la chatarra.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="cantidad_vendida"
                  className="text-sm font-medium text-slate-700"
                >
                  Cantidad vendida
                </label>

                <input
                  id="cantidad_vendida"
                  name="cantidad_vendida"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedScrap?.cantidad?.toString() ?? ""}
                  placeholder="Ejemplo: 3"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />

                <p className="text-xs text-slate-500">
                  Útil si la venta se controla por bolsa, piezas o lote.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="id_caja_chica"
                  className="text-sm font-medium text-slate-700"
                >
                  Registrar ingreso en caja chica
                </label>

                <select
                  id="id_caja_chica"
                  name="id_caja_chica"
                  defaultValue=""
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">No registrar en caja chica</option>

                  {cashBoxes.map((box) => (
                    <option key={box.id_caja_chica} value={box.id_caja_chica}>
                      {box.nombre_caja} · Saldo: S/{" "}
                      {formatNumber(box.saldo_actual)}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-slate-500">
                  Opcional. Si seleccionas una caja, se generará un movimiento
                  de ingreso.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="destino_dinero"
                  className="text-sm font-medium text-slate-700"
                >
                  Destino del dinero
                </label>

                <input
                  id="destino_dinero"
                  name="destino_dinero"
                  type="text"
                  placeholder="Ejemplo: compra de discos de corte"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="observaciones"
                  className="text-sm font-medium text-slate-700"
                >
                  Observaciones
                </label>

                <textarea
                  id="observaciones"
                  name="observaciones"
                  rows={4}
                  placeholder="Ejemplo: venta realizada a reciclador local"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                Efecto de la operación
              </p>
              <p className="mt-1">
                Al registrar la venta, la chatarra cambiará a estado{" "}
                <span className="font-semibold">vendida</span>. Si seleccionas
                una caja chica, también se incrementará su saldo con el monto
                recibido.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <Link
                href="/dashboard/waste-scrap/scraps"
                className="rounded-lg border px-4 py-2 text-center text-sm font-medium hover:bg-slate-50"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={scraps.length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Registrar venta
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}