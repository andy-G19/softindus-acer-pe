"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { APP_ROLES } from "@/lib/permissions";
import {
  sparePartSchema,
  sparePartStatusSchema,
} from "@/schemas/maintenance/spare-part.schema";

export type SparePartFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const SPARE_PARTS_PATH = "/dashboard/maintenance/spare-parts";

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== APP_ROLES.ADMIN) {
    redirect("/dashboard/access-denied");
  }

  return session;
}

function getSparePartFormData(formData: FormData) {
  return {
    id_proveedor: formData.get("id_proveedor") ?? "",
    nombre_repuesto: formData.get("nombre_repuesto"),
    descripcion: formData.get("descripcion") ?? "",
    costo_unitario: formData.get("costo_unitario"),
    estado: formData.get("estado") ?? "true",
  };
}

async function hasDuplicateSparePart(
  name: string,
  currentSparePartId?: string,
) {
  const sparePart = await prisma.repuesto.findFirst({
    where: {
      nombre_repuesto: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id_repuesto: true,
    },
  });

  if (!sparePart) {
    return false;
  }

  return sparePart.id_repuesto !== currentSparePartId;
}

async function validateProvider(providerId: string | undefined) {
  if (!providerId) {
    return true;
  }

  const provider = await prisma.proveedor.findFirst({
    where: {
      id_proveedor: providerId,
      estado: true,
    },
    select: {
      id_proveedor: true,
    },
  });

  return Boolean(provider);
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ya existe un repuesto registrado con ese nombre.";
  }

  return "No se pudo guardar el repuesto. Intenta nuevamente.";
}

export async function createSparePartAction(
  _prevState: SparePartFormState,
  formData: FormData,
): Promise<SparePartFormState> {
  const session = await requireAdmin();
  const parsed = sparePartSchema.safeParse(getSparePartFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del repuesto.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  if (!(await validateProvider(data.id_proveedor))) {
    return {
      error: "El proveedor seleccionado no existe o esta inactivo.",
      fieldErrors: {
        id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."],
      },
    };
  }

  if (await hasDuplicateSparePart(data.nombre_repuesto)) {
    return {
      error: "Ya existe un repuesto registrado con ese nombre.",
      fieldErrors: {
        nombre_repuesto: ["Ya existe un repuesto registrado con ese nombre."],
      },
    };
  }

  const lastSparePart = await prisma.repuesto.findFirst({
    orderBy: {
      id_repuesto: "desc",
    },
    select: {
      id_repuesto: true,
    },
  });

  const idRepuesto = buildNextId("REP", lastSparePart?.id_repuesto);

  try {
    await prisma.repuesto.create({
      data: {
        id_repuesto: idRepuesto,
        id_proveedor: data.id_proveedor || null,
        nombre_repuesto: data.nombre_repuesto,
        descripcion: data.descripcion || null,
        costo_unitario: data.costo_unitario,
        estado: data.estado,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "repuesto",
      id_registro_afectado: idRepuesto,
      accion: "crear",
      detalle: `Repuesto creado: ${data.nombre_repuesto}`,
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(SPARE_PARTS_PATH);

  redirect(SPARE_PARTS_PATH);
}

export async function updateSparePartAction(
  _prevState: SparePartFormState,
  formData: FormData,
): Promise<SparePartFormState> {
  const session = await requireAdmin();
  const sparePartId = formData.get("id_repuesto")?.toString().trim();

  if (!sparePartId) {
    return { error: "El repuesto no existe." };
  }

  const currentSparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: sparePartId,
    },
    select: {
      id_repuesto: true,
    },
  });

  if (!currentSparePart) {
    return { error: "El repuesto no existe." };
  }

  const parsed = sparePartSchema.safeParse(getSparePartFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del repuesto.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  if (!(await validateProvider(data.id_proveedor))) {
    return {
      error: "El proveedor seleccionado no existe o esta inactivo.",
      fieldErrors: {
        id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."],
      },
    };
  }

  if (await hasDuplicateSparePart(data.nombre_repuesto, sparePartId)) {
    return {
      error: "Ya existe otro repuesto registrado con ese nombre.",
      fieldErrors: {
        nombre_repuesto: [
          "Ya existe otro repuesto registrado con ese nombre.",
        ],
      },
    };
  }

  try {
    await prisma.repuesto.update({
      where: {
        id_repuesto: sparePartId,
      },
      data: {
        id_proveedor: data.id_proveedor || null,
        nombre_repuesto: data.nombre_repuesto,
        descripcion: data.descripcion || null,
        costo_unitario: data.costo_unitario,
        estado: data.estado,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "repuesto",
      id_registro_afectado: sparePartId,
      accion: "actualizar",
      detalle: `Repuesto actualizado: ${data.nombre_repuesto}`,
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(SPARE_PARTS_PATH);

  redirect(SPARE_PARTS_PATH);
}

export async function updateSparePartStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = sparePartStatusSchema.safeParse({
    id_repuesto: formData.get("id_repuesto"),
    estado: formData.get("estado"),
  });

  if (!parsed.success) {
    redirect(SPARE_PARTS_PATH);
  }

  const data = parsed.data;
  const sparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: data.id_repuesto,
    },
    select: {
      nombre_repuesto: true,
    },
  });

  if (!sparePart) {
    redirect(SPARE_PARTS_PATH);
  }

  await prisma.repuesto.update({
    where: {
      id_repuesto: data.id_repuesto,
    },
    data: {
      estado: data.estado,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "repuesto",
    id_registro_afectado: data.id_repuesto,
    accion: data.estado ? "activar" : "inactivar",
    detalle: `Repuesto ${data.estado ? "activado" : "inactivado"}: ${
      sparePart.nombre_repuesto
    }`,
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath(SPARE_PARTS_PATH);

  redirect(SPARE_PARTS_PATH);
}

export async function toggleSparePartStatusAction(formData: FormData) {
  await requireAdmin();
  const sparePartId = formData.get("id_repuesto")?.toString().trim();

  if (!sparePartId) {
    redirect(SPARE_PARTS_PATH);
  }

  const sparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: sparePartId,
    },
    select: {
      estado: true,
    },
  });

  const nextStatus = sparePart ? !sparePart.estado : true;
  const nextFormData = new FormData();
  nextFormData.set("id_repuesto", sparePartId);
  nextFormData.set("estado", String(nextStatus));

  await updateSparePartStatusAction(nextFormData);
}
