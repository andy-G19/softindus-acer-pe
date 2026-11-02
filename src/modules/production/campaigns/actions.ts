"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { lockCampaignRow } from "@/lib/row-locks";
import {
  campaignDetailSchema,
  productionCampaignSchema,
  updateProductionCampaignSchema,
} from "@/schemas/production/campaign.schema";

const CLOSED_CAMPAIGN_STATES = ["finalizada", "anulada"];
const DUPLICATED_DETAIL = "Ese producto ya esta registrado en la campania.";
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

export async function addCampaignDetailAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = campaignDetailSchema.safeParse({
    id_campania: formData.get("id_campania"),
    id_producto: formData.get("id_producto"),
    cantidad_objetivo: formData.get("cantidad_objetivo"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
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
        throw new Error("La campania seleccionada no existe.");
      }

      if (CLOSED_CAMPAIGN_STATES.includes(campaign.estado)) {
        throw new Error("No se pueden agregar productos a una campania finalizada o anulada.");
      }

      if (!product) {
        throw new Error("El producto seleccionado no existe o esta inactivo.");
      }

      if (duplicatedDetail) {
        throw new Error(DUPLICATED_DETAIL);
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
    });
  } catch (error) {
    // uq_campania_producto: el bloqueo pone en fila las altas, y esta restriccion
    // sigue siendo la ultima defensa de la regla.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(DUPLICATED_DETAIL);
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath(`/dashboard/production/campaigns/${data.id_campania}`);

  redirect(
    `/dashboard/production/campaigns/${data.id_campania}?toast=campaign-detail-created`,
  );
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

export async function changeProductionCampaignStatusAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idCampania = String(formData.get("id_campania") ?? "");
  const nextStatus = String(formData.get("estado") ?? "");

  if (!idCampania) {
    throw new Error("No se recibio la campania.");
  }

  if (!["activa", "finalizada", "anulada"].includes(nextStatus)) {
    throw new Error("Estado de campania invalido.");
  }

  await prisma.$transaction(async (tx) => {
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
      throw new Error("La campania seleccionada no existe.");
    }

    // Un doble clic o una lista desactualizada no escriben ni dejan otra bitacora.
    if (campaign.estado === nextStatus) {
      throw new Error("La campania ya estaba en ese estado.");
    }

    if (campaign.estado === "anulada") {
      throw new Error("La campania ya esta anulada.");
    }

    if (campaign.estado === "finalizada" && nextStatus !== "anulada") {
      throw new Error("Una campania finalizada solo puede anularse con trazabilidad.");
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
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath(`/dashboard/production/campaigns/${idCampania}`);

  redirect(`/dashboard/production/campaigns?toast=campaign-status-${nextStatus}`);
}
