"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { calculateProfitability } from "@/lib/costing-calculations";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { lockCostingRow } from "@/lib/row-locks";
import { profitabilitySchema } from "@/schemas/costs/profitability.schema";

/** Lo que el formulario de rentabilidad envio, para volver a mostrarlo. */
export type ProfitabilityFormValues = {
  observaciones: string;
};

// B4 de la 10.8b (D4): la rentabilidad se calcula desde su seccion del detalle y la accion
// devuelve el resultado; sin permiso responde con un error, no redirige.
export type ProfitabilityFormState = FormActionState<ProfitabilityFormValues, { id_rentabilidad: string }>;

const PERMISSION_ERROR = "No tienes permisos para gestionar costeos.";

export async function createProfitabilityAction(
  _prevState: ProfitabilityFormState,
  formData: FormData,
): Promise<ProfitabilityFormState> {
  const values: ProfitabilityFormValues = {
    observaciones: formData.get("observaciones")?.toString() ?? "",
  };
  const fail = (error: string, fieldErrors?: FieldErrors): ProfitabilityFormState => ({
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

  const parsedData = profitabilitySchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    return fail("Revisa los datos de la rentabilidad.", parsedData.error.flatten().fieldErrors);
  }

  const data = parsedData.data;

  const result = await prisma.$transaction(async (tx): Promise<{ problem: string } | { idRentabilidad: string }> => {
    // Hallazgo 64 (10.8): el costeo se bloquea y se lee con su ultimo margen dentro de la
    // transaccion; antes se leia fuera y la rentabilidad podia quedar con un costo viejo.
    // Aplicar un margen toma el mismo bloqueo, asi que el ultimo margen tampoco cambia.
    await lockCostingRow(tx, data.id_costeo);

    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: data.id_costeo,
      },
      include: {
        margen_ganancia: {
          orderBy: {
            fecha_aplicacion: "desc",
          },
          take: 1,
        },
      },
    });

    // Nada se escribio todavia: cada problema se devuelve y la accion responde con el.
    if (!costing) {
      return { problem: "El costeo seleccionado no existe." };
    }

    const latestMargin = costing.margen_ganancia[0];

    if (!latestMargin) {
      return { problem: "Primero debes aplicar un margen de ganancia antes de calcular la rentabilidad." };
    }

    const totalCost = toNumber(costing.costo_total);
    const estimatedIncome = toNumber(
      latestMargin.precio_final ?? latestMargin.precio_sugerido,
    );

    if (totalCost <= 0) {
      return { problem: "No se puede calcular rentabilidad porque el costo total debe ser mayor que cero." };
    }

    if (estimatedIncome <= 0) {
      return { problem: "No se puede calcular rentabilidad porque el ingreso estimado debe ser mayor que cero." };
    }

    const expectedMargin = toNumber(latestMargin.porcentaje_margen);
    const {
      profit: estimatedProfit,
      realMargin,
      lowMarginAlert,
    } = calculateProfitability({
      income: estimatedIncome,
      totalCost,
      expectedMargin,
    });

    const idRentabilidad = await getNextCorrelativeId(tx, {
      codigoEntidad: "rentabilidad",
      prefijo: "REN",
    });

    // Se crea histórico: el modelo permite múltiples cálculos por costeo.
    await tx.rentabilidad.create({
      data: {
        id_rentabilidad: idRentabilidad,
        id_pedido: costing.id_pedido,
        id_costeo: costing.id_costeo,
        ingreso_estimado: estimatedIncome,
        costo_total: totalCost,
        utilidad_estimada: estimatedProfit,
        margen_real: realMargin,
        alerta_bajo_margen: lowMarginAlert,
        observaciones:
          data.observaciones ??
          "Rentabilidad calculada automáticamente usando el último margen aplicado.",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "rentabilidad",
      id_registro_afectado: idRentabilidad,
      accion: "crear",
      detalle: `Rentabilidad calculada para el costeo ${costing.id_costeo}. Utilidad estimada: S/ ${estimatedProfit.toFixed(2)}.`,
      tx,
    });

    return { idRentabilidad };
  });

  if ("problem" in result) {
    return fail(result.problem);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/costs/costings");
  revalidatePath(`/dashboard/costs/costings/${data.id_costeo}`);

  return {
    status: "success",
    data: { id_rentabilidad: result.idRentabilidad },
    values,
    operationId: newOperationId(),
  };
}
