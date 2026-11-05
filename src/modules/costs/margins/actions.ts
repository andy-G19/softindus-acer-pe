"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { calculateSuggestedPrice } from "@/lib/costing-calculations";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { lockCostingRow } from "@/lib/row-locks";
import { marginSchema } from "@/schemas/costs/margin.schema";

/** Lo que el formulario de margen envio, para volver a mostrarlo. */
export type MarginFormValues = {
  porcentaje_margen: string;
  precio_final: string;
  motivo_ajuste: string;
};

// B4 de la 10.8b (D4): el margen se aplica desde su seccion del detalle y la accion
// devuelve el resultado; sin permiso responde con un error, no redirige.
export type MarginFormState = FormActionState<MarginFormValues, { id_margen: string }>;

const PERMISSION_ERROR = "No tienes permisos para gestionar costeos.";
const FINAL_PRICE_BELOW_COST = "El precio final no puede ser menor que el costo total del producto.";

/** Un problema que el formulario muestra: mensaje general y, si aplica, el del campo. */
type MarginProblem = { error: string; fieldErrors?: FieldErrors };

export async function createMarginAction(
  _prevState: MarginFormState,
  formData: FormData,
): Promise<MarginFormState> {
  const text = (name: keyof MarginFormValues) => formData.get(name)?.toString() ?? "";
  const values: MarginFormValues = {
    porcentaje_margen: text("porcentaje_margen"),
    precio_final: text("precio_final"),
    motivo_ajuste: text("motivo_ajuste"),
  };
  const fail = ({ error, fieldErrors }: MarginProblem): MarginFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail({ error: PERMISSION_ERROR });
  }

  const parsedData = marginSchema.safeParse({
    id_costeo: formData.get("id_costeo"),
    porcentaje_margen: formData.get("porcentaje_margen"),
    precio_final: formData.get("precio_final"),
    motivo_ajuste: formData.get("motivo_ajuste"),
  });

  if (!parsedData.success) {
    return fail({ error: "Revisa los datos del margen.", fieldErrors: parsedData.error.flatten().fieldErrors });
  }

  const data = parsedData.data;

  const result = await prisma.$transaction(async (tx): Promise<{ problem: MarginProblem } | { idMargen: string }> => {
    // Hallazgo 64 (10.8): el costeo se bloquea y se lee dentro de la transaccion, antes de
    // decidir con su costo total; antes se leia fuera y un recalculo a la vez dejaba el
    // margen calculado con un costo viejo.
    await lockCostingRow(tx, data.id_costeo);

    const costing = await tx.costeo.findUnique({
      where: {
        id_costeo: data.id_costeo,
      },
      select: {
        id_costeo: true,
        costo_total: true,
      },
    });

    // Nada se escribio todavia: cada problema se devuelve y la accion responde con el.
    if (!costing) {
      return { problem: { error: "El costeo seleccionado no existe." } };
    }

    const totalCost = toNumber(costing.costo_total);

    if (totalCost <= 0) {
      return {
        problem: { error: "No se puede aplicar margen porque el costo total debe ser mayor que cero." },
      };
    }

    const suggestedPrice = calculateSuggestedPrice(totalCost, data.porcentaje_margen);
    const finalPrice = data.precio_final ?? suggestedPrice;

    if (finalPrice < totalCost) {
      return {
        problem: { error: FINAL_PRICE_BELOW_COST, fieldErrors: { precio_final: [FINAL_PRICE_BELOW_COST] } },
      };
    }

    const idMargen = await getNextCorrelativeId(tx, {
      codigoEntidad: "margen_ganancia",
      prefijo: "MGN",
    });

    await tx.margen_ganancia.create({
      data: {
        id_margen: idMargen,
        id_costeo: data.id_costeo,
        id_usuario_aplica: session.user.id,
        porcentaje_margen: data.porcentaje_margen,
        precio_sugerido: suggestedPrice,
        precio_final: finalPrice,
        motivo_ajuste: data.motivo_ajuste,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "margen_ganancia",
      id_registro_afectado: idMargen,
      accion: "crear",
      detalle: `Margen aplicado al costeo ${data.id_costeo}.`,
      tx,
    });

    return { idMargen };
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
    data: { id_margen: result.idMargen },
    values,
    operationId: newOperationId(),
  };
}
