"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import { parseRequestedStatus } from "@/lib/requested-status";
import { lockOperatorRow } from "@/lib/row-locks";
import { operatorSchema } from "@/schemas/staff/operator.schema";

/**
 * Lo que el formulario de operario envio, para volver a mostrarlo. No lleva el
 * estado: el operario nace activo y su estado cambia solo desde la fila (D3).
 */
export type OperatorFormValues = {
  nombres: string;
  apellidos: string;
  cargo: string;
  especialidad: string;
  telefono: string;
  direccion: string;
  modalidad_pago: string;
  tarifa: string;
  fecha_ingreso: string;
  observaciones: string;
};

// Entrega 10.8a: el alta y la edicion se usan desde el panel lateral y devuelven
// el resultado; sin permiso responden con un error, no redirigen.
export type OperatorFormState = FormActionState<OperatorFormValues, { id_operario: string }>;

const OPERATORS_PATH = "/dashboard/staff/operators";
const PERMISSION_ERROR = "No tienes permisos para gestionar operarios.";
const INVALID_DATA = "Revisa los datos del operario.";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

function getOperatorFormValues(formData: FormData): OperatorFormValues {
  const text = (name: keyof OperatorFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombres: text("nombres"),
    apellidos: text("apellidos"),
    cargo: text("cargo"),
    especialidad: text("especialidad"),
    telefono: text("telefono"),
    direccion: text("direccion"),
    modalidad_pago: text("modalidad_pago"),
    tarifa: text("tarifa"),
    fecha_ingreso: text("fecha_ingreso"),
    observaciones: text("observaciones"),
  };
}

function operatorError(
  values: OperatorFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): OperatorFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function operatorSaved(values: OperatorFormValues, idOperario: string): OperatorFormState {
  return { status: "success", data: { id_operario: idOperario }, values, operationId: newOperationId() };
}

/** Un problema que el formulario muestra: mensaje general y, si aplica, el del campo. */
type OperatorProblem = { error: string; fieldErrors?: FieldErrors };

// Recibe el cliente con el que se decide: el de la transaccion en la edicion.
async function hasDuplicateOperator(
  client: Pick<Prisma.TransactionClient, "operario">,
  nombres: string,
  apellidos: string,
  telefono?: string,
  currentOperatorId?: string,
) {
  const operator = await client.operario.findFirst({
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
  const values = getOperatorFormValues(formData);
  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return operatorError(values, PERMISSION_ERROR);
  }

  const parsed = operatorSchema.safeParse(values);

  if (!parsed.success) {
    return operatorError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const duplicated = await hasDuplicateOperator(
    prisma,
    data.nombres,
    data.apellidos,
    data.telefono || undefined,
  );

  if (duplicated) {
    return operatorError(values, "Ya existe un operario registrado con esos datos.", {
      nombres: ["Ya existe un operario registrado con esos datos."],
    });
  }

  let idOperario = "";

  await prisma.$transaction(async (tx) => {
    idOperario = await getNextCorrelativeId(tx, {
      codigoEntidad: "operario",
      prefijo: "OPE",
    });

    await tx.operario.create({
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
        // D3: nace activo; el estado cambia solo desde la fila.
        estado: "activo",
        observaciones: data.observaciones || null,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "operario",
      id_registro_afectado: idOperario,
      accion: "crear",
      detalle: `Operario creado: ${data.nombres} ${data.apellidos}`,
      tx,
    });
  });

  revalidatePath("/dashboard/staff");
  revalidatePath(OPERATORS_PATH);

  return operatorSaved(values, idOperario);
}

export async function updateOperatorAction(
  _prevState: OperatorFormState,
  formData: FormData,
): Promise<OperatorFormState> {
  const values = getOperatorFormValues(formData);
  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return operatorError(values, PERMISSION_ERROR);
  }

  const operatorId = formData.get("id_operario")?.toString().trim();

  if (!operatorId) {
    return operatorError(values, "El operario no existe.");
  }

  const parsed = operatorSchema.safeParse(values);

  if (!parsed.success) {
    return operatorError(values, INVALID_DATA, parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  // Hallazgo 58: la edicion decide con lo guardado (que exista, que no haya otro
  // con esos datos) y escribe. Bloquea la fila antes de leerla y decide, escribe y
  // deja la bitacora en la misma transaccion; un rechazo se devuelve desde ella,
  // antes de escribir nada.
  const problem = await prisma.$transaction(async (tx): Promise<OperatorProblem | null> => {
    await lockOperatorRow(tx, operatorId);

    const currentOperator = await tx.operario.findUnique({
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

    const duplicated = await hasDuplicateOperator(
      tx,
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

    // D3: la edicion no cambia el estado; cambia solo desde la fila.
    await tx.operario.update({
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
        observaciones: data.observaciones || null,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "operario",
      id_registro_afectado: operatorId,
      accion: "actualizar",
      detalle: `Operario actualizado: ${data.nombres} ${data.apellidos}`,
      tx,
    });

    return null;
  });

  if (problem) {
    return operatorError(values, problem.error, problem.fieldErrors);
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(OPERATORS_PATH);

  return operatorSaved(values, operatorId);
}

export async function toggleOperatorStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const operatorId = formData.get("id_operario")?.toString().trim();
  const requestedStatus = parseRequestedStatus(formData.get("estado"));

  if (!operatorId || requestedStatus === null) {
    redirect(OPERATORS_PATH);
  }

  const nextStatus = requestedStatus ? "activo" : "inactivo";

  // Hallazgo 58: fija el estado pedido solo si el operario no lo tiene ya.
  // Comparar y escribir en una sola sentencia evita que una lista desactualizada
  // o un doble clic hagan lo contrario de lo que dice el boton; la misma
  // sentencia devuelve el nombre para la bitacora, que va en la transaccion.
  // Sin filas: no existe o ya tenia ese estado, y no hay nada que registrar.
  const changed = await prisma.$transaction(async (tx) => {
    const [operator] = await tx.operario.updateManyAndReturn({
      where: {
        id_operario: operatorId,
        estado: { not: nextStatus },
      },
      data: {
        estado: nextStatus,
      },
      select: {
        nombres: true,
        apellidos: true,
      },
    });

    if (!operator) {
      return false;
    }

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "operario",
      id_registro_afectado: operatorId,
      accion: nextStatus === "activo" ? "activar" : "inactivar",
      detalle: `Operario ${
        nextStatus === "activo" ? "activado" : "inactivado"
      }: ${operator.nombres} ${operator.apellidos}`,
      tx,
    });

    return true;
  });

  if (!changed) {
    redirect(OPERATORS_PATH);
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(OPERATORS_PATH);

  redirect(
    `${OPERATORS_PATH}?toast=${nextStatus === "activo" ? "operator-activated" : "operator-deactivated"}`,
  );
}
