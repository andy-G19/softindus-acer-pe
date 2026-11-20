import { Boxes, Factory, Package, Users } from "lucide-react";

import { StateBadge } from "@/components/commercial/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { Separator } from "@/components/ui/separator";
import { GestureReplayDemo } from "@/modules/gallery/gesture-replay-demo";
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D153 a D158), con datos
// ficticios: ninguna muestra consulta la base ni llama al servidor.

const BADGE_VARIANTS = [
  "default",
  "success",
  "warning",
  "info",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const;

const COMMERCIAL_STATUSES = [
  "registrado",
  "aprobado",
  "aceptada",
  "vigente",
  "pagada",
  "emitido",
  "entregado",
  "pendiente",
  "sin-proforma",
  "sin-comprobante",
  "parcial",
  "en_produccion",
  "anulado",
  "anulada",
  "cancelado",
  "desconocido",
];

const ORDER_HISTORY = [7, 9, 11, 10, 11, 12].map((value, index, all) => ({
  label: index === all.length - 1 ? "Hoy" : `Día ${index + 1}`,
  value,
}));

const COLLECTION_HISTORY = [2100, 3400, 4600, 5800, 7100, 8300].map((value, index, all) => ({
  label: index === all.length - 1 ? "Actual" : `Sem ${index + 1}`,
  value,
  valueText: `S/ ${value.toLocaleString("es-PE").replaceAll(",", " ")}`,
}));

const WORK_ORDER_HISTORY = [4, 3, 5, 4, 5, 5].map((value, index, all) => ({
  label: index === all.length - 1 ? "Actual" : `P ${index + 1}`,
  value,
  separatorBefore: index === 3,
}));

export function PresentationSection() {
  return (
    <GallerySection
      id="presentacion"
      description="Etiquetas, tarjetas, indicadores y separadores."
    >
      <GallerySample label="Etiqueta (Badge) en cada variante">
        <GestureReplayDemo>
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </GestureReplayDemo>
      </GallerySample>
      <GalleryNote>
        Nueve variantes con el mismo significado que Button: default (lingote cobre) y secondary
        (acero cepillado) son rellenos; success, warning, info y destructive son las superficies de
        las alertas; outline, ghost y link acompañan texto sin competir con él. Al pasar el puntero
        suben y se aclaran. En reposo no se mueven: success se asienta con un sello al aparecer y
        destructive sacude una vez.
      </GalleryNote>

      <GallerySample label="Etiqueta de estado (StateBadge)">
        <GestureReplayDemo>
          {COMMERCIAL_STATUSES.map((status) => (
            <StateBadge key={status} status={status} />
          ))}
        </GestureReplayDemo>
      </GallerySample>
      <GalleryNote>
        StateBadge es Badge con el tono, el gesto y el punto de cada estado comercial: el punto deja
        ver, sin leer, qué tan avanzado va. Registrado se sella, vigente brilla fijo, pagada y
        entregado cierran en verde, pendiente y parcial esperan en ámbar (parcial a medio rellenar),
        en producción emite un doble pulso de radar, el único movimiento continuo, y anulado entra
        con un golpe de sello. Un estado desconocido se muestra tal cual, con borde discontinuo.
        Comercial la usa desde la entrega 10.4b; Mantenimiento y Mermas usan Badge con sus propias
        variantes.
      </GalleryNote>

      <div className="grid gap-6 lg:grid-cols-3">
        <GallerySample label="Tarjeta completa" className="block">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Resumen del pedido</CardTitle>
              <CardDescription>PED00000012 · Metalmecánica Lima</CardDescription>
              <CardAction>
                <Button type="button" size="sm" variant="outline">
                  Ver
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>Total: S/ 12 450,00</CardContent>
            <CardFooter>Actualizado el 13/10/2026</CardFooter>
          </Card>
        </GallerySample>

        <GallerySample label="Tarjeta con barra térmica" className="block">
          <Card heatBar>
            <CardHeader>
              <CardTitle>Producción del día</CardTitle>
            </CardHeader>
            <CardContent>3 órdenes en curso</CardContent>
          </Card>
        </GallerySample>

        <GallerySample label="Tarjeta pequeña" className="block">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Caja chica</CardTitle>
            </CardHeader>
            <CardContent>Saldo: S/ 350,00</CardContent>
          </Card>
        </GallerySample>
      </div>
      <GalleryNote>
        Placa de acero cepillado cuya textura se desplaza en un ciclo de 18 s, casi imperceptible.
        Al pasar el puntero sube y aclara el borde. La barra térmica es el barrido de la marca.
      </GalleryNote>

      <GallerySample label="Indicadores (KpiCard)" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Pedidos"
          value="12"
          description="Pendientes de entrega"
          tone="info"
          period="6D"
          history={ORDER_HISTORY}
          historyLabel="Pedidos de los últimos 6 días"
          status="Despacho activo"
          delta={{ text: "+1 vs ayer", positive: true }}
        />
        <KpiCard
          title="Cobranzas"
          value="S/ 8 300"
          description="Cobradas este mes"
          tone="success"
          period="Mes"
          history={COLLECTION_HISTORY}
          historyLabel="Cobranzas acumuladas por semana"
          status="Meta mensual 83 %"
          delta={{ text: "+16,9 %", positive: true }}
        />
        <KpiCard
          title="Stock bajo"
          description="3 de 8 materiales por debajo del mínimo"
          tone="warning"
          gauge={{ current: 3, total: 8 }}
        />
        <KpiCard
          title="Órdenes"
          value="5"
          description="Con enlace e icono"
          tone="info"
          icon={Factory}
          href="#presentacion"
          history={WORK_ORDER_HISTORY}
          historyLabel="Órdenes por periodo"
        />
      </GallerySample>
      <GalleryNote>
        Franja LED, halo del tono y un resplandor que sigue el puntero. Periodo, minigráfico, estado,
        variación y dial son opcionales: hoy solo los llena esta galería y serán la guía cuando las
        consultas los calculen. La barra más brillante es la del dato actual; el minigráfico se lee
        entero con un lector de pantalla. Sin enlace, el indicador no toma el foco.
      </GalleryNote>

      <GallerySample label="Acceso a módulo (ModuleAccessCard)" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ModuleAccessCard title="Clientes" description="Registro y consulta de clientes." href="#presentacion" icon={Users} index={1} />
        <ModuleAccessCard title="Materiales" description="Catálogo y stock." href="#presentacion" icon={Package} tone="chart-3" index={2} />
        <ModuleAccessCard title="Almacén" description="Movimientos de inventario." href="#presentacion" icon={Boxes} tone="chart-2" index={3} />
        <ModuleAccessCard title="Sin icono" description="Muestra el icono genérico." href="#presentacion" tone="chart-4" index={4} />
      </GallerySample>
      <GalleryNote>
        En reposo el número y el icono respiran despacio. Con el puntero o el foco la placa sube, el
        borde toma el color del módulo, el icono crece, el número se desplaza y aparece la flecha.
      </GalleryNote>

      <GallerySample label="Separadores" className="h-10">
        <span className="text-sm">Horizontal</span>
        <Separator className="max-w-40" />
        <Separator orientation="vertical" />
        <span className="text-sm">Vertical</span>
      </GallerySample>
      <GalleryNote>
        Un destello de acero recorre la línea horizontal y la vertical late entre el borde y el
        acero claro. Todo el movimiento de esta sección se detiene con reducir movimiento.
      </GalleryNote>
    </GallerySection>
  );
}
