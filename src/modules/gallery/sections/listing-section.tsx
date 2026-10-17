import { StatusBadge } from "@/components/commercial/status-badge";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { BackButton } from "@/components/navigation/back-button";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { RowActions, RowEditLink } from "@/components/table/row-actions";
import { TableLoadingRows } from "@/components/table/table-loading-rows";
import { Badge } from "@/components/ui/badge";
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
import { getPaginationMeta } from "@/lib/pagination";
import { RowStatusDemo } from "@/modules/gallery/confirm-action-demo";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

const GALLERY_PATH = "/dashboard/gallery";

const ROWS = [
  { id: "CLI00000001", name: "Metalmecánica Lima S.A.C.", type: "Empresa", phone: "014567890", active: true, rejects: false },
  { id: "CLI00000002", name: "Taller Arequipa", type: "Persona natural", phone: null, active: true, rejects: true },
  { id: "CLI00000003", name: "Estructuras del Sur", type: "Empresa", phone: "054223344", active: false, rejects: false },
];

// Mismos estados en las dos etiquetas. La variante de Badge es la del tono que
// StatusBadge ya usa (active es la default de Badge; el estado desconocido usa
// outline, el mas parecido a su gris).
const STATUS_SAMPLES = [
  { status: "pagada", label: "Pagada", variant: "success" },
  { status: "aprobado", label: "Aprobado", variant: "info" },
  { status: "pendiente", label: "Pendiente", variant: "default" },
  { status: "en_produccion", label: "En producción", variant: "default" },
  { status: "sin proforma", label: "Sin proforma", variant: "default" },
  { status: "anulado", label: "Anulado", variant: "destructive" },
  { status: "desconocido", label: "desconocido", variant: "outline" },
] as const;

export function ListingSection() {
  return (
    <GallerySection
      id="listados"
      description="Barra de filtros con rango de fechas, tabla con acciones por fila, carga, etiquetas de estado, resultados vacíos, paginación y navegación, como en el listado de clientes."
    >
      <GallerySample label="Barra de filtros (FilterBar) con rango de fechas" className="block">
        <FilterBar
          action={`${GALLERY_PATH}#listados`}
          label="Filtros de ejemplo"
          clearHref={`${GALLERY_PATH}#listados`}
        >
          <Field id="galeria-listado-q" label="Búsqueda general">
            {(control) => <Input {...control} name="q" placeholder="Nombre, documento o teléfono" />}
          </Field>
          <Field id="galeria-listado-estado" label="Estado">
            {(control) => (
              <NativeSelect {...control} name="status" defaultValue="">
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </NativeSelect>
            )}
          </Field>
          <DateRangeFields id="galeria-listado-rango" />
        </FilterBar>
      </GallerySample>

      <GallerySample label="Rango invertido (llega así en la URL)" className="block">
        <FilterBar
          action={`${GALLERY_PATH}#listados`}
          label="Filtros con rango invertido"
          clearHref={`${GALLERY_PATH}#listados`}
        >
          <DateRangeFields
            id="galeria-listado-invertido"
            fromName="dateFrom"
            toName="dateTo"
            defaultFrom="2026-10-13"
            defaultTo="2026-10-01"
          />
        </FilterBar>
      </GallerySample>
      <GalleryNote>
        Hay 43 formularios GET de filtros y parámetros con 27 combinaciones de
        clases distintas; FilterBar usa una sola rejilla que se adapta al ancho,
        y el rango ocupa dos columnas solo si la barra tiene sitio. DateRangeFields conserva los nombres de la URL de cada
        pantalla (from/to, dateFrom/dateTo, desde/hasta). Si «Desde» es posterior
        a «Hasta», muestra el mismo mensaje que la exportación y Filtrar no envía
        nada. Teclado: escribe en «Hasta» una fecha anterior a «Desde» y pulsa
        Filtrar.
      </GalleryNote>

      <GallerySample label="Tabla con acciones por fila" className="block space-y-3">
        <p className="text-sm text-muted-foreground">Resultados encontrados: {ROWS.length}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{row.phone ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={row.active ? "success" : "outline"}>
                    {row.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowActions>
                    <RowEditLink href="#listados" />
                    <RowStatusDemo id={row.id} name={row.name} active={row.active} rejects={row.rejects} />
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls
          meta={getPaginationMeta({ totalItems: 45, page: 1, pageSize: 20 })}
          basePath={GALLERY_PATH}
          searchParams={{}}
          itemLabel="clientes"
        />
      </GallerySample>
      <GalleryNote>
        «Inactivar» usa ConfirmActionButton: pide confirmar con el nombre del
        registro y, mientras la acción espera, la confirmación no se cancela ni
        se cierra con Esc; al terminar da un solo aviso, se cierra y el foco
        vuelve al botón. En «Taller Arequipa» la acción de ejemplo falla y el
        mensaje queda dentro de la confirmación. «Activar» no pide confirmar.
        Aquí la acción solo espera en el navegador: no se guarda nada.
      </GalleryNote>

      <GallerySample label="Tabla cargando (TableLoadingRows)" className="block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableLoadingRows columns={4} rows={3} label="Cargando clientes..." />
          </TableBody>
        </Table>
      </GallerySample>

      <GallerySample label="Etiquetas de estado: StatusBadge (Comercial) y Badge, lado a lado" className="block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>StatusBadge</TableHead>
              <TableHead>Badge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATUS_SAMPLES.map(({ status, label, variant }) => (
              <TableRow key={status}>
                <TableCell className="font-mono text-xs text-muted-foreground">{status}</TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell>
                  <Badge variant={variant}>{label}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GallerySample>
      <GalleryNote>
        Las dos usan los mismos colores (las clases badge-state-*); solo cambia
        la forma: StatusBadge es redondeada, en minúsculas y traduce el estado;
        Badge es más compacta y en mayúsculas. En la entrega 10 se adopta una
        sola para todas las pantallas.
      </GalleryNote>

      <GallerySample label="Tabla sin resultados" className="block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} className="p-0">
                <EmptyState className="border-0" label="No se encontraron clientes con los filtros aplicados." />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </GallerySample>

      <div className="grid gap-6 lg:grid-cols-2">
        <GallerySample label="Migas de pan">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Comercial", href: "#listados" },
              { label: "Clientes" },
            ]}
          />
        </GallerySample>

        <GallerySample label="Volver">
          <BackButton fallbackHref="/dashboard" />
        </GallerySample>
      </div>
      <GalleryNote>
        La cabecera de esta página es el componente compartido PageHeader, con
        migas de pan y descripción.
      </GalleryNote>
    </GallerySection>
  );
}
