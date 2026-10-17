import { DialogDemo } from "@/modules/gallery/dialog-demo";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

export function WindowsSection() {
  return (
    <GallerySection
      id="ventanas"
      description="Ventanas y paneles laterales con encabezado y pie fijos y cuerpo desplazable. En el teléfono ocupan la pantalla completa."
    >
      <GallerySample label="Ventana (Dialog) y panel lateral (Sheet)">
        <DialogDemo />
      </GallerySample>

      <GalleryNote>
        Teclado: al abrir, el foco va al primer campo. En la ventana larga, sin
        campos, va al cuerpo, que entra en el orden de Tab y se desplaza con las
        flechas y AvPág; en el panel de enlaces, a la X, porque Radix no da el
        foco inicial a un enlace. Tab no sale de la ventana; Esc o un clic en el
        velo la cierran y el foco vuelve al botón que la abrió. En la ventana
        larga, el cuerpo también se desplaza con la rueda o el dedo, y el pie
        sigue visible. Mientras se registra el pago no se puede cerrar. Si
        escribiste algo en el pago, cerrar (Cancelar, X, Esc o el velo) pide
        confirmar el descarte; Cancelar vuelve a la ventana con el foco donde
        estaba. Con cambios, recargar o salir de la página lo pregunta el
        navegador. En el teléfono, la
        ventana y los paneles ocupan la pantalla y los botones del pie se apilan.
      </GalleryNote>

      <GalleryNote>
        RouteSheet (src/components/navigation) es el panel lateral de una ruta
        interceptada y no se puede abrir aquí, porque cerrarlo es volver atrás
        en el historial. Lo usa Clientes: «Nuevo cliente» y «Editar» abren el
        formulario en un panel sobre la lista, que conserva sus filtros, su
        página y su desplazamiento; Atrás lo cierra y Adelante lo reabre; con
        cambios, cerrarlo pide confirmar el descarte, y al cerrarlo el foco
        vuelve al enlace que lo abrió. Una recarga o la URL directa muestran el
        formulario a página completa.
      </GalleryNote>
    </GallerySection>
  );
}
