import { CircleCheck, Info, Package, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialogDemo } from "@/modules/gallery/confirm-dialog-demo";
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
      description="Alertas persistentes, avisos temporales, confirmaciones y estados vacío, de error y de carga."
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
      <GallerySample label="Confirmaciones accesibles (ConfirmDialog), para comparar">
        <ConfirmDialogDemo />
      </GallerySample>
      <GalleryNote>
        Los avisos usan Toastify y las confirmaciones de la fachada usan
        SweetAlert2 hasta la entrega 11. ConfirmDialog, sobre el AlertDialog de
        Radix, nombra la entidad, la consecuencia y el verbo de la acción.
        Teclado: al abrir, el foco va a Cancelar; Tab no sale de la ventana; Esc
        la cierra y el foco vuelve al botón que la abrió. Mientras confirma, la
        acción muestra su estado pendiente y no se puede cancelar.
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

      <div className="grid gap-6 lg:grid-cols-3">
        <GallerySample label="Carga en bloque" className="block">
          <LoadingState label="Cargando materiales..." />
        </GallerySample>

        <GallerySample label="Carga en línea">
          <LoadingState variant="inline" label="Buscando clientes..." />
        </GallerySample>

        <GallerySample label="Pantalla de esqueletos" className="block">
          <div className="space-y-3 rounded-xl border border-border/80 bg-card p-5">
            <LoadingState variant="inline" label="Cargando indicadores..." className="sr-only" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </GallerySample>
      </div>
      <GalleryNote>
        LoadingState se anuncia con role=status sin mover el foco. Los bloques
        de Skeleton son decorativos: en una pantalla de esqueletos, un
        LoadingState oculto a la vista anuncia la carga. El pulso y el giro se
        detienen si el sistema pide reducir el movimiento.
      </GalleryNote>
    </GallerySection>
  );
}
