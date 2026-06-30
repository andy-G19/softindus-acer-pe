"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { payrollSchema } from "@/schemas/staff/payroll.schema";

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

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

export async function generatePayrollAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

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

  const operator = await prisma.operario.findFirst({
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

  const duplicatedPayroll = await prisma.planilla_pago.findFirst({
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

  const attendanceRecords = await prisma.asistencia.findMany({
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

  const grossAmount = validAttendances.length * dailyRate;
  const discounts = data.descuentos;

  if (discounts > grossAmount) {
    throw new Error(
      "Los descuentos no pueden superar el monto bruto calculado.",
    );
  }

  const netAmount = grossAmount - discounts;

  const lastPayroll = await prisma.planilla_pago.findFirst({
    orderBy: {
      id_planilla: "desc",
    },
    select: {
      id_planilla: true,
    },
  });

  const idPlanilla = buildSequentialId(lastPayroll?.id_planilla, "PLA");

  await prisma.planilla_pago.create({
    data: {
      id_planilla: idPlanilla,
      id_operario: data.id_operario,
      id_usuario_genera: session.user.id,
      periodo_inicio: data.periodo_inicio,
      periodo_fin: data.periodo_fin,
      modalidad_pago: operator.modalidad_pago,
      monto_bruto: grossAmount.toFixed(2),
      descuentos: discounts.toFixed(2),
      monto_neto: netAmount.toFixed(2),
      estado_pago: "pendiente",
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "planilla_pago",
    id_registro_afectado: idPlanilla,
    accion: "crear",
    detalle: `Planilla generada para el operario ${data.id_operario}.`,
  });

  console.log("Planilla generada", {
    idPlanilla,
    operario: `${operator.apellidos}, ${operator.nombres}`,
    asistenciasValidas: validAttendances.length,
    faltas: absences.length,
    tardanzas: lateness.length,
    horasTrabajadas: workedHours,
    montoBruto: grossAmount,
    descuentos: discounts,
    montoNeto: netAmount,
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");

  redirect("/dashboard/staff/payrolls");
}

export async function cancelPayrollAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const idPlanilla = String(formData.get("id_planilla") ?? "");

  if (!idPlanilla) {
    throw new Error("No se recibió la planilla.");
  }

  const payroll = await prisma.planilla_pago.findUnique({
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

  await prisma.planilla_pago.update({
    where: {
      id_planilla: idPlanilla,
    },
    data: {
      estado_pago: "anulada",
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/staff/payrolls");

  redirect("/dashboard/staff/payrolls");
}
