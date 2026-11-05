"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { recalculateCostingTotals } from "@/lib/costing";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import { lockCostingRow, lockIndirectCostRow } from "@/lib/row-locks";
import { indirectCostSchema } from "@/schemas/costs/indirect-cost.schema";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

function normalizeText(value: FormDataEntryValue | null) {
  if (!value) {
    return "";
  }

  return String(value).trim();
}

function revalidateCostingPaths(idCosteo?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/costs/costings");

  if (idCosteo) {
    revalidatePath(`/dashboard/costs/costings/${idCosteo}`);
  }
}

/** Lo que el formulario de costo indirecto envio, para volver a mostrarlo. */
export type IndirectCostFormValues = {
  concepto: string;
  categoria: string;
  monto: string;
  criterio_prorrateo: string;
  periodo: string;
  observaciones: string;
};

// B4 de la 10.8b (D4): el costo indirecto se registra desde su seccion del detalle y la
// accion devuelve el resultado; sin permiso responde con un error, no redirige.
export type IndirectCostFormState = FormActionState<IndirectCostFormValues, { id_costo_indirecto: string }>;

const PERMISSION_ERROR = "No tienes permisos para gestionar costeos.";

function getIndirectCostFormValues(formData: FormData): IndirectCostFormValues {
  const text = (name: keyof IndirectCostFormValues) => formData.get(name)?.toString() ?? "";

  return {
    concepto: text("concepto"),
    categoria: text("categoria"),
    monto: text("monto"),
    criterio_prorrateo: text("criterio_prorrateo"),
    periodo: text("periodo"),
    observaciones: text("observaciones"),
  };
}

export async function createIndirectCostAction(
  _prevState: IndirectCostFormState,
  formData: FormData,
): Promise<IndirectCostFormState> {
  const values = getIndirectCostFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): IndirectCostFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail(PERMISSION_ERROR);
  }

  const parsedData = indirectCostSchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    concepto: formData.get("concepto"),
    categoria: formData.get("categoria"),
    monto: formData.get("monto"),
    criterio_prorrateo: formData.get("criterio_prorrateo"),
    periodo: formData.get("periodo"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    return fail("Revisa los datos del costo indirecto.", parsedData.error.flatten().fieldErrors);
  }

  const data = parsedData.data;

  const result = await prisma.$transaction(async (tx): Promise<{ problem: string } | { idCostoIndirecto: string }> => {
    // Hallazgo 65 (10.8): el costeo, el padre, se bloquea antes de comprobarlo y de tomar
    // el correlativo; antes solo lo bloqueaba el recalculo, despues de crear el indirecto.
    await lockCostingRow(tx, data.id_costeo);

    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: data.id_costeo,
      },
      select: {
        id_costeo: true,
      },
    });

    // Nada se escribio todavia: el problema se devuelve y la accion responde con el.
    if (!costing) {
      return { problem: "El costeo seleccionado no existe." };
    }

    const idCostoIndirecto = await getNextCorrelativeId(tx, {
      codigoEntidad: "costo_indirecto",
      prefijo: "CIN",
    });

    await tx.costo_indirecto.create({
      data: {
        id_costo_indirecto: idCostoIndirecto,
        id_costeo: data.id_costeo,
        concepto: data.concepto,
        categoria: data.categoria,
        monto: data.monto,
        criterio_prorrateo: data.criterio_prorrateo,
        periodo: data.periodo,
        observaciones: data.observaciones,
      },
    });

    await recalculateCostingTotals(tx, data.id_costeo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "costo_indirecto",
      id_registro_afectado: idCostoIndirecto,
      accion: "crear",
      detalle: `Costo indirecto agregado al costeo ${data.id_costeo}: ${data.concepto}.`,
      tx,
    });

    return { idCostoIndirecto };
  });

  if ("problem" in result) {
    return fail(result.problem);
  }

  revalidateCostingPaths(data.id_costeo);

  return {
    status: "success",
    data: { id_costo_indirecto: result.idCostoIndirecto },
    values,
    operationId: newOperationId(),
  };
}

export async function annulIndirectCostAction(formData: FormData) {
  const session = await requireAdmin();

  const idCostoIndirecto = normalizeText(formData.get("id_costo_indirecto"));

  if (!idCostoIndirecto) {
    throw new Error("Debe seleccionar un costo indirecto válido.");
  }

  let idCosteo = "";

  await prisma.$transaction(async (tx) => {
    // H10: se bloquea el costo indirecto antes de leerlo. Dos anulaciones simultaneas
    // pasaban las dos la comprobacion de [ANULADO] y la bitacora registraba dos; ahora la
    // segunda espera y lo encuentra anulado. Despues, el recalculo bloquea el costeo.
    await lockIndirectCostRow(tx, idCostoIndirecto);

    const indirectCost = await tx.costo_indirecto.findUnique({
      where: {
        id_costo_indirecto: idCostoIndirecto,
      },
      select: {
        id_costo_indirecto: true,
        id_costeo: true,
        concepto: true,
        monto: true,
        observaciones: true,
      },
    });

    if (!indirectCost) {
      throw new Error("El costo indirecto seleccionado no existe.");
    }

    if (!indirectCost.id_costeo) {
      throw new Error("El costo indirecto no está asociado a un costeo.");
    }

    if (indirectCost.observaciones?.includes("[ANULADO]")) {
      throw new Error("El costo indirecto ya se encuentra anulado.");
    }

    idCosteo = indirectCost.id_costeo;

    await tx.costo_indirecto.update({
      where: {
        id_costo_indirecto: idCostoIndirecto,
      },
      data: {
        monto: 0,
        observaciones: [
          indirectCost.observaciones,
          `[ANULADO] ${new Date().toISOString()} - Monto original: S/ ${Number(
            indirectCost.monto.toString(),
          ).toFixed(2)}.`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    await recalculateCostingTotals(tx, idCosteo);

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "costo_indirecto",
      id_registro_afectado: idCostoIndirecto,
      accion: "anular",
      detalle: `Costo indirecto anulado del costeo ${idCosteo}: ${indirectCost.concepto}.`,
      tx,
    });
  });

  revalidateCostingPaths(idCosteo);

  redirect(`/dashboard/costs/costings/${idCosteo}?toast=indirect-cost-annulled`);
}
