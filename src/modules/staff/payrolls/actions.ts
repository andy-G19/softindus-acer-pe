"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { formatDate } from "@/lib/formatters";
import { claimOperation, completeOperation, IdempotencyConflictError } from "@/lib/idempotency";
import { toNumber } from "@/lib/numbers";
import { calculatePayrollAmounts } from "@/lib/payroll-amounts";
import { APP_ROLES } from "@/lib/permissions";
import { lockOperatorRow, lockPayrollRow } from "@/lib/row-locks";
import { operationKeySchema } from "@/schemas/operation-key.schema";
import { payrollSchema } from "@/schemas/staff/payroll.schema";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

/** Lo que el formulario de la planilla envio, para volver a mostrarlo. */
export type PayrollFormValues = {
  id_operario: string;
  periodo_inicio: string;
  periodo_fin: string;
  descuentos: string;
};

// C6 de la 11.5 (D59): generar devuelve el resultado y el formulario da el aviso y vuelve al
// listado, como la venta de chatarra (C4 de la 11.4b). Un error queda en el formulario, junto a
// su campo, en lugar de la pagina de error; sin permiso responde con un error. El exito lleva la
// clave confirmada para que el formulario genere otra (OperationKeyField).
export type PayrollFormState = FormActionState<
  PayrollFormValues,
  { id_planilla: string; clave_operacion: string }
>;

const GENERATE_OPERATION = "generar_planilla";

const generateFormSchema = payrollSchema.and(z.object({ clave_operacion: operationKeySchema }));

/**
 * Un rechazo que se decide dentro de la transaccion, despues de reclamar la clave: se lanza para
 * que la transaccion se revierta y libere la clave, y la accion lo convierte en el error de su
 * campo.
 */
class PayrollValidationError extends Error {
  constructor(
    readonly field: keyof PayrollFormValues,
    message: string,
  ) {
    super(message);
  }
}

function getPayrollFormValues(formData: FormData): PayrollFormValues {
  const text = (name: keyof PayrollFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_operario: text("id_operario"),
    periodo_inicio: text("periodo_inicio"),
    periodo_fin: text("periodo_fin"),
    descuentos: text("descuentos"),
  };
}

export async function generatePayrollAction(
  _prevState: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  const values = getPayrollFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): PayrollFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para generar planillas.");
  }

  const parsed = generateFormSchema.safeParse({
    ...values,
    clave_operacion: formData.get("clave_operacion"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // La clave va en un campo oculto: su mensaje es el general, no el de un campo.
    const keyError = fieldErrors.clave_operacion?.[0];

    return fail(keyError ?? "Revisa los datos de la planilla.", fieldErrors);
  }

  const data = parsed.data;

  let idPlanilla: string;

  try {
    idPlanilla = await prisma.$transaction(async (tx) => {
      // C6 de la 11.5: la clave se reclama como primera sentencia, antes del candado y del
      // correlativo. Un reenvio con la misma clave responde con la planilla ya generada sin crear
      // otra; un rechazo posterior lanza y libera la clave.
      const claim = await claimOperation(tx, {
        clave: data.clave_operacion,
        tipo: GENERATE_OPERATION,
        userId: session.user.id,
      });

      if (claim.estado === "repetida") {
        if (!claim.idRegistro) {
          throw new Error("La operacion repetida no tiene una planilla registrada.");
        }

        return claim.idRegistro;
      }

      // C4 de la 11.5 (D54): el operario se bloquea antes de leerlo y todo lo que decide (el
      // operario, el periodo ya generado y las asistencias) se lee dentro de la transaccion. Dos
      // generaciones simultaneas del mismo operario: la segunda espera a la primera y ve su
      // planilla.
      await lockOperatorRow(tx, data.id_operario);

      const operator = await tx.operario.findFirst({
        where: {
          id_operario: data.id_operario,
          estado: "activo",
        },
        select: {
          id_operario: true,
          nombres: true,
          apellidos: true,
          modalidad_pago: true,
          tarifa: true,
        },
      });

      if (!operator) {
        throw new PayrollValidationError("id_operario", "El operario seleccionado no existe o está inactivo.");
      }

      if (toNumber(operator.tarifa) <= 0) {
        throw new PayrollValidationError(
          "id_operario",
          "El operario seleccionado no tiene una tarifa válida para generar planilla.",
        );
      }

      const duplicatedPayroll = await tx.planilla_pago.findFirst({
        where: {
          id_operario: data.id_operario,
          periodo_inicio: data.periodo_inicio,
          periodo_fin: data.periodo_fin,
        },
      });

      if (duplicatedPayroll) {
        throw new PayrollValidationError(
          "periodo_inicio",
          "Este operario ya tiene una planilla generada para el periodo seleccionado.",
        );
      }

      // C5 de la 11.5 (D55): un periodo que se cruza con otra planilla no anulada del operario
      // pagaria dos veces las asistencias comunes. Compartir un solo dia tambien es cruzarse.
      const overlappingPayroll = await tx.planilla_pago.findFirst({
        where: {
          id_operario: data.id_operario,
          estado_pago: { not: "anulada" },
          periodo_inicio: { lte: data.periodo_fin },
          periodo_fin: { gte: data.periodo_inicio },
        },
        orderBy: [{ periodo_inicio: "asc" }, { id_planilla: "asc" }],
        select: {
          id_planilla: true,
          periodo_inicio: true,
          periodo_fin: true,
        },
      });

      if (overlappingPayroll) {
        throw new PayrollValidationError(
          "periodo_inicio",
          `Este operario ya tiene la planilla ${overlappingPayroll.id_planilla}, del ${formatDate(
            overlappingPayroll.periodo_inicio,
            { format: "dd/mm/yyyy" },
          )} al ${formatDate(overlappingPayroll.periodo_fin, {
            format: "dd/mm/yyyy",
          })}, que se cruza con el periodo seleccionado.`,
        );
      }

      const attendanceRecords = await tx.asistencia.findMany({
        where: {
          id_operario: data.id_operario,
          fecha: {
            gte: data.periodo_inicio,
            lte: data.periodo_fin,
          },
        },
        select: {
          id_asistencia: true,
          falta: true,
        },
      });

      const validAttendances = attendanceRecords.filter((attendance) => !attendance.falta);

      if (validAttendances.length === 0) {
        throw new PayrollValidationError(
          "periodo_inicio",
          "No hay asistencias válidas para generar la planilla de este periodo.",
        );
      }

      // C2 de la 11.5 (D53): bruto, descuento y neto en centesimos, con el redondeo de las
      // columnas; el neto es el bruto menos el descuento ya redondeado, asi la planilla cuadra.
      const amounts = calculatePayrollAmounts({
        validAttendances: validAttendances.length,
        rate: operator.tarifa ?? 0,
        discount: data.descuentos,
      });

      if (!amounts.accepted) {
        throw new PayrollValidationError(
          "descuentos",
          "Los descuentos no pueden igualar o superar el monto bruto calculado.",
        );
      }

      const idNuevaPlanilla = await getNextCorrelativeId(tx, {
        codigoEntidad: "planilla_pago",
        prefijo: "PLA",
      });

      await tx.planilla_pago.create({
        data: {
          id_planilla: idNuevaPlanilla,
          id_operario: data.id_operario,
          id_usuario_genera: session.user.id,
          periodo_inicio: data.periodo_inicio,
          periodo_fin: data.periodo_fin,
          modalidad_pago: operator.modalidad_pago,
          monto_bruto: amounts.gross,
          descuentos: amounts.discount,
          monto_neto: amounts.net,
          estado_pago: "pendiente",
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "planilla_pago",
        id_registro_afectado: idNuevaPlanilla,
        accion: "crear",
        detalle: `Planilla generada para el operario ${data.id_operario}.`,
        tx,
      });

      await completeOperation(tx, { clave: data.clave_operacion, idRegistro: idNuevaPlanilla });

      return idNuevaPlanilla;
    });
  } catch (error) {
    if (error instanceof PayrollValidationError) {
      return fail(error.message, { [error.field]: [error.message] });
    }

    if (error instanceof IdempotencyConflictError) {
      return fail(error.message);
    }

    throw error;
  }

  // C6 de la 11.5 (D59): ya no se escribe en el log del servidor el nombre del operario ni sus
  // montos (hallazgo 9); la bitacora registra la planilla.
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");

  return {
    status: "success",
    data: { id_planilla: idPlanilla, clave_operacion: data.clave_operacion },
    values,
    operationId: newOperationId(),
  };
}

export async function cancelPayrollAction(formData: FormData) {
  const session = await requireAdmin();

  const idPlanilla = String(formData.get("id_planilla") ?? "");

  if (!idPlanilla) {
    throw new Error("No se recibió la planilla.");
  }

  // C4 de la 11.5 (D54): la planilla se bloquea antes de leerla y se decide dentro de la
  // transaccion; un pago simultaneo espera a la anulacion, o al reves, y ve el estado final.
  await prisma.$transaction(async (tx) => {
    await lockPayrollRow(tx, idPlanilla);

    const payroll = await tx.planilla_pago.findUnique({
      where: {
        id_planilla: idPlanilla,
      },
      include: {
        _count: {
          select: {
            historial_pago_operario: true,
          },
        },
      },
    });

    if (!payroll) {
      throw new Error("La planilla seleccionada no existe.");
    }

    if (payroll.estado_pago === "pagado") {
      throw new Error("No se puede anular una planilla que ya fue pagada.");
    }

    if (payroll._count.historial_pago_operario > 0) {
      throw new Error(
        "No se puede anular una planilla con historial de pago registrado.",
      );
    }

    if (payroll.estado_pago === "anulada") {
      throw new Error("La planilla ya se encuentra anulada.");
    }

    await tx.planilla_pago.update({
      where: {
        id_planilla: idPlanilla,
      },
      data: {
        estado_pago: "anulada",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "planilla_pago",
      id_registro_afectado: idPlanilla,
      accion: "anular",
      detalle: `Planilla anulada para el operario ${payroll.id_operario}.`,
      tx,
    });
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");

  redirect("/dashboard/staff/payrolls?toast=payroll-annulled");
}
