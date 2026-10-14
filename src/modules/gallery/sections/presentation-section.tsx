import { Boxes, Factory, Package, Users } from "lucide-react";

import { StatusBadge } from "@/components/commercial/status-badge";
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
import {
  GalleryNote,
  GallerySample,
  GallerySection,
} from "@/modules/gallery/gallery-layout";

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
  "vigente",
  "pagada",
  "entregado",
  "pendiente",
  "parcial",
  "en_produccion",
  "anulado",
  "desconocido",
];

export function PresentationSection() {
  return (
    <GallerySection
      id="presentacion"
      description="Etiquetas, tarjetas, indicadores y separadores."
    >
      <GallerySample label="Etiqueta (Badge) en cada variante">
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </GallerySample>

      <GallerySample label="Etiqueta de estado comercial (StatusBadge)">
        {COMMERCIAL_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </GallerySample>
      <GalleryNote>
        Hay dos aspectos para las etiquetas de estado: Badge, que usan la mayoría
        de los módulos, y StatusBadge, que usa Comercial. Unificarlos es una
        decisión visible que se tomará al migrar los listados.
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

      <GallerySample label="Indicadores (KpiCard)" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pedidos" value="12" description="Pendientes de entrega" tone="info" />
        <KpiCard title="Cobranzas" value="S/ 8 300" description="Cobradas este mes" tone="success" />
        <KpiCard title="Stock bajo" value="3" description="Materiales bajo el mínimo" tone="warning" />
        <KpiCard
          title="Órdenes"
          value="5"
          description="Con enlace e icono"
          tone="info"
          icon={Factory}
          href="#presentacion"
        />
      </GallerySample>

      <GallerySample label="Acceso a módulo (ModuleAccessCard)" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ModuleAccessCard title="Clientes" description="Registro y consulta de clientes." href="#presentacion" icon={Users} index={1} />
        <ModuleAccessCard title="Materiales" description="Catálogo y stock." href="#presentacion" icon={Package} tone="chart-3" index={2} />
        <ModuleAccessCard title="Almacén" description="Movimientos de inventario." href="#presentacion" icon={Boxes} tone="chart-2" index={3} />
        <ModuleAccessCard title="Sin icono" description="Muestra el icono genérico." href="#presentacion" tone="chart-4" />
      </GallerySample>

      <GallerySample label="Separadores" className="h-10">
        <span className="text-sm">Horizontal</span>
        <Separator className="max-w-40" />
        <Separator orientation="vertical" />
        <span className="text-sm">Vertical</span>
      </GallerySample>
    </GallerySection>
  );
}
