import Link from "next/link";
import { ArrowRight, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

const VARIANTS = [
  { variant: "default", use: "Acción principal: guardar, filtrar, nuevo registro" },
  { variant: "outline", use: "Acción secundaria y paginación" },
  { variant: "secondary", use: "Acción neutra" },
  { variant: "ghost", use: "Acciones por fila (editar)" },
  { variant: "destructive", use: "Anular, inactivar, cerrar sesión" },
  { variant: "link", use: "Acción con aspecto de enlace" },
  { variant: "clear", use: "Limpiar filtros" },
] as const;

const TEXT_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

export function ButtonsSection() {
  return (
    <GallerySection
      id="botones"
      description="Cada variante en sus tamaños de texto y de solo icono, y los estados que usan las pantallas."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {VARIANTS.map(({ variant, use }) => (
          <GallerySample key={variant} label={`${variant} · ${use}`}>
            {TEXT_SIZES.map((size) => (
              <Button key={size} type="button" variant={variant} size={size}>
                Guardar {size}
              </Button>
            ))}
            {ICON_SIZES.map((size) => (
              <Button key={size} type="button" variant={variant} size={size} aria-label={`Agregar (${size})`}>
                <Plus />
              </Button>
            ))}
          </GallerySample>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GallerySample label="Deshabilitado">
          <Button type="button" disabled>
            Guardar
          </Button>
          <Button type="button" variant="outline" disabled>
            Anterior
          </Button>
          <Button type="button" variant="destructive" disabled>
            Anular
          </Button>
        </GallerySample>

        <GallerySample label="Con icono">
          <Button type="button">
            <Plus data-icon="inline-start" />
            Nuevo registro
          </Button>
          <Button type="button" variant="outline">
            Siguiente
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button type="button" variant="destructive">
            <Trash2 data-icon="inline-start" />
            Eliminar
          </Button>
        </GallerySample>

        <GallerySample label="Como enlace">
          <Button asChild>
            <Link href="#botones">Nuevo cliente</Link>
          </Button>
          <Button variant="clear" asChild>
            <Link href="#botones">Limpiar filtros</Link>
          </Button>
        </GallerySample>

        <GallerySample label="Pendiente">
          <GalleryNote>
            Sin componente compartido: hoy cada formulario cambia su texto a
            «Guardando...» por su cuenta. El estado pendiente común llega en la
            sub-entrega de botones y campos.
          </GalleryNote>
        </GallerySample>
      </div>

      <GalleryNote>
        Teclado: recorre los botones con Tab; cada uno debe mostrar su indicador
        de foco y activarse con Enter o Espacio.
      </GalleryNote>
    </GallerySection>
  );
}
