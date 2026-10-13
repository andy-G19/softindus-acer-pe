import Link from "next/link";

import { BackButton } from "@/components/navigation/back-button";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { RowActions, RowEditLink } from "@/components/table/row-actions";
import { Badge } from "@/components/ui/badge";
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
import { getPaginationMeta } from "@/lib/pagination";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

const GALLERY_PATH = "/dashboard/gallery";

const ROWS = [
  { id: "CLI00000001", name: "Metalmecánica Lima S.A.C.", type: "Empresa", phone: "014567890", active: true },
  { id: "CLI00000002", name: "Taller Arequipa", type: "Persona natural", phone: null, active: true },
  { id: "CLI00000003", name: "Estructuras del Sur", type: "Empresa", phone: "054223344", active: false },
];

export function ListingSection() {
  return (
    <GallerySection
      id="listados"
      description="Barra de filtros, tabla con acciones por fila, resultados vacíos, paginación y navegación, como en el listado de clientes."
    >
      <GallerySample label="Barra de filtros" className="block">
        <form
          method="GET"
          action={`${GALLERY_PATH}#listados`}
          className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="galeria-q">Búsqueda general</Label>
            <Input id="galeria-q" name="q" placeholder="Nombre, documento o teléfono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="galeria-filtro-estado">Estado</Label>
            <NativeSelect id="galeria-filtro-estado" name="status" defaultValue="">
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </NativeSelect>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit">Filtrar</Button>
            <Button variant="clear" asChild>
              <Link href={`${GALLERY_PATH}#listados`}>Limpiar filtros</Link>
            </Button>
          </div>
        </form>
      </GallerySample>
      <GalleryNote>
        Hoy cada listado arma su barra con su propia rejilla (hay más de 10
        combinaciones de clases en 27 formularios). La barra compartida, con un
        rango de fechas validado, llega en la sub-entrega de listados.
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
                    <Button type="button" variant={row.active ? "destructive" : "ghost"} size="sm">
                      {row.active ? "Inactivar" : "Activar"}
                    </Button>
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
        «Activar» e «Inactivar» se muestran con el aspecto de
        RowToggleStatusButton, pero aquí no envían nada: ese componente exige una
        acción del servidor y la galería no ejecuta ninguna.
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
