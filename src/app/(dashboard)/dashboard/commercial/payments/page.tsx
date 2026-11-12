import Link from "next/link";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
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
import {
  getOptionLabel,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
} from "@/modules/commercial/payment-labels";
import { getCustomerPaymentListData } from "@/modules/commercial/payments/queries";

type CustomerPaymentsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function CustomerPaymentsPage({
  searchParams,
}: CustomerPaymentsPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  // C5 de la 11.3c: el detalle de la proforma vuelve a este listado con sus filtros y su pagina.
  const returnTo = createReturnToHref(navigationHrefs.customerPayments, params);
  const q = parseStringParam(params, "q");
  const client = parseStringParam(params, "client");
  const order = parseStringParam(params, "order");
  const method = parseStringParam(params, "method");
  const type = parseStringParam(params, "type");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");

  const { page, pageSize, skip, take } = getPaginationParams(params);
  const { payments, totalItems, clients, orders } = await getCustomerPaymentListData(
    { q, client, order, method, type, from, to },
    { skip, take },
  );

  const meta = getPaginationMeta({ totalItems, page, pageSize });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos de cliente"
        description="Consulta pagos registrados desde proformas."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pagos de cliente" },
        ])}
      />

      <FilterBar
        action={navigationHrefs.customerPayments}
        label="Filtros de pagos de cliente"
        clearHref={navigationHrefs.customerPayments}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar pago..." />}
        </Field>
        <Field id="client" label="Cliente">
          {(control) => (
            <NativeSelect {...control} name="client" defaultValue={client}>
              <option value="">Todos los clientes</option>
              {clients.map((item) => (
                <option key={item.id_cliente} value={item.id_cliente}>
                  {item.nombre_razon_social}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="order" label="Pedido">
          {(control) => (
            <NativeSelect {...control} name="order" defaultValue={order}>
              <option value="">Todos los pedidos</option>
              {orders.map((item) => (
                <option key={item.id_pedido} value={item.id_pedido}>
                  {item.id_pedido}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="method" label="Método">
          {(control) => (
            <NativeSelect {...control} name="method" defaultValue={method}>
              <option value="">Todos los métodos</option>
              {PAYMENT_METHOD_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="type" label="Tipo de pago">
          {(control) => (
            <NativeSelect {...control} name="type" defaultValue={type}>
              <option value="">Todos los tipos</option>
              {PAYMENT_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
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
            <TableHead>Cliente</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Proforma</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Método</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id_pago_cliente}>
              <TableCell>{formatDate(payment.fecha_pago)}</TableCell>
              <TableCell>
                {payment.proforma.pedido.cliente.nombre_razon_social}
              </TableCell>
              <TableCell>{payment.id_pedido}</TableCell>
              <TableCell>{payment.id_proforma}</TableCell>
              <TableCell>{getOptionLabel(PAYMENT_TYPE_OPTIONS, payment.tipo_pago)}</TableCell>
              <TableCell>{getOptionLabel(PAYMENT_METHOD_OPTIONS, payment.metodo_pago)}</TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.monto_pagado)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(payment.saldo_actual)}
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={withReturnTo(
                      `${navigationHrefs.quotes}/${payment.id_proforma}`,
                      returnTo,
                    )}
                  >
                    Ver proforma
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay pagos registrados."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.customerPayments}
        searchParams={params}
        itemLabel="pagos"
      />
    </div>
  );
}
