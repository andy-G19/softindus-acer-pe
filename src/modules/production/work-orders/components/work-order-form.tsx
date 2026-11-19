"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActionForm } from "@/components/forms/action-form";
import { Field, FieldError } from "@/components/forms/field";
import {
  DiscardConfirmDialog,
  type SurfaceLeaveReason,
  useDiscardGuard,
  useFormResult,
} from "@/components/forms/form-surface";
import { OperationKeyField } from "@/components/forms/operation-key-field";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import type { WorkOrderFormState } from "@/modules/production/work-orders/actions";

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
  action: (prevState: WorkOrderFormState, formData: FormData) => Promise<WorkOrderFormState>;
  products: ProductOption[];
  routes: RouteOption[];
  versions: RecipeVersionOption[];
  orderDetails: OrderDetailOption[];
  campaigns: CampaignOption[];
  canCreateOrder: boolean;
  initialStartDate: string;
  /**
   * Aviso que se da al guardar, del catalogo de Produccion. La pagina lo pasa con su clave literal
   * (productionNotifications["work-order-created"]) para que notification-registry.test.ts vea
   * quien emite la clave.
   */
  successNotification: NotificationDefinition;
  /** Pagina a la que vuelve Cancelar; la pagina ya la valido. */
  returnTo: string;
};

const initialState: WorkOrderFormState = { status: "idle" };

const WORK_ORDERS_HREF = "/dashboard/production/work-orders";

const DISCARD = {
  title: "¿Descartar la orden de trabajo?",
  description: "Se perderán los datos que escribiste en este formulario.",
};

function formatProductLabel(product: ProductOption) {
  return `${product.nombre_producto} - ${product.categoria} - ${product.unidad_medida}`;
}

/** Marca un SearchableSelect con el error de su campo, para que ActionForm lo enfoque. */
function invalidProps(name: string, errors: string[] | undefined) {
  return errors?.length
    ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` }
    : {};
}

// C5 de la 11.6a (D66): el formulario de crear orden usa la accion con resultado, como la planilla
// (C6 de la 11.5): con error, el mensaje general queda en el formulario y cada error va junto a su
// campo, con lo elegido; con exito hay un solo aviso, la clave se renueva y se va al detalle de la
// orden creada. La clave de operacion hace que un doble envio cree una sola orden.
export function WorkOrderForm({
  action,
  products,
  routes,
  versions,
  orderDetails,
  campaigns,
  canCreateOrder,
  initialStartDate,
  successNotification,
  returnTo,
}: WorkOrderFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const resultKey = state.status === "idle" ? undefined : state.operationId;
  const completedKey = state.status === "success" ? state.data.clave_operacion : undefined;
  const createdHref =
    state.status === "success" ? `${WORK_ORDERS_HREF}/${state.data.id_orden_trabajo}` : null;

  // Lo elegido vive aqui y no en los campos: ActionForm vuelve a montar los campos con la
  // respuesta y SearchableSelect no tiene valor inicial propio, asi que tras un error se conserva.
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

  // Al guardar va al detalle de la orden creada; al cancelar, a la pagina de la que vino. El
  // efecto de useDiscardGuard que guarda onLeave corre antes que el de useFormResult que lo llama,
  // porque se declara antes: con el exito ya ve la orden creada.
  const leave = useCallback(
    (reason: SurfaceLeaveReason) => {
      router.push(reason === "saved" && createdHref ? createdHref : returnTo);
    },
    [router, createdHref, returnTo],
  );
  const { controls, markDirty, trackFocus, discardDialog } = useDiscardGuard({ onLeave: leave });

  // Mientras la accion esta pendiente, Cancelar no sale.
  useEffect(() => {
    controls.setBusy(pending);
  }, [controls, pending]);

  // Un aviso por operacion; tras guardar sale sin preguntar.
  useFormResult(state, pending, { successNotification, onSuccess: controls.closeAfterSave });

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

  // Un clic normal en Cancelar pasa por el descarte; con una tecla de modificador o la rueda, el
  // enlace abre la pagina en otra pestana.
  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    controls.requestClose();
  }

  return (
    <>
      <ActionForm
        action={formAction}
        pending={pending}
        resultKey={resultKey}
        onSubmit={validateBeforeSubmit}
        onInput={() => markDirty(true)}
        onFocus={trackFocus}
        className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <OperationKeyField scope="orden_trabajo:nueva" completedKey={completedKey} />

        {validationMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{validationMessage}</AlertDescription>
          </Alert>
        ) : null}

        <FormErrorAlert state={state} />

        <section className="grid gap-5 md:grid-cols-2">
          <Field
            id="tipo_produccion"
            label="Tipo de producción"
            required
            disabled={!canCreateOrder}
            description="El producto controla las rutas y recetas disponibles."
            errors={fieldErrors?.tipo_produccion}
          >
            {(control) => (
              // Dentro de ActionForm un select usa defaultValue con su onChange: React 19
              // reinicia el formulario tras la accion (hallazgo 13 de la 10.6a).
              <NativeSelect
                {...control}
                name="tipo_produccion"
                defaultValue={productionType}
                onChange={(event) => {
                  handleProductionTypeChange(event.target.value as ProductionType);
                }}
              >
                <option value="pedido">Por pedido</option>
                <option value="campania">Por campaña</option>
                <option value="reposicion_stock">Reposición de stock</option>
              </NativeSelect>
            )}
          </Field>

          <Field
            id="prioridad"
            label="Prioridad"
            required
            disabled={!canCreateOrder}
            errors={fieldErrors?.prioridad}
          >
            {(control) => (
              <NativeSelect
                {...control}
                name="prioridad"
                defaultValue={values?.prioridad || "media"}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </NativeSelect>
            )}
          </Field>
        </section>

        {productionType === "pedido" ? (
          <section className="space-y-2">
            <SearchableSelect
              id="id_detalle_pedido"
              name="id_detalle_pedido"
              label="Detalle de pedido"
              placeholder="Buscar por cliente, producto o pedido..."
              items={orderDetailItems}
              value={selectedOrderDetailId}
              required
              disabled={!canCreateOrder}
              emptyMessage="No hay detalles pendientes o aprobados."
              onValueChange={handleOrderDetailChange}
              {...invalidProps("id_detalle_pedido", fieldErrors?.id_detalle_pedido)}
            />
            <FieldError id="id_detalle_pedido-error" messages={fieldErrors?.id_detalle_pedido} />
          </section>
        ) : null}

        {productionType === "campania" ? (
          <section className="space-y-2">
            <SearchableSelect
              id="id_campania"
              name="id_campania"
              label="Campaña"
              placeholder="Buscar campaña activa o planificada..."
              items={campaignItems}
              value={selectedCampaignId}
              required
              disabled={!canCreateOrder}
              emptyMessage="No hay campañas activas o planificadas."
              onValueChange={handleCampaignChange}
              {...invalidProps("id_campania", fieldErrors?.id_campania)}
            />
            <FieldError id="id_campania-error" messages={fieldErrors?.id_campania} />
          </section>
        ) : null}

        <section className="space-y-2">
          {productionType === "pedido" ? (
            <>
              <Label>Producto *</Label>
              <input type="hidden" name="id_producto" value={selectedProductId} />
              <div className="flex h-8 items-center rounded-lg border border-border bg-muted px-2.5 text-sm">
                {selectedProduct
                  ? formatProductLabel(selectedProduct)
                  : "Seleccione primero un detalle de pedido"}
              </div>
            </>
          ) : (
            <SearchableSelect
              id="id_producto"
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
              {...invalidProps("id_producto", fieldErrors?.id_producto)}
            />
          )}
          <FieldError id="id_producto-error" messages={fieldErrors?.id_producto} />

          <p className="text-xs text-muted-foreground">
            Al cambiar de producto se limpian la ruta y la receta seleccionadas.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <SearchableSelect
              id="id_ruta"
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
              {...invalidProps("id_ruta", fieldErrors?.id_ruta)}
            />
            <FieldError id="id_ruta-error" messages={fieldErrors?.id_ruta} />

            {selectedProductId && availableRoutes.length === 0 ? (
              <p className="text-xs text-destructive">
                El producto seleccionado no tiene rutas activas con etapas.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <SearchableSelect
              id="id_version_receta"
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
              {...invalidProps("id_version_receta", fieldErrors?.id_version_receta)}
            />
            <FieldError id="id_version_receta-error" messages={fieldErrors?.id_version_receta} />

            {selectedProductId && availableVersions.length === 0 ? (
              <p className="text-xs text-destructive">
                El producto seleccionado no tiene recetas vigentes con
                materiales.
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <Field
            id="cantidad"
            label="Cantidad"
            required
            disabled={!canCreateOrder}
            errors={fieldErrors?.cantidad}
          >
            {(control) => (
              <Input
                {...control}
                name="cantidad"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Ej. 50"
              />
            )}
          </Field>

          <Field
            id="fecha_inicio"
            label="Fecha de inicio"
            required
            disabled={!canCreateOrder}
            errors={fieldErrors?.fecha_inicio}
          >
            {(control) => (
              <Input
                {...control}
                name="fecha_inicio"
                type="date"
                defaultValue={values?.fecha_inicio ?? initialStartDate}
              />
            )}
          </Field>

          <Field
            id="fecha_entrega_estimada"
            label="Entrega estimada"
            disabled={!canCreateOrder}
            errors={fieldErrors?.fecha_entrega_estimada}
          >
            {(control) => (
              <Input
                {...control}
                name="fecha_entrega_estimada"
                type="date"
                defaultValue={values?.fecha_entrega_estimada}
              />
            )}
          </Field>
        </section>

        <Field
          id="observaciones"
          label="Observaciones"
          disabled={!canCreateOrder}
          errors={fieldErrors?.observaciones}
        >
          {(control) => (
            <Textarea
              {...control}
              name="observaciones"
              rows={4}
              maxLength={700}
              defaultValue={values?.observaciones}
              placeholder="Ej. Priorizar corte y prensado durante la mañana."
            />
          )}
        </Field>

        <Alert variant="info">
          <AlertDescription>
            Esta orden queda registrada en estado pendiente. Los avances por
            etapa de producción se generan y actualizan desde la pantalla de
            avances de la orden.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href={returnTo} onClick={handleCancel}>
              Cancelar
            </Link>
          </Button>

          <SubmitButton disabled={!canCreateOrder} pendingText="Creando...">
            Crear orden
          </SubmitButton>
        </div>
      </ActionForm>

      <DiscardConfirmDialog {...discardDialog} {...DISCARD} />
    </>
  );
}
