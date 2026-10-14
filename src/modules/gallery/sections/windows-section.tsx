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
        Teclado: al abrir, el foco va al primer campo (o a la X si no hay
        campos); Tab no sale de la ventana; Esc o un clic en el velo la cierran
        y el foco vuelve al botón que la abrió. En la ventana larga, el cuerpo se
        desplaza con la rueda, el dedo o las flechas, y el pie sigue visible.
        Mientras se registra el pago no se puede cerrar. En el teléfono, la
        ventana y los paneles ocupan la pantalla y los botones del pie se apilan.
      </GalleryNote>
    </GallerySection>
  );
}
