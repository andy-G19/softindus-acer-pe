import Link from "next/link";

import { StateBadge } from "@/components/commercial/status-badge";
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
import { cancelOrderAction } from "@/modules/commercial/orders/actions";
import { getOrderListData } from "@/modules/commercial/orders/queries";

type OrdersPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const client = parseStringParam(params, "client");
  const product = parseStringParam(params, "product");
  const status = parseStringParam(params, "status");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const returnTo = createReturnToHref(navigationHrefs.orders, params);
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { orders, totalItems, clients, products } = await getOrderListData(
    { q, client, product, status, from, to },
    { skip, take },
  );

  const meta = getPaginationMeta({ totalItems, page, pageSize });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Lista de pedidos registrados por cliente y productos asociados."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Pedidos" },
        ])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.orders}/new`, returnTo)}>
              Nuevo pedido
            </Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.orders}
        label="Filtros de pedidos"
        clearHref={navigationHrefs.orders}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar pedido..." />}
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
        <Field id="product" label="Producto">
          {(control) => (
            <NativeSelect {...control} name="product" defaultValue={product}>
              <option value="">Todos los productos</option>
              {products.map((item) => (
                <option key={item.id_producto} value={item.id_producto}>
                  {item.nombre_producto}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="registrado">Registrado</option>
              <option value="aprobado">Aprobado</option>
              <option value="cancelado">Cancelado</option>
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
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha pedido</TableHead>
            <TableHead>Entrega estimada</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Monto estimado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Proforma</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {orders.map((order) => {
              const productsText = order.detalle_pedido
                .map((detail) => {
                  const cantidad = Number(detail.cantidad.toString());

                  return `${detail.producto.nombre_producto} x ${cantidad}`;
                })
                .join(" | ");
              const activeQuote = order.proforma[0];
              const hasWorkOrder = order.detalle_pedido.some(
                (detail) => detail.orden_trabajo.length > 0,
              );
              const canGenerateQuote =
                ["registrado", "aprobado"].includes(order.estado) &&
                !activeQuote;
              const canEdit =
                order.estado !== "cancelado" &&
                !activeQuote &&
                order.comprobante_venta.length === 0 &&
                !hasWorkOrder;

              return (
                <TableRow key={order.id_pedido}>
                  <TableCell>{order.id_pedido}</TableCell>
                  <TableCell className="font-medium">
                    {order.cliente.nombre_razon_social}
                  </TableCell>
                  <TableCell>{formatDate(order.fecha_pedido)}</TableCell>
                  <TableCell>
                    {formatDate(order.fecha_entrega_estimada)}
                  </TableCell>
                  <TableCell>{productsText}</TableCell>
                  <TableCell>{formatMoney(order.monto_estimado, { emptyText: "-" })}</TableCell>
                  <TableCell>
                    <StateBadge status={order.estado} />
                  </TableCell>
                  <TableCell>
                    {activeQuote ? (
                      <Badge variant="success">
                        {activeQuote.numero_proforma}
                      </Badge>
                    ) : (
                      <StateBadge status="sin-proforma" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={withReturnTo(
                            `${navigationHrefs.orders}/${order.id_pedido}`,
                            returnTo,
                          )}
                        >
                          Ver detalle
                        </Link>
                      </Button>
                      {canEdit ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={withReturnTo(
                              `${navigationHrefs.orders}/${order.id_pedido}/edit`,
                              returnTo,
                            )}
                          >
                            Editar
                          </Link>
                        </Button>
                      ) : null}
                      {activeQuote ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/dashboard/commercial/quotes/${activeQuote.id_proforma}`}
                          >
                            Ver proforma
                          </Link>
                        </Button>
                      ) : null}
                      {canGenerateQuote ? (
                        <Button size="sm" asChild>
                          <Link
                            href={`/dashboard/commercial/quotes/new?orderId=${order.id_pedido}`}
                          >
                            Generar proforma
                          </Link>
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <form action={cancelOrderAction}>
                          <input
                            type="hidden"
                            name="id_pedido"
                            value={order.id_pedido}
                          />
                          <ConfirmDeleteButton
                            title="¿Cancelar pedido?"
                            description="Esta acción cambiará el estado del pedido y no debe ejecutarse sin verificación previa."
                            confirmText="Confirmar cancelación"
                            entityName="pedido"
                            className="hover:bg-destructive/20"
                          >
                            Cancelar
                          </ConfirmDeleteButton>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    className="border-0"
                    label="Todavía no hay pedidos registrados."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <PaginationControls
          meta={meta}
          basePath={navigationHrefs.orders}
          searchParams={params}
          itemLabel="pedidos"
        />
    </div>
  );
}
