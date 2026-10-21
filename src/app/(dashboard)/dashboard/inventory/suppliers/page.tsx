import Link from "next/link";

import { requireRole } from "@/lib/authz";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { RowActions, RowEditLink } from "@/components/table/row-actions";
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
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { toggleSupplierStatusAction } from "@/modules/inventory/suppliers/actions";
import { getSupplierListData } from "@/modules/inventory/suppliers/queries";
import { SupplierStatusButton } from "@/modules/inventory/suppliers/supplier-status-button";

type SuppliersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export default async function SuppliersPage({
  searchParams,
}: SuppliersPageProps) {
  await requireRole(["ADMIN"]);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const type = getSearchParam(params, "type");
  const payment = getSearchParam(params, "payment");
  const status = getSearchParam(params, "status");
  const returnTo = createReturnToHref(navigationHrefs.suppliers, params);
  const { suppliers, supplierTypes, paymentConditions } = await getSupplierListData({
    q,
    type,
    payment,
    status,
  });

  const typeLabels = new Map(
    supplierTypes.map((item) => [item.slug, item.nombre]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proveedores"
        description="Registra proveedores de materia prima, consumibles, repuestos y servicios."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Proveedores" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/supplier-types">
                Tipos de proveedor
              </Link>
            </Button>

            <Button asChild>
              <Link href={withReturnTo(`${navigationHrefs.suppliers}/new`, returnTo)}>
                Nuevo proveedor
              </Link>
            </Button>
          </>
        }
      />

      <FilterBar
        action={navigationHrefs.suppliers}
        label="Filtros de proveedores"
        clearHref={navigationHrefs.suppliers}
      >
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Buscar proveedor..." />}
        </Field>

        <Field id="type" label="Tipo">
          {(control) => (
            <NativeSelect {...control} name="type" defaultValue={type}>
              <option value="">Todos los tipos</option>
              {supplierTypes.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.nombre}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="payment" label="Condición de pago">
          {(control) => (
            <NativeSelect {...control} name="payment" defaultValue={payment}>
              <option value="">Todas las condiciones</option>
              {paymentConditions.map((item) =>
                item.condicion_pago ? (
                  <option key={item.condicion_pago} value={item.condicion_pago}>
                    {item.condicion_pago}
                  </option>
                ) : null,
              )}
            </NativeSelect>
          )}
        </Field>

        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Razón social</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Condición de pago</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id_proveedor}>
              <TableCell className="text-xs">
                {supplier.id_proveedor}
              </TableCell>
              <TableCell className="font-medium">
                {supplier.razon_social}
              </TableCell>
              <TableCell>
                {supplier.numero_documento
                  ? `${supplier.tipo_documento ?? "-"} ${supplier.numero_documento}`
                  : "-"}
              </TableCell>
              <TableCell>
                {typeLabels.get(supplier.tipo_proveedor) ??
                  supplier.tipo_proveedor}
              </TableCell>
              <TableCell>{supplier.telefono ?? "-"}</TableCell>
              <TableCell>{supplier.condicion_pago ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={supplier.estado ? "success" : "outline"}>
                  {supplier.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <RowActions>
                  <RowEditLink
                    href={withReturnTo(
                      `${navigationHrefs.suppliers}/${supplier.id_proveedor}/edit`,
                      returnTo,
                    )}
                  />

                  <SupplierStatusButton
                    supplier={supplier}
                    action={toggleSupplierStatusAction}
                    activatedNotification={inventoryNotifications["supplier-activated"]}
                    deactivatedNotification={inventoryNotifications["supplier-deactivated"]}
                  />
                </RowActions>
              </TableCell>
            </TableRow>
          ))}

          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay proveedores registrados."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
