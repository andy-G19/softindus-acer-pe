"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
      setValidationMessage("No hay catalogos suficientes para crear la orden.");
      return;
    }

    if (productionType === "pedido" && !selectedOrderDetail) {
      event.preventDefault();
      setValidationMessage("Seleccione un detalle de pedido.");
      return;
    }

    if (productionType === "campania" && !selectedCampaign) {
      event.preventDefault();
      setValidationMessage("Seleccione una campania.");
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
      setValidationMessage("El producto no pertenece a la campania seleccionada.");
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
      className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"
    >
      {validationMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {validationMessage}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de produccion *</label>

          <select
            name="tipo_produccion"
            required
            value={productionType}
            disabled={!canCreateOrder}
            onChange={(event) => {
              handleProductionTypeChange(event.target.value as ProductionType);
            }}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          >
            <option value="pedido">Por pedido</option>
            <option value="campania">Por campania</option>
            <option value="reposicion_stock">Reposicion de stock</option>
          </select>

          <p className="text-xs text-slate-500">
            El producto controla las rutas y recetas disponibles.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Prioridad *</label>

          <select
            name="prioridad"
            required
            defaultValue="media"
            disabled={!canCreateOrder}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
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
            label="Campania"
            placeholder="Buscar campania activa o planificada..."
            items={campaignItems}
            value={selectedCampaignId}
            required
            disabled={!canCreateOrder}
            emptyMessage="No hay campanias activas o planificadas."
            onValueChange={handleCampaignChange}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        {productionType === "pedido" ? (
          <>
            <label className="text-sm font-medium">Producto *</label>
            <input type="hidden" name="id_producto" value={selectedProductId} />
            <div className="rounded-lg border bg-slate-100 px-3 py-2 text-sm text-slate-700">
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

        <p className="text-xs text-slate-500">
          Al cambiar de producto se limpian la ruta y la receta seleccionadas.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <SearchableSelect
            name="id_ruta"
            label="Ruta de fabricacion"
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
            <p className="text-xs text-red-600">
              El producto seleccionado no tiene rutas activas con etapas.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <SearchableSelect
            name="id_version_receta"
            label="Version de receta"
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
            <p className="text-xs text-red-600">
              El producto seleccionado no tiene recetas vigentes con materiales.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Cantidad *</label>

          <input
            name="cantidad"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={quantity}
            disabled={!canCreateOrder}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Ej. 50"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha de inicio *</label>

          <input
            name="fecha_inicio"
            type="date"
            required
            defaultValue={initialStartDate}
            disabled={!canCreateOrder}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Entrega estimada</label>

          <input
            name="fecha_entrega_estimada"
            type="date"
            disabled={!canCreateOrder}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-medium">Observaciones</label>

        <textarea
          name="observaciones"
          rows={4}
          maxLength={700}
          disabled={!canCreateOrder}
          placeholder="Ej. Priorizar corte y prensado durante la manana."
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
        />
      </section>

      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Importante</p>

        <p className="mt-1">
          Esta fase crea la orden de trabajo y la deja en estado pendiente. En
          la siguiente fase se generan y actualizan los avances por etapa de
          produccion.
        </p>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Link
          href="/dashboard/production/work-orders"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={!canCreateOrder}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Crear orden
        </button>
      </div>
    </form>
  );
}
