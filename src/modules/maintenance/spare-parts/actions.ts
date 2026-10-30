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
import {
  sparePartSchema,
  sparePartStatusSchema,
} from "@/schemas/maintenance/spare-part.schema";

/** Lo que el formulario de repuesto envio, tal cual, para volver a mostrarlo. */
export type SparePartFormValues = {
  id_proveedor: string;
  nombre_repuesto: string;
  descripcion: string;
  costo_unitario: string;
  estado: string;
};

// Entrega 10.5a: el alta y la edicion de repuestos no redirigen; devuelven el
// resultado y el formulario da el aviso y cierra el panel o vuelve al listado.
// Sin permiso responden con un error, no redirigen.
export type SparePartFormState = FormActionState<SparePartFormValues, { id_repuesto: string }>;

const SPARE_PARTS_PATH = "/dashboard/maintenance/spare-parts";

// El cambio de estado desde la lista sigue redirigiendo hasta que pase a
// ConfirmActionButton (A7 de la 10.5a).
async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

function getSparePartFormValues(formData: FormData): SparePartFormValues {
  const text = (name: keyof SparePartFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_proveedor: text("id_proveedor"),
    nombre_repuesto: text("nombre_repuesto"),
    descripcion: text("descripcion"),
    costo_unitario: text("costo_unitario"),
    estado: text("estado"),
  };
}

function sparePartError(values: SparePartFormValues, error: string, fieldErrors?: FieldErrors): SparePartFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function sparePartSaved(values: SparePartFormValues, idRepuesto: string): SparePartFormState {
  return { status: "success", data: { id_repuesto: idRepuesto }, values, operationId: newOperationId() };
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

// Un proveedor nuevo debe existir y estar activo. Al editar, el proveedor
// actual del repuesto se acepta aunque este inactivo mientras no se cambie: la
// edicion lo ofrece (D2 de la 10.5a, hallazgo 4 de la 10.3a).
async function validateProvider(
  providerId: string | undefined,
  currentProviderId?: string | null,
) {
  if (!providerId) {
    return true;
  }

  const provider = await prisma.proveedor.findUnique({
    where: {
      id_proveedor: providerId,
    },
    select: {
      estado: true,
    },
  });

  return Boolean(
    provider && (provider.estado || providerId === currentProviderId),
  );
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
  const values = getSparePartFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return sparePartError(values, "No tienes permisos para registrar repuestos.");
  }

  const parsed = sparePartSchema.safeParse(getSparePartFormData(formData));

  if (!parsed.success) {
    return sparePartError(values, "Revisa los datos del repuesto.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  if (!(await validateProvider(data.id_proveedor))) {
    return sparePartError(values, "El proveedor seleccionado no existe o esta inactivo.", {
      id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."],
    });
  }

  if (await hasDuplicateSparePart(data.nombre_repuesto)) {
    return sparePartError(values, "Ya existe un repuesto registrado con ese nombre.", {
      nombre_repuesto: ["Ya existe un repuesto registrado con ese nombre."],
    });
  }

  let idRepuesto = "";

  try {
    await prisma.$transaction(async (tx) => {
      idRepuesto = await getNextCorrelativeId(tx, {
        codigoEntidad: "repuesto",
        prefijo: "REP",
      });

      await tx.repuesto.create({
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
        tx,
      });
    });
  } catch (error) {
    return sparePartError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(SPARE_PARTS_PATH);

  return sparePartSaved(values, idRepuesto);
}

export async function updateSparePartAction(
  _prevState: SparePartFormState,
  formData: FormData,
): Promise<SparePartFormState> {
  const values = getSparePartFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return sparePartError(values, "No tienes permisos para editar repuestos.");
  }

  const sparePartId = formData.get("id_repuesto")?.toString().trim();

  if (!sparePartId) {
    return sparePartError(values, "El repuesto no existe.");
  }

  const currentSparePart = await prisma.repuesto.findUnique({
    where: {
      id_repuesto: sparePartId,
    },
    select: {
      id_repuesto: true,
      id_proveedor: true,
    },
  });

  if (!currentSparePart) {
    return sparePartError(values, "El repuesto no existe.");
  }

  const parsed = sparePartSchema.safeParse(getSparePartFormData(formData));

  if (!parsed.success) {
    return sparePartError(values, "Revisa los datos del repuesto.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  if (
    !(await validateProvider(data.id_proveedor, currentSparePart.id_proveedor))
  ) {
    return sparePartError(values, "El proveedor seleccionado no existe o esta inactivo.", {
      id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."],
    });
  }

  if (await hasDuplicateSparePart(data.nombre_repuesto, sparePartId)) {
    return sparePartError(values, "Ya existe otro repuesto registrado con ese nombre.", {
      nombre_repuesto: ["Ya existe otro repuesto registrado con ese nombre."],
    });
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
    return sparePartError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath(SPARE_PARTS_PATH);

  return sparePartSaved(values, sparePartId);
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

  redirect(
    `${SPARE_PARTS_PATH}?toast=${data.estado ? "spare-part-activated" : "spare-part-deactivated"}`,
  );
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
