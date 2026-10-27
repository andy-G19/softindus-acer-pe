import Link from "next/link";

import { StateBadge } from "@/components/commercial/status-badge";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
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
import { annulReceiptAction } from "@/modules/commercial/receipts/actions";
import { getReceiptList } from "@/modules/commercial/receipts/queries";

type ReceiptsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const type = parseStringParam(params, "type");
  const status = parseStringParam(params, "status");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const receipts = await getReceiptList({ q, type, status, from, to });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comprobantes de venta"
        description="Consulta comprobantes emitidos y anulados."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Comprobantes de venta" },
        ])}
      />

      <FilterBar
        action={navigationHrefs.salesReceipts}
        label="Filtros de comprobantes de venta"
        clearHref={navigationHrefs.salesReceipts}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar comprobante..." />}
        </Field>
        <Field id="type" label="Tipo">
          {(control) => (
            <NativeSelect {...control} name="type" defaultValue={type}>
              <option value="">Todos los tipos</option>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
              <option value="otro">Otro</option>
            </NativeSelect>
          )}
        </Field>
        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="emitido">Emitido</option>
              <option value="anulado">Anulado</option>
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
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Pedido</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => (
            <TableRow key={receipt.id_comprobante}>
              <TableCell className="font-medium">
                {receipt.numero_comprobante}
              </TableCell>
              <TableCell>
                {receipt.pedido.cliente.nombre_razon_social}
              </TableCell>
              <TableCell>{receipt.id_pedido}</TableCell>
              <TableCell>{receipt.tipo_comprobante}</TableCell>
              <TableCell>{formatDate(receipt.fecha_emision)}</TableCell>
              <TableCell className="text-right">
                {formatMoney(receipt.monto_total)}
              </TableCell>
              <TableCell>
                <StateBadge status={receipt.estado} />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {receipt.id_proforma ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/dashboard/commercial/quotes/${receipt.id_proforma}`}
                      >
                        Ver proforma
                      </Link>
                    </Button>
                  ) : null}
                  {receipt.estado !== "anulado" ? (
                    <form action={annulReceiptAction}>
                      <input
                        type="hidden"
                        name="id_comprobante"
                        value={receipt.id_comprobante}
                      />
                      <ConfirmDeleteButton
                        title="¿Anular comprobante?"
                        description="Esta acción marcará el comprobante como anulado. Verifique antes de continuar."
                        confirmText="Confirmar anulación"
                        entityName="comprobante"
                        className="hover:bg-destructive/20"
                      >
                        Anular
                      </ConfirmDeleteButton>
                    </form>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {receipts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay comprobantes registrados."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
