"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import {
  campaignDetailSchema,
  productionCampaignSchema,
} from "@/schemas/production/campaign.schema";

const CLOSED_CAMPAIGN_STATES = ["finalizada", "anulada"];

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function parseNullableDate(value: string | null) {
  return value ? parseDate(value) : null;
}

export async function createProductionCampaignAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = productionCampaignSchema.safeParse({
    nombre_campania: formData.get("nombre_campania"),
    fecha_inicio: formData.get("fecha_inicio"),
    fecha_fin: formData.get("fecha_fin") ?? "",
    objetivo_general: formData.get("objetivo_general") ?? "",
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos.");
  }

  const data = parsed.data;
  const fechaInicio = parseDate(data.fecha_inicio);
  const fechaFin = parseNullableDate(data.fecha_fin);

  const lastCampaign = await prisma.campania_produccion.findFirst({
    orderBy: {
      id_campania: "desc",
    },
    select: {
      id_campania: true,
    },
  });

  const idCampania = buildNextId("CAM", lastCampaign?.id_campania);

  await prisma.$transaction(async (tx) => {
    await tx.campania_produccion.create({
      data: {
        id_campania: idCampania,
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
      id_registro_afectado: idCampania,
      accion: "crear",
      detalle: `Campania de produccion creada: ${data.nombre_campania}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath("/dashboard/production/work-orders/new");

  redirect(`/dashboard/production/campaigns/${idCampania}`);
}

export async function addCampaignDetailAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

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

  const [campaign, product, duplicatedDetail, lastDetail] = await Promise.all([
    prisma.campania_produccion.findUnique({
      where: {
        id_campania: data.id_campania,
      },
      select: {
        id_campania: true,
        nombre_campania: true,
        estado: true,
      },
    }),
    prisma.producto.findFirst({
      where: {
        id_producto: data.id_producto,
        estado: true,
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
    prisma.campania_detalle.findFirst({
      where: {
        id_campania: data.id_campania,
        id_producto: data.id_producto,
      },
      select: {
        id_campania_detalle: true,
      },
    }),
    prisma.campania_detalle.findFirst({
      orderBy: {
        id_campania_detalle: "desc",
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
    throw new Error("Ese producto ya esta registrado en la campania.");
  }

  const idCampaniaDetalle = buildNextId(
    "CPD",
    lastDetail?.id_campania_detalle,
  );

  await prisma.$transaction(async (tx) => {
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/campaigns");
  revalidatePath(`/dashboard/production/campaigns/${campaign.id_campania}`);

  redirect(`/dashboard/production/campaigns/${campaign.id_campania}`);
}
