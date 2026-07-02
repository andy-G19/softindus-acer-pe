"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { APP_ROLES } from "@/lib/permissions";
import { operatorSchema } from "@/schemas/staff/operator.schema";

export type OperatorFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const OPERATORS_PATH = "/dashboard/staff/operators";

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

function getOperatorFormData(formData: FormData) {
  return {
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    cargo: formData.get("cargo") ?? "",
    especialidad: formData.get("especialidad") ?? "",
    telefono: formData.get("telefono") ?? "",
    direccion: formData.get("direccion") ?? "",
    modalidad_pago: formData.get("modalidad_pago"),
    tarifa: formData.get("tarifa") ?? "",
    fecha_ingreso: formData.get("fecha_ingreso") ?? "",
    estado: formData.get("estado") ?? "activo",
    observaciones: formData.get("observaciones") ?? "",
  };
}

async function hasDuplicateOperator(
  nombres: string,
  apellidos: string,
  telefono?: string,
  currentOperatorId?: string,
) {
  const operator = await prisma.operario.findFirst({
    where: {
      nombres: {
        equals: nombres,
        mode: "insensitive",
      },
      apellidos: {
        equals: apellidos,
        mode: "insensitive",
      },
      ...(telefono
        ? {
            telefono,
          }
        : {}),
    },
    select: {
      id_operario: true,
    },
  });

  if (!operator) {
    return false;
  }

  return operator.id_operario !== currentOperatorId;
}

export async function createOperatorAction(
  _prevState: OperatorFormState,
  formData: FormData,
): Promise<OperatorFormState> {
  const session = await requireAdmin();
  const parsed = operatorSchema.safeParse(getOperatorFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del operario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateOperator(
    data.nombres,
    data.apellidos,
    data.telefono || undefined,
  );

  if (duplicated) {
    return {
      error: "Ya existe un operario registrado con esos datos.",
      fieldErrors: {
        nombres: ["Ya existe un operario registrado con esos datos."],
      },
    };
  }

  const lastOperator = await prisma.operario.findFirst({
    orderBy: {
      id_operario: "desc",
    },
    select: {
      id_operario: true,
    },
  });

  const idOperario = buildNextId("OPE", lastOperator?.id_operario);

  await prisma.operario.create({
    data: {
      id_operario: idOperario,
      nombres: data.nombres,
      apellidos: data.apellidos,
      cargo: data.cargo || null,
      especialidad: data.especialidad || null,
      telefono: data.telefono || null,
      direccion: data.direccion || null,
      modalidad_pago: data.modalidad_pago,
      tarifa: data.tarifa,
      fecha_ingreso: data.fecha_ingreso,
      estado: data.estado,
      observaciones: data.observaciones || null,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "operario",
    id_registro_afectado: idOperario,
    accion: "crear",
    detalle: `Operario creado: ${data.nombres} ${data.apellidos}`,
  });

  revalidatePath("/dashboard/staff");
  revalidatePath(OPERATORS_PATH);

  redirect(OPERATORS_PATH);
}

export async function updateOperatorAction(
  _prevState: OperatorFormState,
  formData: FormData,
): Promise<OperatorFormState> {
  const session = await requireAdmin();
  const operatorId = formData.get("id_operario")?.toString().trim();

  if (!operatorId) {
    return { error: "El operario no existe." };
  }

  const currentOperator = await prisma.operario.findUnique({
    where: {
      id_operario: operatorId,
    },
    select: {
      id_operario: true,
    },
  });

  if (!currentOperator) {
    return { error: "El operario no existe." };
  }

  const parsed = operatorSchema.safeParse(getOperatorFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del operario.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateOperator(
    data.nombres,
    data.apellidos,
    data.telefono || undefined,
    operatorId,
  );

  if (duplicated) {
    return {
      error: "Ya existe otro operario registrado con esos datos.",
      fieldErrors: {
        nombres: ["Ya existe otro operario registrado con esos datos."],
      },
    };
  }

  await prisma.operario.update({
    where: {
      id_operario: operatorId,
    },
    data: {
      nombres: data.nombres,
      apellidos: data.apellidos,
      cargo: data.cargo || null,
      especialidad: data.especialidad || null,
      telefono: data.telefono || null,
      direccion: data.direccion || null,
      modalidad_pago: data.modalidad_pago,
      tarifa: data.tarifa,
      fecha_ingreso: data.fecha_ingreso,
      estado: data.estado,
      observaciones: data.observaciones || null,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "operario",
    id_registro_afectado: operatorId,
    accion: "actualizar",
    detalle: `Operario actualizado: ${data.nombres} ${data.apellidos}`,
  });

  revalidatePath("/dashboard/staff");
  revalidatePath(OPERATORS_PATH);

  redirect(OPERATORS_PATH);
}

export async function toggleOperatorStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const operatorId = formData.get("id_operario")?.toString().trim();

  if (!operatorId) {
    redirect(OPERATORS_PATH);
  }

  const operator = await prisma.operario.findUnique({
    where: {
      id_operario: operatorId,
    },
    select: {
      nombres: true,
      apellidos: true,
      estado: true,
    },
  });

  if (!operator) {
    redirect(OPERATORS_PATH);
  }

  const nextStatus = operator.estado === "activo" ? "inactivo" : "activo";

  await prisma.operario.update({
    where: {
      id_operario: operatorId,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "operario",
    id_registro_afectado: operatorId,
    accion: nextStatus === "activo" ? "activar" : "inactivar",
    detalle: `Operario ${
      nextStatus === "activo" ? "activado" : "inactivado"
    }: ${operator.nombres} ${operator.apellidos}`,
  });

  revalidatePath("/dashboard/staff");
  revalidatePath(OPERATORS_PATH);

  redirect(OPERATORS_PATH);
}
