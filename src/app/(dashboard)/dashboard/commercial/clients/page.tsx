import Link from "next/link";

import { requireRole } from "@/lib/authz";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { SearchableSelectFilter } from "@/components/forms/searchable-select-filter";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
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
import { getPaginationMeta, getPaginationParams } from "@/lib/pagination";
import { toggleClientStatusAction } from "@/modules/commercial/clients/actions";
import { ClientStatusButton } from "@/modules/commercial/clients/client-status-button";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { getClientListData } from "@/modules/commercial/clients/queries";

type ClientsPageProps = {
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

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  await requireRole(["ADMIN", "SELLER"]);

  const params = (await searchParams) ?? {};
  const client = getSearchParam(params, "client");
  const q = getSearchParam(params, "q");
  const type = getSearchParam(params, "type");
  const status = getSearchParam(params, "status");
  const origin = getSearchParam(params, "origin");
  const returnTo = createReturnToHref(navigationHrefs.clients, params);
  const { page, pageSize, skip, take } = getPaginationParams(params);

  const { clientOptions, clients, totalItems } = await getClientListData(
    { client, q, type, status, origin },
    { skip, take },
  );

  const meta = getPaginationMeta({ totalItems, page, pageSize });

  const clientItems = clientOptions.map((item) => ({
    id: item.id_cliente,
    label: item.nombre_razon_social,
    description: [
      item.id_cliente,
      item.tipo_cliente,
      item.numero_documento,
      item.telefono,
      item.lugar_origen,
    ]
      .filter(Boolean)
      .join(" - "),
  }));

  const clientTypes = Array.from(
    new Set(clientOptions.map((item) => item.tipo_cliente).filter(Boolean)),
  ).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Lista de clientes registrados en el sistema."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Comercial", href: navigationHrefs.commercial },
          { label: "Clientes" },
        ])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.clients}/new`, returnTo)}>Nuevo cliente</Link>
          </Button>
        }
      />

      <FilterBar action={navigationHrefs.clients} label="Filtros de clientes" clearHref={navigationHrefs.clients}>
        <SearchableSelectFilter
          key={client}
          name="client"
          label="Cliente"
          placeholder="Buscar cliente por nombre o código"
          items={clientItems}
          value={client}
          emptyMessage="No se encontraron clientes."
        />

        <Field id="q" label="Búsqueda general">
          {(control) => (
            <Input
              {...control}
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Buscar por nombre, documento, teléfono o correo"
            />
          )}
        </Field>

        <Field id="type" label="Tipo">
          {(control) => (
            <NativeSelect {...control} name="type" defaultValue={type}>
              <option value="">Todos los tipos</option>
              {clientTypes.map((clientType) => (
                <option key={clientType} value={clientType}>
                  {clientType}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="status" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="status" defaultValue={status}>
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="origin" label="Origen">
          {(control) => <Input {...control} name="origin" type="text" defaultValue={origin} placeholder="Origen" />}
        </Field>
      </FilterBar>

      <p className="text-sm text-muted-foreground">
        Resultados encontrados: {totalItems}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((clientItem) => (
            <TableRow key={clientItem.id_cliente}>
              <TableCell>{clientItem.id_cliente}</TableCell>
              <TableCell className="font-medium">
                {clientItem.nombre_razon_social}
              </TableCell>
              <TableCell>{clientItem.tipo_cliente}</TableCell>
              <TableCell>{clientItem.telefono ?? "-"}</TableCell>
              <TableCell>{clientItem.lugar_origen ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={clientItem.estado ? "success" : "outline"}>
                  {clientItem.estado ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>
                <RowActions>
                  <RowEditLink
                    href={withReturnTo(
                      `${navigationHrefs.clients}/${clientItem.id_cliente}/edit`,
                      returnTo,
                    )}
                  />

                  <ClientStatusButton
                    client={clientItem}
                    action={toggleClientStatusAction}
                    activatedNotification={commercialNotifications["client-activated"]}
                    deactivatedNotification={commercialNotifications["client-deactivated"]}
                  />
                </RowActions>
              </TableCell>
            </TableRow>
          ))}

          {clients.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  className="border-0"
                  label="No se encontraron clientes con los filtros aplicados."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <PaginationControls
        meta={meta}
        basePath={navigationHrefs.clients}
        searchParams={params}
        itemLabel="clientes"
      />
    </div>
  );
}
