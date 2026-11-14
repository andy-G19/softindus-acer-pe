import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { createScrapSaleAction } from "@/modules/waste-scrap/scrap-sales/actions";
import { getNewScrapSaleFormOptions } from "@/modules/waste-scrap/scrap-sales/queries";
import { ScrapSaleForm } from "@/modules/waste-scrap/scrap-sales/scrap-sale-form";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";

type SearchParams = {
  id_chatarra?: string;
  returnTo?: string | string[];
};

type NewScrapSalePageProps = {
  searchParams?: Promise<SearchParams>;
};

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
  // C4 de la 11.4b (D48): al guardar o cancelar vuelve a la pagina de la que vino; sin ella, al
  // listado de chatarra, como antes.
  const backHref = getSafeReturnTo(params.returnTo, navigationHrefs.scraps);

  const { scraps, cashBoxes } = await getNewScrapSaleFormOptions();

  const selectedScrap = scraps.find(
    (item) => item.id_chatarra === selectedScrapId,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar venta de chatarra"
        description="Registra el ingreso obtenido por vender chatarra acumulada. Si seleccionas una caja chica abierta, el sistema también generará un movimiento de caja de tipo ingreso."
        backHref={backHref}
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
          <ScrapSaleForm
            action={createScrapSaleAction}
            scraps={scraps.map((item) => ({
              value: item.id_chatarra,
              label: `${item.id_chatarra} | ${item.tipo_material} | Peso: ${
                item.peso_kg ? `${item.peso_kg.toString()} kg` : "-"
              } | Cantidad: ${item.cantidad ? item.cantidad.toString() : "-"}`,
            }))}
            cashBoxes={cashBoxes.map((box) => ({
              value: box.id_caja_chica,
              label: `${box.nombre_caja} | Saldo: S/ ${formatNumber(box.saldo_actual)}`,
            }))}
            defaultScrapId={selectedScrapId}
            defaultWeight={selectedScrap?.peso_kg?.toString() ?? ""}
            defaultQuantity={selectedScrap?.cantidad?.toString() ?? ""}
            defaultDate={formatDateInput(new Date())}
            selectedScrapSummary={
              selectedScrap ? (
                <div className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
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
              ) : undefined
            }
            successNotification={wasteScrapNotifications["scrap-sale-created"]}
            returnTo={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
