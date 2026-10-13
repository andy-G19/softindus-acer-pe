import { CircleCheck, Info, Package, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FeedbackDemo } from "@/modules/gallery/feedback-demo";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

const ALERTS = [
  { variant: "default", icon: Info, title: "Aviso general", text: "Información persistente dentro de una pantalla." },
  { variant: "info", icon: Info, title: "Información", text: "El pedido no tiene comprobante emitido." },
  { variant: "success", icon: CircleCheck, title: "Operación correcta", text: "La planilla quedó cerrada." },
  { variant: "warning", icon: TriangleAlert, title: "Advertencia", text: "El stock del material está por debajo del mínimo." },
  { variant: "destructive", icon: TriangleAlert, title: "Error", text: "No se pudo registrar el pago. Revise los datos." },
] as const;

export function MessagesSection() {
  return (
    <GallerySection
      id="mensajes"
      description="Alertas persistentes, avisos temporales, confirmaciones y estados vacío y de error."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {ALERTS.map(({ variant, icon: Icon, title, text }) => (
          <GallerySample key={variant} label={`Alerta ${variant}`} className="block">
            <Alert variant={variant}>
              <Icon />
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{text}</AlertDescription>
            </Alert>
          </GallerySample>
        ))}
      </div>

      <GallerySample label="Avisos temporales, confirmaciones y carga (fachada de notificaciones)">
        <FeedbackDemo />
      </GallerySample>
      <GalleryNote>
        Los avisos usan Toastify y las confirmaciones y la ventana de carga usan
        SweetAlert2, siempre a través de la fachada. Las confirmaciones accesibles
        sobre la base de Radix llegan en la sub-entrega de feedback y ventanas.
      </GalleryNote>

      <div className="grid gap-6 lg:grid-cols-2">
        <GallerySample label="Vacío" className="block">
          <EmptyState label="No se encontraron clientes con los filtros aplicados." />
        </GallerySample>

        <GallerySample label="Vacío con icono y acción" className="block">
          <EmptyState
            icon={Package}
            label="Todavía no hay materiales"
            description="Registra el primero para empezar a controlar su stock."
            action={
              <Button type="button" size="sm">
                Nuevo material
              </Button>
            }
          />
        </GallerySample>
      </div>

      <GallerySample label="Error de pantalla" className="block">
        <ErrorState
          title="No se pudo cargar la información"
          description="Ocurrió un problema al consultar los datos. Intenta de nuevo en unos segundos."
          detail="Ejemplo de la galería: tiempo de espera agotado."
          actions={
            <Button type="button" variant="outline">
              Reintentar
            </Button>
          }
        />
      </GallerySample>

      <GallerySample label="Carga">
        <GalleryNote>
          Sin componente compartido: solo Producción tiene un loading.tsx propio.
          Los estados de carga comunes llegan en la sub-entrega de feedback y
          ventanas.
        </GalleryNote>
      </GallerySample>
    </GallerySection>
  );
}
