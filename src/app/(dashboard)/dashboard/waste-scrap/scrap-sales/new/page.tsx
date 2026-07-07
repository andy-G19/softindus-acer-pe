import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
      <PageHeader
        title="Registrar venta de chatarra"
        description="Registra el ingreso obtenido por vender chatarra acumulada. Si seleccionas una caja chica abierta, el sistema también generará un movimiento de caja de tipo ingreso."
        backHref={navigationHrefs.scraps}
        backLabel="Volver a chatarra"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Chatarra", href: navigationHrefs.scraps },
          { label: "Nueva venta" },
        ])}
      />

      {scraps.length === 0 ? (
        <EmptyState
          label="No hay chatarra disponible para venta."
          description="Primero registra chatarra generada o verifica que no esté marcada como vendida."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la venta</CardTitle>
        </CardHeader>

        <CardContent>
          <form action={createScrapSaleAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="id_chatarra">Chatarra a vender *</Label>
                <NativeSelect
                  id="id_chatarra"
                  name="id_chatarra"
                  required
                  defaultValue={selectedScrapId}
                >
                  <option value="" disabled>
                    Selecciona un registro de chatarra
                  </option>

                  {scraps.map((item) => (
                    <option key={item.id_chatarra} value={item.id_chatarra}>
                      {item.id_chatarra} | {item.tipo_material} | Peso:{" "}
                      {item.peso_kg ? `${item.peso_kg.toString()} kg` : "-"} |
                      Cantidad: {item.cantidad ? item.cantidad.toString() : "-"}
                    </option>
                  ))}
                </NativeSelect>

                <p className="text-xs text-muted-foreground">
                  Solo se muestran registros con estado acumulada o disponible.
                </p>
              </div>

              {selectedScrap ? (
                <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground md:col-span-2">
                  <p className="font-medium text-foreground">
                    Chatarra seleccionada
                  </p>
                  <p className="mt-1">
                    Código: {selectedScrap.id_chatarra} | Tipo:{" "}
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
                    | Cantidad registrada:{" "}
                    {selectedScrap.cantidad
                      ? formatNumber(selectedScrap.cantidad)
                      : "-"}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="fecha_venta">Fecha de venta *</Label>
                <Input
                  id="fecha_venta"
                  name="fecha_venta"
                  type="date"
                  required
                  defaultValue={formatDateInput(new Date())}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monto_recibido">Monto recibido *</Label>
                <Input
                  id="monto_recibido"
                  name="monto_recibido"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 80.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="peso_vendido_kg">Peso vendido en kg</Label>
                <Input
                  id="peso_vendido_kg"
                  name="peso_vendido_kg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedScrap?.peso_kg?.toString() ?? ""}
                  placeholder="Ejemplo: 15.00"
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacío, se usará el peso registrado en la chatarra.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad_vendida">Cantidad vendida</Label>
                <Input
                  id="cantidad_vendida"
                  name="cantidad_vendida"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={selectedScrap?.cantidad?.toString() ?? ""}
                  placeholder="Ejemplo: 3"
                />
                <p className="text-xs text-muted-foreground">
                  Útil si la venta se controla por bolsa, piezas o lote.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_caja_chica">
                  Registrar ingreso en caja chica
                </Label>
                <NativeSelect id="id_caja_chica" name="id_caja_chica" defaultValue="">
                  <option value="">No registrar en caja chica</option>

                  {cashBoxes.map((box) => (
                    <option key={box.id_caja_chica} value={box.id_caja_chica}>
                      {box.nombre_caja} | Saldo: S/{" "}
                      {formatNumber(box.saldo_actual)}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  Opcional. Si seleccionas una caja, se generará un movimiento
                  de ingreso.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destino_dinero">Destino del dinero</Label>
                <Input
                  id="destino_dinero"
                  name="destino_dinero"
                  type="text"
                  placeholder="Ejemplo: compra de discos de corte"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  name="observaciones"
                  rows={4}
                  placeholder="Ejemplo: venta realizada a reciclador local"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
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
              <Button variant="outline" asChild>
                <Link href="/dashboard/waste-scrap/scraps">Cancelar</Link>
              </Button>

              <Button type="submit" disabled={scraps.length === 0}>
                Registrar venta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
