import Link from "next/link";

import { StateBadge } from "@/components/commercial/status-badge";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
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
import { annulQuoteAction } from "@/modules/commercial/quotes/actions";
import { getQuoteListData } from "@/modules/commercial/quotes/queries";

type QuotesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const client = parseStringParam(params, "client");
  const order = parseStringParam(params, "order");
  const status = parseStringParam(params, "status");
  const balance = parseStringParam(params, "balance");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const { quotes, clients, orders } = await getQuoteListData({
    q,
    client,
    order,
    status,
    balance,
    from,
    to,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proformas"
        description="Lista de proformas digitales generadas desde pedidos registrados."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Proformas" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/commercial/quotes/new">Nueva proforma</Link>
          </Button>
        }
      />

      <FilterBar
        action={navigationHrefs.quotes}
        label="Filtros de proformas"
        clearHref={navigationHrefs.quotes}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar proforma..." />}
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
        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="vigente">Vigente</option>
              <option value="aceptada">Aceptada</option>
              <option value="pagada">Pagada</option>
              <option value="anulada">Anulada</option>
            </NativeSelect>
          )}
        </Field>
        <Field id="balance" label="Saldo">
          {(control) => (
            <NativeSelect {...control} name="balance" defaultValue={balance}>
              <option value="">Todos los saldos</option>
              <option value="pending">Con saldo</option>
              <option value="paid">Sin saldo</option>
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
            <TableHead>Nro. Proforma</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {quotes.map((quote) => {
              const canPay =
                quote.estado !== "pagada" &&
                quote.estado !== "anulada" &&
                Number(quote.saldo.toString()) > 0;
              const canAnnul =
                quote.estado !== "anulada" &&
                quote.pago_cliente.length === 0 &&
                quote.comprobante_venta.length === 0;

              return (
                <TableRow key={quote.id_proforma}>
                  <TableCell className="font-medium">
                    {quote.numero_proforma}
                  </TableCell>
                  <TableCell>{quote.id_pedido}</TableCell>
                  <TableCell>
                    {quote.pedido.cliente.nombre_razon_social}
                  </TableCell>
                  <TableCell>{formatDate(quote.fecha_emision)}</TableCell>
                  <TableCell>{formatMoney(quote.monto_total)}</TableCell>
                  <TableCell>{formatMoney(quote.saldo)}</TableCell>
                  <TableCell>
                    <StateBadge status={quote.estado} />
                  </TableCell>
                  <TableCell>
                    {quote.comprobante_venta[0] ? (
                      <Badge variant="success">
                        {quote.comprobante_venta[0].tipo_comprobante}{" "}
                        {quote.comprobante_venta[0].numero_comprobante}
                      </Badge>
                    ) : (
                      <StateBadge status="sin-comprobante" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                        >
                          Ver detalle
                        </Link>
                      </Button>
                      {canPay ? (
                        <Button size="sm" asChild>
                          <Link
                            href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                          >
                            Registrar pago
                          </Link>
                        </Button>
                      ) : null}
                      {canAnnul ? (
                        <form action={annulQuoteAction}>
                          <input
                            type="hidden"
                            name="id_proforma"
                            value={quote.id_proforma}
                          />
                          <ConfirmDeleteButton
                            title="¿Anular proforma?"
                            description="Esta acción anulará la proforma y no se puede deshacer."
                            confirmText="Confirmar anulación"
                            entityName="proforma"
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

            {quotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    className="border-0"
                    label="Todavía no hay proformas registradas."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
      </Table>
    </div>
  );
}
