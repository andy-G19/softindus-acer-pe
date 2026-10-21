import Link from "next/link";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/authz";
import { formatDate, formatMoney } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { annulPurchaseAction } from "@/modules/inventory/purchases/actions";
import { getPurchaseListData } from "@/modules/inventory/purchases/queries";

type PurchasesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  await requireRole(["ADMIN"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const supplier = parseStringParam(params, "supplier");
  const material = parseStringParam(params, "material");
  const purchaseStatus = parseStringParam(params, "status");
  const paymentStatus = parseStringParam(params, "payment");
  const returnTo = createReturnToHref(navigationHrefs.purchases, params);
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { purchases, totalItems, suppliers, materials } = await getPurchaseListData(
    { q, supplier, material, purchaseStatus, paymentStatus, from, to },
    { skip, take },
  );

  const meta = getPaginationMeta({ totalItems, page, pageSize });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        description="Consulta compras registradas, pagos y entradas generadas."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Compras" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/inventory/purchases/new">Nueva compra</Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.purchases}
        label="Filtros de compras"
        clearHref={navigationHrefs.purchases}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar compra..." />}
        </Field>
        <Field id="supplier" label="Proveedor">
          {(control) => (
            <NativeSelect {...control} name="supplier" defaultValue={supplier}>
              <option value="">Todos los proveedores</option>
              {suppliers.map((item) => (
                <option key={item.id_proveedor} value={item.id_proveedor}>
                  {item.razon_social}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="material" label="Material">
          {(control) => (
            <NativeSelect {...control} name="material" defaultValue={material}>
              <option value="">Todos los materiales</option>
              {materials.map((item) => (
                <option key={item.id_material} value={item.id_material}>
                  {item.nombre_material}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="status" label="Estado compra">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={purchaseStatus}>
              <option value="">Estado compra</option>
              <option value="registrada">Registrada</option>
              <option value="confirmada">Confirmada</option>
              <option value="anulada">Anulada</option>
            </NativeSelect>
          )}
        </Field>
        <Field id="payment" label="Estado pago">
          {(control) => (
            <NativeSelect {...control} name="payment" defaultValue={paymentStatus}>
              <option value="">Estado pago</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
              <option value="anulada">Anulada</option>
            </NativeSelect>
          )}
        </Field>
        <DateRangeFields
          id="fecha"
          defaultFrom={parseStringParam(params, "from")}
          defaultTo={parseStringParam(params, "to")}
        />
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Estado compra</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => {
            const canAnnul =
              purchase.estado_compra !== "anulada" &&
              purchase.pago_proveedor.length === 0 &&
              purchase.movimiento_inventario.length > 0;

            return (
              <TableRow key={purchase.id_compra}>
                <TableCell className="text-xs">
                  {purchase.id_compra}
                </TableCell>
                <TableCell>{formatDate(purchase.fecha_compra)}</TableCell>
                <TableCell className="font-medium">
                  {purchase.proveedor.razon_social}
                </TableCell>
                <TableCell>
                  {purchase.numero_comprobante
                    ? `${purchase.tipo_comprobante ?? "-"} ${purchase.numero_comprobante}`
                    : "-"}
                </TableCell>
                <TableCell className="font-medium">
                  {formatMoney(purchase.monto_total)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      purchase.estado_pago === "pagado" ? "success" : "secondary"
                    }
                  >
                    {purchase.estado_pago}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      purchase.estado_compra === "anulada"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {purchase.estado_compra}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={withReturnTo(
                          `${navigationHrefs.purchases}/${purchase.id_compra}`,
                          returnTo,
                        )}
                      >
                        Ver detalle
                      </Link>
                    </Button>
                    {canAnnul ? (
                      <form action={annulPurchaseAction}>
                        <input
                          type="hidden"
                          name="id_compra"
                          value={purchase.id_compra}
                        />
                        <ConfirmDeleteButton
                          title="¿Anular compra?"
                          description="Esta acción marcará la compra como anulada. Verifique antes de continuar."
                          confirmText="Confirmar anulación"
                          entityName="compra"
                          className="hover:bg-destructive/20"
                        >
                          Anular
                        </ConfirmDeleteButton>
                      </form>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {purchases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay compras registradas."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.purchases}
        searchParams={params}
        itemLabel="compras"
      />
    </div>
  );
}
