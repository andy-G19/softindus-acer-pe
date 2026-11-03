import {
  CheckCircle2,
  ClipboardList,
  Recycle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { formatDate } from "@/lib/formatters";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { updateReusableScrapStatusAction } from "@/modules/waste-scrap/reusable-scraps/status-actions";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import { getReusableScrapListData } from "@/modules/waste-scrap/reusable-scraps/queries";
import { ReusableScrapStatusActions } from "@/modules/waste-scrap/reusable-scraps/reusable-scrap-status-actions";

type SearchParams = {
  estado?: string;
  material?: string;
  q?: string;
};

type ReusableScrapsPageProps = {
  searchParams?: Promise<SearchParams>;
};

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function getStatusBadgeVariant(status: string) {
  if (status === "disponible") {
    return "success" as const;
  }

  if (status === "reutilizado") {
    return "info" as const;
  }

  if (status === "descartado") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export default async function ReusableScrapsPage({
  searchParams,
}: ReusableScrapsPageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const params = searchParams ? await searchParams : {};

  const estado = params.estado?.trim() ?? "";
  const material = params.material?.trim() ?? "";
  const query = params.q?.trim() ?? "";

  const {
    materials,
    retazos,
    totalFiltered,
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
  } = await getReusableScrapListData({ estado, material, query });

  const returnTo = createReturnToHref(navigationHrefs.reusableScraps, params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retazos reutilizables"
        description="Consulta los retazos aprovechables registrados durante producción. Puedes filtrar por estado, material de origen o buscar por código, medida, ubicación u orden de trabajo. Desde este listado también puedes marcar retazos disponibles como reutilizados o descartados."
        backHref={navigationHrefs.wasteScrap}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Mermas y chatarra", href: navigationHrefs.wasteScrap },
          { label: "Retazos reutilizables" },
        ])}
        actions={
          <Button asChild>
            <Link href={withReturnTo(`${navigationHrefs.reusableScraps}/new`, returnTo)}>
              Registrar retazo
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total registrados" value={totalRetazos.toString()} description={`${totalFiltered} según filtros`} tone="info" icon={ClipboardList} />
        <KpiCard title="Disponibles" value={retazosDisponibles.toString()} description="Listos para reutilizar" tone="success" icon={CheckCircle2} />
        <KpiCard title="Reutilizados" value={retazosReutilizados.toString()} description="Aprovechados en producción" tone="info" icon={Recycle} />
        <KpiCard title="Descartados" value={retazosDescartados.toString()} description="No aprovechables" tone="warning" icon={XCircle} />
      </section>

      <FilterBar
        action={navigationHrefs.reusableScraps}
        label="Filtros de retazos"
        clearHref={navigationHrefs.reusableScraps}
        clearLabel="Limpiar"
      >
        <Field id="estado" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={estado}>
              <option value="">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="reutilizado">Reutilizado</option>
              <option value="descartado">Descartado</option>
            </NativeSelect>
          )}
        </Field>

        <Field id="material" label="Material">
          {(control) => (
            <NativeSelect {...control} name="material" defaultValue={material}>
              <option value="">Todos</option>
              {materials.map((item) => (
                <option key={item.id_material} value={item.id_material}>
                  {item.nombre_material} · {item.categoria}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field id="q" label="Buscar">
          {(control) => (
            <Input
              {...control}
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Código, medida, ubicación u orden"
            />
          )}
        </Field>
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado de retazos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {retazos.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron retazos con los filtros seleccionados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Medida</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {retazos.map((item) => (
                  <TableRow key={item.id_retazo} className="align-top">
                    <TableCell className="font-mono text-xs">
                      {item.id_retazo}
                    </TableCell>

                    <TableCell>
                      <p className="font-medium">
                        {item.material.nombre_material}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.tipo_material}
                      </p>
                    </TableCell>

                    <TableCell>
                      {formatNumber(item.cantidad)} {item.unidad_medida}
                    </TableCell>

                    <TableCell>{item.medida_aproximada ?? "-"}</TableCell>

                    <TableCell>{item.ubicacion ?? "-"}</TableCell>

                    <TableCell>
                      {item.orden_trabajo ? (
                        <div>
                          <p className="font-mono text-xs">
                            {item.orden_trabajo.id_orden_trabajo}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.orden_trabajo.producto.nombre_producto}
                          </p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.estado)}>
                        {item.estado}
                      </Badge>
                    </TableCell>

                    <TableCell>{formatDate(item.fecha_registro, { format: "dd/mm/yyyy" })}</TableCell>

                    <TableCell>
                      <ReusableScrapStatusActions
                        scrap={item}
                        action={updateReusableScrapStatusAction}
                        reusedNotification={wasteScrapNotifications["reusable-scrap-reused"]}
                        discardedNotification={wasteScrapNotifications["reusable-scrap-discarded"]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}