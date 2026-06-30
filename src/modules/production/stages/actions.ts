"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { routeStageSchema } from "@/schemas/production/route-stage.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}00000001`;
  }

  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export async function createRouteStageAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = routeStageSchema.safeParse({
    id_ruta: formData.get("id_ruta"),
    nombre_etapa: formData.get("nombre_etapa"),
    orden_secuencia: formData.get("orden_secuencia"),
    descripcion: formData.get("descripcion") ?? "",
    tiempo_estimado_horas: formData.get("tiempo_estimado_horas") ?? "",
    requiere_maquina: formData.get("requiere_maquina") === "on",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const route = await prisma.ruta_fabricacion.findFirst({
    where: {
      id_ruta: data.id_ruta,
      estado: true,
    },
    select: {
      id_ruta: true,
      nombre_ruta: true,
    },
  });

  if (!route) {
    throw new Error("La ruta seleccionada no existe o está inactiva.");
  }

  const duplicatedName = await prisma.etapa_ruta.findFirst({
    where: {
      id_ruta: data.id_ruta,
      nombre_etapa: data.nombre_etapa,
    },
  });

  if (duplicatedName) {
    throw new Error("Ya existe una etapa con ese nombre dentro de esta ruta.");
  }

  const duplicatedOrder = await prisma.etapa_ruta.findFirst({
    where: {
      id_ruta: data.id_ruta,
      orden_secuencia: data.orden_secuencia,
    },
  });

  if (duplicatedOrder) {
    throw new Error("Ya existe una etapa con ese número de orden en esta ruta.");
  }

  const lastStage = await prisma.etapa_ruta.findFirst({
    orderBy: {
      id_etapa_ruta: "desc",
    },
    select: {
      id_etapa_ruta: true,
    },
  });

  const idEtapaRuta = buildSequentialId(lastStage?.id_etapa_ruta, "ETA");

  await prisma.etapa_ruta.create({
    data: {
      id_etapa_ruta: idEtapaRuta,
      id_ruta: data.id_ruta,
      nombre_etapa: data.nombre_etapa,
      orden_secuencia: data.orden_secuencia,
      descripcion: data.descripcion,
      tiempo_estimado_horas: data.tiempo_estimado_horas,
      requiere_maquina: data.requiere_maquina,
      estado: true,
    },
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${data.id_ruta}/stages`);

  redirect(`/dashboard/production/routes/${data.id_ruta}/stages`);
}

export async function toggleRouteStageStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idEtapaRuta = String(formData.get("id_etapa_ruta") ?? "");

  if (!idEtapaRuta) {
    throw new Error("No se recibió la etapa de ruta.");
  }

  const stage = await prisma.etapa_ruta.findUnique({
    where: {
      id_etapa_ruta: idEtapaRuta,
    },
    select: {
      id_etapa_ruta: true,
      id_ruta: true,
      estado: true,
    },
  });

  if (!stage) {
    throw new Error("La etapa seleccionada no existe.");
  }

  await prisma.etapa_ruta.update({
    where: {
      id_etapa_ruta: idEtapaRuta,
    },
    data: {
      estado: !stage.estado,
    },
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/routes");
  revalidatePath(`/dashboard/production/routes/${stage.id_ruta}/stages`);

  redirect(`/dashboard/production/routes/${stage.id_ruta}/stages`);
}