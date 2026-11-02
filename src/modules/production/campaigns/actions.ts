"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockCampaignRow } from "@/lib/row-locks";
import {
  campaignDetailSchema,
  productionCampaignSchema,
  updateProductionCampaignSchema,
} from "@/schemas/production/campaign.schema";

const CLOSED_CAMPAIGN_STATES = ["finalizada", "anulada"];
const DUPLICATED_DETAIL = "Ese producto ya está registrado en la campaña.";
const INACTIVE_PRODUCT = "El producto seleccionado no existe o está inactivo.";
const PERMISSION_ERROR = "No tienes permisos para gestionar campañas de producción.";
const INVALID_DATA = "Revisa los datos de la campaña.";
const SAVE_ERROR = "No se pudo guardar la campaña. Intenta nuevamente.";

/** Lo que el formulario de campana envio, tal cual, para volver a mostrarlo. */
export type ProductionCampaignFormValues = {
  nombre_campania: string;
  fecha_inicio: string;
  fecha_fin: string;
  objetivo_general: string;
  estado: string;
};

// Entrega 10.7a: el alta y la edicion se usan desde el panel lateral y devuelven el
// resultado; sin permiso responden con un error, no redirigen.
export type ProductionCampaignFormState = FormActionState<ProductionCampaignFormValues, { id_campania: string }>;

function getCampaignFormValues(formData: FormData): ProductionCampaignFormValues {
  const text = (name: keyof ProductionCampaignFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombre_campania: text("nombre_campania"),
    fecha_inicio: text("fecha_inicio"),
    fecha_fin: text("fecha_fin"),
    objetivo_general: text("objetivo_general"),
    estado: text("estado"),
  };
}

function campaignError(
  values: ProductionCampaignFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): ProductionCampaignFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function campaignSaved(values: ProductionCampaignFormValues, idCampania: string): ProductionCampaignFormState {
  return { status: "success", data: { id_campania: idCampania }, values, operationId: newOperationId() };
}

/** Lo que la ventana de agregar producto envio, tal cual, para volver a mostrarlo. */
export type CampaignDetailFormValues = {
  id_producto: string;
  cantidad_objetivo: string;
  observaciones: string;
};

export type CampaignDetailFormState = FormActionState<CampaignDetailFormValues, { id_campania_detalle: string }>;

type DetailProblem = { error: string; fieldErrors?: FieldErrors };

const duplicatedProduct: DetailProblem = {
  error: DUPLICATED_DETAIL,
  fieldErrors: { id_producto: [DUPLICATED_DETAIL] },
};

function getCampaignDetailFormValues(formData: FormData): CampaignDetailFormValues {
  const text = (name: keyof CampaignDetailFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_producto: text("id_producto"),
    cantidad_objetivo: text("cantidad_objetivo"),
    observaciones: text("observaciones"),
  };
}

function detailError(
  values: CampaignDetailFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): CampaignDetailFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function parseNullableDate(value: string | null) {
  return value ? parseDate(value) : null;
}

export async function createProductionCampaignAction(
  _prevState: ProductionCampaignFormState,
  formData: FormData,
): Promise<ProductionCampaignFormState> {
  const values = getCampaignFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return campaignError(values, PERMISSION_ERROR);
  }

  const parsed = productionCampaignSchema.safeParse({
    nombre_campania: formData.get("nombre_campania"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_fin: formData.get("fecha_fin") ?? "",
    objetivo_general: formData.get("objetivo_general") ?? "",
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    return campaignError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const fechaInicio = parseDate(data.fecha_inicio);
  const fechaFin = parseNullableDate(data.fecha_fin);

  let idCampania: string;

  try {
    idCampania = await prisma.$transaction(async (tx) => {
      const idNuevo = await getNextCorrelativeId(tx, {
        codigoEntidad: "campania_produccion",
        prefijo: "CAM",
      });

      await tx.campania_produccion.create({
        data: {
          id_campania: idNuevo,
          nombre_campania: data.nombre_campania,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          objetivo_general: data.objetivo_general,
          estado: data.estado,
          id_usuario_registro: session.user.id,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "campania_produccion",
        id_registro_afectado: idNuevo,
        accion: "crear",
        detalle: `Campania de produccion creada: ${data.nombre_campania}.`,
        tx,
      });

      return idNuevo;
    });
  } catch {
    return campaignError(values, SAVE_ERROR);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath("/dashboard/production/work-orders/new");

  return campaignSaved(values, idCampania);
}

export async function addCampaignDetailAction(
  _prevState: CampaignDetailFormState,
  formData: FormData,
): Promise<CampaignDetailFormState> {
  const values = getCampaignDetailFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return detailError(values, PERMISSION_ERROR);
  }

  const parsed = campaignDetailSchema.safeParse({
    id_campania: formData.get("id_campania"),
    id_producto: formData.get("id_producto"),
    cantidad_objetivo: formData.get("cantidad_objetivo"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    return detailError(values, "Revisa los datos del producto.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  let outcome: DetailProblem | { idCampaniaDetalle: string };

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    outcome = await prisma.$transaction(async (tx): Promise<DetailProblem | { idCampaniaDetalle: string }> => {
      await lockCampaignRow(tx, data.id_campania);

      const [campaign, product, duplicatedDetail] = await Promise.all([
        tx.campania_produccion.findUnique({
          where: {
            id_campania: data.id_campania,
          },
          select: {
            id_campania: true,
            nombre_campania: true,
            estado: true,
          },
        }),
        tx.producto.findFirst({
          where: {
            id_producto: data.id_producto,
            estado: true,
          },
          select: {
            id_producto: true,
            nombre_producto: true,
          },
        }),
        tx.campania_detalle.findFirst({
          where: {
            id_campania: data.id_campania,
            id_producto: data.id_producto,
          },
          select: {
            id_campania_detalle: true,
          },
        }),
      ]);

      if (!campaign) {
        return { error: "La campaña seleccionada no existe." };
      }

      if (CLOSED_CAMPAIGN_STATES.includes(campaign.estado)) {
        return { error: "No se pueden agregar productos a una campaña finalizada o anulada." };
      }

      if (!product) {
        return {
          error: INACTIVE_PRODUCT,
          fieldErrors: { id_producto: [INACTIVE_PRODUCT] },
        };
      }

      if (duplicatedDetail) {
        return duplicatedProduct;
      }

      const idCampaniaDetalle = await getNextCorrelativeId(tx, {
        codigoEntidad: "campania_detalle",
        prefijo: "CPD",
      });

      await tx.campania_detalle.create({
        data: {
          id_campania_detalle: idCampaniaDetalle,
          id_campania: campaign.id_campania,
          id_producto: product.id_producto,
          cantidad_objetivo: data.cantidad_objetivo,
          cantidad_producida: 0,
          observaciones: data.observaciones,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "campania_detalle",
        id_registro_afectado: idCampaniaDetalle,
        accion: "crear",
        detalle: `Producto ${product.nombre_producto} agregado a la campania ${campaign.nombre_campania}.`,
        tx,
      });

      return { idCampaniaDetalle };
    });
  } catch (error) {
    // uq_campania_producto: el bloqueo pone en fila las altas, y esta restriccion
    // sigue siendo la ultima defensa de la regla.
    outcome =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? duplicatedProduct
        : { error: "No se pudo agregar el producto. Intenta nuevamente." };
  }

  if ("error" in outcome) {
    return detailError(values, outcome.error, outcome.fieldErrors);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath(`/dashboard/production/campaigns/${data.id_campania}`);

  return {
    status: "success",
    data: { id_campania_detalle: outcome.idCampaniaDetalle },
    values,
    operationId: newOperationId(),
  };
}

export async function updateProductionCampaignAction(
  _prevState: ProductionCampaignFormState,
  formData: FormData,
): Promise<ProductionCampaignFormState> {
  const values = getCampaignFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return campaignError(values, PERMISSION_ERROR);
  }

  const idCampania = String(formData.get("id_campania") ?? "");

  if (!idCampania) {
    return campaignError(values, "No se recibió la campaña.");
  }

  const parsed = updateProductionCampaignSchema.safeParse({
    nombre_campania: formData.get("nombre_campania"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_fin: formData.get("fecha_fin") ?? "",
    objetivo_general: formData.get("objetivo_general") ?? "",
  });

  if (!parsed.success) {
    return campaignError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  let problem: string | null;

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    problem = await prisma.$transaction(async (tx) => {
      await lockCampaignRow(tx, idCampania);

      const campaign = await tx.campania_produccion.findUnique({
        where: {
          id_campania: idCampania,
        },
        select: {
          id_campania: true,
          estado: true,
        },
      });

      if (!campaign) {
        return "La campaña seleccionada no existe.";
      }

      if (campaign.estado === "anulada") {
        return "No se puede modificar una campaña anulada.";
      }

      await tx.campania_produccion.update({
        where: {
          id_campania: idCampania,
        },
        data: {
          nombre_campania: data.nombre_campania,
          fecha_inicio: parseDate(data.fecha_inicio),
          fecha_fin: parseNullableDate(data.fecha_fin),
          objetivo_general: data.objetivo_general,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "campania_produccion",
        id_registro_afectado: idCampania,
        accion: "actualizar",
        detalle: `Campania actualizada: ${data.nombre_campania}.`,
        tx,
      });

      return null;
    });
  } catch {
    problem = SAVE_ERROR;
  }

  if (problem) {
    return campaignError(values, problem);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath(`/dashboard/production/campaigns/${idCampania}`);

  return campaignSaved(values, idCampania);
}

// Activar, finalizar y anular desde la fila (entrega 10.7a): devuelve el resultado para
// ConfirmActionButton en lugar de redirigir con ?toast=. Un rechazo no revalida: el
// repintado quitaria el boton, y su mensaje con el.
export async function changeProductionCampaignStatusAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const idCampania = String(formData.get("id_campania") ?? "");
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return rowStatusError(idCampania, PERMISSION_ERROR);
  }

  const nextStatus = String(formData.get("estado") ?? "");

  if (!idCampania) {
    return rowStatusError(idCampania, "No se recibió la campaña.");
  }

  if (!["activa", "finalizada", "anulada"].includes(nextStatus)) {
    return rowStatusError(idCampania, "Estado de campaña no válido.");
  }

  let problem: string | null;

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    problem = await prisma.$transaction(async (tx) => {
      await lockCampaignRow(tx, idCampania);

      const campaign = await tx.campania_produccion.findUnique({
        where: {
          id_campania: idCampania,
        },
        select: {
          id_campania: true,
          nombre_campania: true,
          estado: true,
        },
      });

      if (!campaign) {
        return "La campaña seleccionada no existe.";
      }

      // Un doble clic o una lista desactualizada no escriben ni dejan otra bitacora.
      if (campaign.estado === nextStatus) {
        return "La campaña ya estaba en ese estado.";
      }

      if (campaign.estado === "anulada") {
        return "La campaña ya está anulada.";
      }

      if (campaign.estado === "finalizada" && nextStatus !== "anulada") {
        return "Una campaña finalizada solo puede anularse con trazabilidad.";
      }

      await tx.campania_produccion.update({
        where: {
          id_campania: idCampania,
        },
        data: {
          estado: nextStatus,
          fecha_fin:
            nextStatus === "finalizada" || nextStatus === "anulada"
              ? new Date()
              : undefined,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "campania_produccion",
        id_registro_afectado: idCampania,
        accion: nextStatus,
        detalle: `Campania ${nextStatus}: ${campaign.nombre_campania}.`,
        tx,
      });

      return null;
    });
  } catch {
    problem = "No se pudo cambiar el estado de la campaña. Intenta nuevamente.";
  }

  if (problem) {
    return rowStatusError(idCampania, problem);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath(`/dashboard/production/campaigns/${idCampania}`);

  return rowStatusDone(idCampania, nextStatus);
}
