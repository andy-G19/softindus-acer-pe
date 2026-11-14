"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import { calculatePayrollAmounts } from "@/lib/payroll-amounts";
import { lockOperatorRow, lockPayrollRow } from "@/lib/row-locks";
import { payrollSchema } from "@/schemas/staff/payroll.schema";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

export async function generatePayrollAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = payrollSchema.safeParse({
    id_operario: formData.get("id_operario"),
    periodo_inicio: formData.get("periodo_inicio"),
    periodo_fin: formData.get("periodo_fin"),
    descuentos: formData.get("descuentos") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  // C4 de la 11.5 (D54): el operario se bloquea antes de leerlo y todo lo que decide (el operario,
  // el periodo ya generado y las asistencias) se lee dentro de la transaccion. Dos generaciones
  // simultaneas del mismo operario: la segunda espera a la primera y ve su planilla. Un rechazo se
  // lanza dentro y la transaccion se revierte sin escribir.
  const { idPlanilla, operator, validAttendances, absences, lateness, workedHours, amounts } =
    await prisma.$transaction(async (tx) => {
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
        throw new Error("El operario seleccionado no existe o está inactivo.");
      }

      const dailyRate = toNumber(operator.tarifa);

      if (dailyRate <= 0) {
        throw new Error(
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
        throw new Error(
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
        throw new Error(
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
          tardanza: true,
          horas_trabajadas: true,
        },
      });

      const validAttendances = attendanceRecords.filter(
        (attendance) => !attendance.falta,
      );

      const absences = attendanceRecords.filter(
        (attendance) => attendance.falta,
      );

      const lateness = attendanceRecords.filter(
        (attendance) => attendance.tardanza && !attendance.falta,
      );

      const workedHours = validAttendances.reduce((total, attendance) => {
        return total + toNumber(attendance.horas_trabajadas);
      }, 0);

      if (validAttendances.length === 0) {
        throw new Error(
          "No hay asistencias válidas para generar la planilla de este periodo.",
        );
      }

      // C2 de la 11.5 (D53): bruto, descuento y neto en centesimos, con el redondeo de las columnas;
      // el neto es el bruto menos el descuento ya redondeado, asi la planilla cuadra.
      const amounts = calculatePayrollAmounts({
        validAttendances: validAttendances.length,
        rate: operator.tarifa ?? 0,
        discount: data.descuentos,
      });

      if (!amounts.accepted) {
        throw new Error(
          "Los descuentos no pueden igualar o superar el monto bruto calculado.",
        );
      }

      const idPlanilla = await getNextCorrelativeId(tx, {
        codigoEntidad: "planilla_pago",
        prefijo: "PLA",
      });

      await tx.planilla_pago.create({
        data: {
          id_planilla: idPlanilla,
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
        id_registro_afectado: idPlanilla,
        accion: "crear",
        detalle: `Planilla generada para el operario ${data.id_operario}.`,
        tx,
      });

      return { idPlanilla, operator, validAttendances, absences, lateness, workedHours, amounts };
    });

  console.log("Planilla generada", {
    idPlanilla,
    operario: `${operator.apellidos}, ${operator.nombres}`,
    asistenciasValidas: validAttendances.length,
    faltas: absences.length,
    tardanzas: lateness.length,
    horasTrabajadas: workedHours,
    montoBruto: toNumber(amounts.gross),
    descuentos: toNumber(amounts.discount),
    montoNeto: toNumber(amounts.net),
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");

  redirect("/dashboard/staff/payrolls?toast=payroll-created");
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
