import { StateBadge } from "@/components/commercial/status-badge";
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
import { RowStatusSelectDemo } from "@/modules/gallery/row-status-select-demo";
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

// Estados de muestra de la etiqueta: cada uno con su tono (el estado
// desconocido usa outline con borde discontinuo). La columna del estado es la
// primera, asi que se ve como un codigo sin clases propias.
const STATUS_SAMPLES = [
  "pagada",
  "aprobado",
  "pendiente",
  "en_produccion",
  "sin proforma",
  "anulado",
  "desconocido",
];

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
              <TableHead className="text-right">Acciones</TableHead>
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
        La cabecera es acero cepillado: el acento con la textura de metal, letra
        mono de 10,5 px en mayúsculas y una línea de acero de 2 px debajo. Las
        filas tienen texto de 13,5 px, sin cebra, y se aclaran al pasar el
        puntero. La primera columna, el código o la fecha que abre la fila, va en
        mono gris; si es un nombre, la celda lleva {'data-cell="text"'} y se ve como
        las demás. Las acciones de la fila van a la derecha: «Editar» y
        «Activar» son enlaces de texto que toman el cobre al pasar el puntero, e
        «Inactivar» es un botón destructivo pequeño. La paginación lleva una
        flecha hacia cada lado.
      </GalleryNote>
      <GalleryNote>
        «Inactivar» usa ConfirmActionButton. La confirmación sigue siendo la ventana:
        pide confirmar con el nombre del registro y, mientras la acción espera, no
        se cancela ni se cierra con Esc; al terminar da un solo aviso, se cierra y
        el foco vuelve al botón. En «Taller Arequipa» la acción de ejemplo falla y
        el mensaje queda dentro de la confirmación. «Activar» no pide confirmar.
        Aquí la acción solo espera en el navegador: no se guarda nada.
      </GalleryNote>

      <GallerySample label="Cambio de estado desde la fila (RowStatusSelect)">
        <RowStatusSelectDemo id="EJM00000001" initialStatus="pendiente" />
        <RowStatusSelectDemo id="EJM00000002" initialStatus="en_atencion" rejects />
      </GallerySample>
      <GalleryNote>
        «Guardar» envía el estado elegido y no hace nada si no cambió. Los estados
        finales piden confirmar: «Anulada» con el botón destructivo y «Reparada»
        con el normal, porque no borra nada. En el segundo ejemplo la acción falla
        y el mensaje queda en la fila. Aquí la acción solo espera en el navegador:
        no se guarda nada.
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

      <GallerySample label="Etiquetas de estado (StateBadge)" className="block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>StateBadge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATUS_SAMPLES.map((status) => (
              <TableRow key={status}>
                <TableCell>{status}</TableCell>
                <TableCell>
                  <StateBadge status={status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GallerySample>
      <GalleryNote>
        StateBadge es una etiqueta simple, sin gestos: 22 px de alto y un punto
        fijo del color de su tono; «En producción» espera en ámbar. Comercial la
        usa desde la entrega 10.4b. Mantenimiento y Mermas usan Badge con sus
        propias variantes.
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
        Las migas de pan separan cada parte con «›» en gris; los enlaces se
        aclaran con subrayado al pasar el puntero y la página actual va en
        semibold. La cabecera de esta página es el componente compartido
        PageHeader, con migas de pan y descripción.
      </GalleryNote>
    </GallerySection>
  );
}
