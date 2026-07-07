"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createWorkOrderAction } from "@/modules/production/work-orders/actions";

type ProductionType = "pedido" | "campania" | "reposicion_stock";

type ProductOption = {
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
};

type RouteOption = {
  id_ruta: string;
  id_producto: string;
  nombre_ruta: string;
  producto_nombre: string;
  etapas_activas: number;
};

type RecipeVersionOption = {
  id_version_receta: string;
  id_producto: string;
  nombre_receta: string;
  producto_nombre: string;
  numero_version: string;
  materiales: number;
};

type OrderDetailOption = {
  id_detalle_pedido: string;
  id_producto: string;
  id_pedido: string;
  producto_nombre: string;
  cliente_nombre: string;
  cantidad: string;
};

type CampaignOption = {
  id_campania: string;
  nombre_campania: string;
  estado: string;
  productIds: string[];
};

type WorkOrderFormProps = {
  products: ProductOption[];
  routes: RouteOption[];
  versions: RecipeVersionOption[];
  orderDetails: OrderDetailOption[];
  campaigns: CampaignOption[];
  canCreateOrder: boolean;
  initialStartDate: string;
};

function formatProductLabel(product: ProductOption) {
  return `${product.nombre_producto} - ${product.categoria} - ${product.unidad_medida}`;
}

export function WorkOrderForm({
  products,
  routes,
  versions,
  orderDetails,
  campaigns,
  canCreateOrder,
  initialStartDate,
}: WorkOrderFormProps) {
  const [productionType, setProductionType] =
    useState<ProductionType>("pedido");
  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const selectedOrderDetail = useMemo(() => {
    return orderDetails.find((detail) => {
      return detail.id_detalle_pedido === selectedOrderDetailId;
    });
  }, [orderDetails, selectedOrderDetailId]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((campaign) => {
      return campaign.id_campania === selectedCampaignId;
    });
  }, [campaigns, selectedCampaignId]);

  const selectedProduct = useMemo(() => {
    return products.find((product) => {
      return product.id_producto === selectedProductId;
    });
  }, [products, selectedProductId]);

  const availableProducts = useMemo(() => {
    if (
      productionType === "campania" &&
      selectedCampaign &&
      selectedCampaign.productIds.length > 0
    ) {
      return products.filter((product) => {
        return selectedCampaign.productIds.includes(product.id_producto);
      });
    }

    return products;
  }, [products, productionType, selectedCampaign]);

  const availableRoutes = useMemo(() => {
    if (!selectedProductId) {
      return [];
    }

    return routes.filter((route) => {
      return route.id_producto === selectedProductId && route.etapas_activas > 0;
    });
  }, [routes, selectedProductId]);

  const availableVersions = useMemo(() => {
    if (!selectedProductId) {
      return [];
    }

    return versions.filter((version) => {
      return version.id_producto === selectedProductId && version.materiales > 0;
    });
  }, [versions, selectedProductId]);

  const orderDetailItems = useMemo(() => {
    return orderDetails.map((detail) => ({
      id: detail.id_detalle_pedido,
      label: `${detail.cliente_nombre} - ${detail.producto_nombre}`,
      description: `Pedido ${detail.id_pedido} - Cantidad: ${detail.cantidad}`,
    }));
  }, [orderDetails]);

  const campaignItems = useMemo(() => {
    return campaigns.map((campaign) => ({
      id: campaign.id_campania,
      label: campaign.nombre_campania,
      description:
        campaign.productIds.length > 0
          ? `${campaign.estado} - ${campaign.productIds.length} producto(s)`
          : campaign.estado,
    }));
  }, [campaigns]);

  const productItems = useMemo(() => {
    return availableProducts.map((product) => ({
      id: product.id_producto,
      label: product.nombre_producto,
      description: `${product.categoria} - ${product.unidad_medida}`,
    }));
  }, [availableProducts]);

  const routeItems = useMemo(() => {
    return availableRoutes.map((route) => ({
      id: route.id_ruta,
      label: route.nombre_ruta,
      description: `${route.producto_nombre} - Etapas: ${route.etapas_activas}`,
    }));
  }, [availableRoutes]);

  const versionItems = useMemo(() => {
    return availableVersions.map((version) => ({
      id: version.id_version_receta,
      label: `${version.nombre_receta} - ${version.numero_version}`,
      description: `${version.producto_nombre} - Materiales: ${version.materiales}`,
    }));
  }, [availableVersions]);

  function resetProductDependencies(nextProductId = "") {
    setSelectedProductId(nextProductId);
    setSelectedRouteId("");
    setSelectedVersionId("");
  }

  function handleProductionTypeChange(value: ProductionType) {
    setProductionType(value);
    setSelectedOrderDetailId("");
    setSelectedCampaignId("");
    setQuantity("");
    resetProductDependencies("");
    setValidationMessage(null);
  }

  function handleOrderDetailChange(value: string) {
    const detail = orderDetails.find((item) => item.id_detalle_pedido === value);

    setSelectedOrderDetailId(value);
    setSelectedCampaignId("");
    setQuantity(detail?.cantidad ?? "");
    resetProductDependencies(detail?.id_producto ?? "");
    setValidationMessage(null);
  }

  function handleCampaignChange(value: string) {
    const campaign = campaigns.find((item) => item.id_campania === value);
    const nextProductId =
      campaign &&
      selectedProductId &&
      campaign.productIds.length > 0 &&
      campaign.productIds.includes(selectedProductId)
        ? selectedProductId
        : "";

    setSelectedCampaignId(value);
    setSelectedOrderDetailId("");
    resetProductDependencies(nextProductId);
    setValidationMessage(null);
  }

  function handleProductChange(value: string) {
    resetProductDependencies(value);
    setValidationMessage(null);
  }

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    setValidationMessage(null);

    if (!canCreateOrder) {
      event.preventDefault();
      setValidationMessage("No hay catálogos suficientes para crear la orden.");
      return;
    }

    if (productionType === "pedido" && !selectedOrderDetail) {
      event.preventDefault();
      setValidationMessage("Seleccione un detalle de pedido.");
      return;
    }

    if (productionType === "campania" && !selectedCampaign) {
      event.preventDefault();
      setValidationMessage("Seleccione una campaña.");
      return;
    }

    if (!selectedProductId || !selectedProduct) {
      event.preventDefault();
      setValidationMessage("Seleccione un producto.");
      return;
    }

    if (
      productionType === "campania" &&
      selectedCampaign &&
      selectedCampaign.productIds.length > 0 &&
      !selectedCampaign.productIds.includes(selectedProductId)
    ) {
      event.preventDefault();
      setValidationMessage("El producto no pertenece a la campaña seleccionada.");
      return;
    }

    const route = routes.find((item) => item.id_ruta === selectedRouteId);

    if (!route || route.id_producto !== selectedProductId) {
      event.preventDefault();
      setValidationMessage("Seleccione una ruta del mismo producto.");
      return;
    }

    const version = versions.find((item) => {
      return item.id_version_receta === selectedVersionId;
    });

    if (!version || version.id_producto !== selectedProductId) {
      event.preventDefault();
      setValidationMessage("Seleccione una receta del mismo producto.");
      return;
    }

    if (Number(quantity) <= 0) {
      event.preventDefault();
      setValidationMessage("Ingrese una cantidad mayor a cero.");
    }
  }

  return (
    <form
      action={createWorkOrderAction}
      onSubmit={validateBeforeSubmit}
      className="space-y-6 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
    >
      {validationMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{validationMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de producción *</Label>
          <NativeSelect
            name="tipo_produccion"
            required
            value={productionType}
            disabled={!canCreateOrder}
            onChange={(event) => {
              handleProductionTypeChange(event.target.value as ProductionType);
            }}
          >
            <option value="pedido">Por pedido</option>
            <option value="campania">Por campaña</option>
            <option value="reposicion_stock">Reposición de stock</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            El producto controla las rutas y recetas disponibles.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Prioridad *</Label>
          <NativeSelect
            name="prioridad"
            required
            defaultValue="media"
            disabled={!canCreateOrder}
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </NativeSelect>
        </div>
      </section>

      {productionType === "pedido" ? (
        <section>
          <SearchableSelect
            name="id_detalle_pedido"
            label="Detalle de pedido"
            placeholder="Buscar por cliente, producto o pedido..."
            items={orderDetailItems}
            value={selectedOrderDetailId}
            required
            disabled={!canCreateOrder}
            emptyMessage="No hay detalles pendientes o aprobados."
            onValueChange={handleOrderDetailChange}
          />
        </section>
      ) : null}

      {productionType === "campania" ? (
        <section>
          <SearchableSelect
            name="id_campania"
            label="Campaña"
            placeholder="Buscar campaña activa o planificada..."
            items={campaignItems}
            value={selectedCampaignId}
            required
            disabled={!canCreateOrder}
            emptyMessage="No hay campañas activas o planificadas."
            onValueChange={handleCampaignChange}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        {productionType === "pedido" ? (
          <>
            <Label>Producto *</Label>
            <input type="hidden" name="id_producto" value={selectedProductId} />
            <div className="flex h-8 items-center rounded-lg border border-input bg-muted px-2.5 text-sm">
              {selectedProduct
                ? formatProductLabel(selectedProduct)
                : "Seleccione primero un detalle de pedido"}
            </div>
          </>
        ) : (
          <SearchableSelect
            name="id_producto"
            label="Producto"
            placeholder="Buscar producto..."
            items={productItems}
            value={selectedProductId}
            required
            disabled={
              !canCreateOrder ||
              (productionType === "campania" && !selectedCampaignId)
            }
            emptyMessage="No hay productos disponibles."
            onValueChange={handleProductChange}
          />
        )}

        <p className="text-xs text-muted-foreground">
          Al cambiar de producto se limpian la ruta y la receta seleccionadas.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <SearchableSelect
            name="id_ruta"
            label="Ruta de fabricación"
            placeholder="Buscar ruta del producto..."
            items={routeItems}
            value={selectedRouteId}
            required
            disabled={!canCreateOrder || !selectedProductId}
            emptyMessage="No hay rutas activas para este producto."
            onValueChange={(value) => {
              setSelectedRouteId(value);
              setValidationMessage(null);
            }}
          />

          {selectedProductId && availableRoutes.length === 0 ? (
            <p className="text-xs text-destructive">
              El producto seleccionado no tiene rutas activas con etapas.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <SearchableSelect
            name="id_version_receta"
            label="Versión de receta"
            placeholder="Buscar receta del producto..."
            items={versionItems}
            value={selectedVersionId}
            required
            disabled={!canCreateOrder || !selectedProductId}
            emptyMessage="No hay recetas vigentes con materiales para este producto."
            onValueChange={(value) => {
              setSelectedVersionId(value);
              setValidationMessage(null);
            }}
          />

          {selectedProductId && availableVersions.length === 0 ? (
            <p className="text-xs text-destructive">
              El producto seleccionado no tiene recetas vigentes con
              materiales.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Cantidad *</Label>
          <Input
            name="cantidad"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={quantity}
            disabled={!canCreateOrder}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Ej. 50"
          />
        </div>

        <div className="space-y-2">
          <Label>Fecha de inicio *</Label>
          <Input
            name="fecha_inicio"
            type="date"
            required
            defaultValue={initialStartDate}
            disabled={!canCreateOrder}
          />
        </div>

        <div className="space-y-2">
          <Label>Entrega estimada</Label>
          <Input
            name="fecha_entrega_estimada"
            type="date"
            disabled={!canCreateOrder}
          />
        </div>
      </section>

      <section className="space-y-2">
        <Label>Observaciones</Label>
        <Textarea
          name="observaciones"
          rows={4}
          maxLength={700}
          disabled={!canCreateOrder}
          placeholder="Ej. Priorizar corte y prensado durante la mañana."
        />
      </section>

      <Alert variant="info">
        <AlertDescription>
          Esta orden queda registrada en estado pendiente. Los avances por
          etapa de producción se generan y actualizan desde la pantalla de
          avances de la orden.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between pt-4">
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href="/dashboard/production/work-orders">Cancelar</Link>
        </Button>

        <Button type="submit" disabled={!canCreateOrder}>
          Crear orden
        </Button>
      </div>
    </form>
  );
}
