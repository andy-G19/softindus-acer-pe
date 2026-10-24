import Link from "next/link";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { getSupplierPaymentListData } from "@/modules/inventory/supplier-payments/queries";

type SupplierPaymentsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function SupplierPaymentsPage({
  searchParams,
}: SupplierPaymentsPageProps) {
  await requireRole(["ADMIN"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const supplier = parseStringParam(params, "supplier");
  const purchase = parseStringParam(params, "purchase");
  const method = parseStringParam(params, "method");
  const status = parseStringParam(params, "status");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");

  const { payments, suppliers, purchases } = await getSupplierPaymentListData({
    q,
    supplier,
    purchase,
    method,
    status,
    from,
    to,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos a proveedores"
        description="Consulta pagos registrados desde compras."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Pagos a proveedores" },
        ])}
      />

      <FilterBar
        action={navigationHrefs.supplierPayments}
        label="Filtros de pagos a proveedores"
        clearHref={navigationHrefs.supplierPayments}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar pago..." />}
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
        <Field id="purchase" label="Compra">
          {(control) => (
            <NativeSelect {...control} name="purchase" defaultValue={purchase}>
              <option value="">Todas las compras</option>
              {purchases.map((item) => (
                <option key={item.id_compra} value={item.id_compra}>
                  {item.id_compra}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="method" label="Método">
          {(control) => (
            <NativeSelect {...control} name="method" defaultValue={method}>
              <option value="">Método</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="yape">Yape</option>
              <option value="plin">Plin</option>
              <option value="otro">Otro</option>
            </NativeSelect>
          )}
        </Field>
        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Estado pago</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
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
            <TableHead>Fecha</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Compra</TableHead>
            <TableHead>Método</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id_pago_proveedor}>
              <TableCell>{formatDate(payment.fecha_pago)}</TableCell>
              <TableCell>{payment.compra.proveedor.razon_social}</TableCell>
              <TableCell>{payment.id_compra}</TableCell>
              <TableCell>{payment.metodo_pago}</TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.monto_pagado)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.saldo_pendiente)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    payment.estado_pago === "pagado" ? "success" : "secondary"
                  }
                >
                  {payment.estado_pago}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/dashboard/inventory/purchases/${payment.id_compra}`}
                  >
                    Ver compra
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay pagos a proveedores."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
