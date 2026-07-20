import Link from "next/link";

import { StatusBadge } from "@/components/commercial/status-badge";
import { PageHeader } from "@/components/navigation/page-header";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { annulReceiptAction } from "@/modules/commercial/receipts/actions";

type ReceiptsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const type = parseStringParam(params, "type");
  const status = parseStringParam(params, "status");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const dateRange = buildDateRangeFilter(from, to);
  const filters: Prisma.comprobante_ventaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { numero_comprobante: { contains: q, mode: "insensitive" } },
        { id_pedido: { contains: q, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (type) {
    filters.push({ tipo_comprobante: type });
  }

  if (status) {
    filters.push({ estado: status });
  }

  if (dateRange) {
    filters.push({ fecha_emision: dateRange });
  }

  const receipts = await prisma.comprobante_venta.findMany({
    where: filters.length > 0 ? { AND: filters } : {},
    orderBy: {
      fecha_emision: "desc",
    },
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      proforma: true,
    },
  });

  return (
    <main className="space-y-6">
      <PageHeader
        title="Comprobantes de venta"
        description="Consulta comprobantes emitidos y anulados."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Comprobantes de venta" },
        ])}
      />

      <form
        action="/dashboard/commercial/receipts"
        className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 md:grid-cols-5"
      >
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Buscar comprobante..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <NativeSelect id="type" name="type" defaultValue={type}>
            <option value="">Todos los tipos</option>
            <option value="boleta">Boleta</option>
            <option value="factura">Factura</option>
            <option value="recibo">Recibo</option>
            <option value="otro">Otro</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="emitido">Emitido</option>
            <option value="anulado">Anulado</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="from">Desde</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={parseStringParam(params, "from")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={parseStringParam(params, "to")}
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-5">
          <Button type="submit">Filtrar</Button>
          <Button variant="clear" asChild>
            <Link href="/dashboard/commercial/receipts">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

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
                <StatusBadge status={receipt.estado} />
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
    </main>
  );
}
