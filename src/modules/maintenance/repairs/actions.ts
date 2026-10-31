"use server";

import { revalidatePath } from "next/cache";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { calculateRepairAmounts } from "@/lib/repair-amounts";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockFailureRow, lockRepairRow } from "@/lib/row-locks";
import {
  MAX_REPAIR_AMOUNT,
  repairSchema,
  repairSparePartSchema,
  repairStatusSchema,
} from "@/schemas/maintenance/repair.schema";

/** Una linea de repuesto tal como se envio. */
export type RepairLineValues = {
  id_repuesto: string;
  cantidad: string;
};

/** Lo que el formulario de reparacion envio, tal cual, para volver a mostrarlo. */
export type RepairFormValues = {
  id_falla: string;
  fecha_reparacion: string;
  estado_reparacion: string;
  mano_obra: string;
  tecnico_proveedor: string;
  observaciones: string;
  items: RepairLineValues[];
};

// Entrega 10.5b: el alta de reparaciones no redirige; devuelve el resultado y el
// formulario da el aviso y vuelve al listado. Sin permiso responde con un
// error, no redirige. Los errores de una linea van con la clave
// items.<linea>.<campo> (o items.<linea> si son de la linea entera), con la
// posicion de la linea en el formulario.
export type RepairFormState = FormActionState<RepairFormValues, { id_reparacion: string }>;

type RepairProblem = { error: string; fieldErrors?: FieldErrors };

const REPEATED_SPARE_PART = "No repitas el mismo repuesto en la reparación.";

function getRepairFormValues(formData: FormData): RepairFormValues {
  const text = (name: string) => formData.get(name)?.toString() ?? "";
  const all = (name: string) => formData.getAll(name).map((value) => value.toString());
  const quantities = all("cantidad");

  return {
    id_falla: text("id_falla"),
    fecha_reparacion: text("fecha_reparacion"),
    estado_reparacion: text("estado_reparacion"),
    mano_obra: text("mano_obra"),
    tecnico_proveedor: text("tecnico_proveedor"),
    observaciones: text("observaciones"),
    items: all("id_repuesto").map((id_repuesto, index) => ({
      id_repuesto,
      cantidad: quantities[index] ?? "",
    })),
  };
}

function repairError(values: RepairFormValues, error: string, fieldErrors?: FieldErrors): RepairFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function repairSaved(values: RepairFormValues, idReparacion: string): RepairFormState {
  return { status: "success", data: { id_reparacion: idReparacion }, values, operationId: newOperationId() };
}

function lineKey(line: number, field: string) {
  return `items.${line}.${field}`;
}

// Valida las lineas enviadas: una vacia del todo no cuenta, y cada error lleva
// la clave de su posicion en el formulario, que construye a mano porque flatten
// de Zod no conserva las rutas anidadas. Un repuesto repetido se marca en cada
// linea que lo usa.
function parseRepairLines(items: RepairLineValues[]) {
  const fieldErrors: FieldErrors = {};
  const lines: { line: number; id_repuesto: string; cantidad: number }[] = [];

  items.forEach((item, line) => {
    const parsed = repairSparePartSchema.safeParse(item);

    if (!parsed.success) {
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        fieldErrors[lineKey(line, field)] = messages;
      }

      return;
    }

    if (parsed.data.id_repuesto && parsed.data.cantidad) {
      lines.push({ line, id_repuesto: parsed.data.id_repuesto, cantidad: parsed.data.cantidad });
    }
  });

  const repeated = lines.filter(
    (item) => lines.filter((other) => other.id_repuesto === item.id_repuesto).length > 1,
  );

  for (const item of repeated) {
    fieldErrors[lineKey(item.line, "id_repuesto")] = [REPEATED_SPARE_PART];
  }

  return { lines, fieldErrors, hasRepeated: repeated.length > 0 };
}

export async function createRepairAction(
  _prevState: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const values = getRepairFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return repairError(values, "No tienes permisos para registrar reparaciones.");
  }

  const parsed = repairSchema.safeParse({
    id_falla: formData.get("id_falla"),
    fecha_reparacion: formData.get("fecha_reparacion"),
    tecnico_proveedor: formData.get("tecnico_proveedor") ?? "",
    mano_obra: formData.get("mano_obra") ?? "",
    estado_reparacion: formData.get("estado_reparacion"),
    observaciones: formData.get("observaciones") ?? "",
  });

  const { lines, fieldErrors: lineErrors, hasRepeated } = parseRepairLines(values.items);
  const fieldErrors = { ...(parsed.success ? {} : parsed.error.flatten().fieldErrors), ...lineErrors };

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    const onlyRepeated = hasRepeated && Object.values(lineErrors).every((messages) => messages?.[0] === REPEATED_SPARE_PART);

    return repairError(
      values,
      parsed.success && onlyRepeated ? REPEATED_SPARE_PART : "Revisa los datos de la reparación.",
      fieldErrors,
    );
  }

  const data = parsed.data;
  const selectedSparePartIds = lines.map((item) => item.id_repuesto);
  let idReparacion = "";
  let problem: RepairProblem | null = null;

  try {
    problem = await prisma.$transaction(async (tx): Promise<RepairProblem | null> => {
      await lockFailureRow(tx, data.id_falla);

      const failure = await tx.falla_maquina.findUnique({
        where: {
          id_falla: data.id_falla,
        },
        include: {
          maquina: true,
        },
      });

      if (!failure) {
        const message = "La falla seleccionada no existe.";

        return { error: message, fieldErrors: { id_falla: [message] } };
      }

      if (["reparada", "anulada"].includes(failure.estado_atencion)) {
        const message = "No se puede registrar una reparacion sobre una falla cerrada o anulada.";

        return { error: message, fieldErrors: { id_falla: [message] } };
      }

      const spareParts =
        selectedSparePartIds.length > 0
          ? await tx.repuesto.findMany({
              where: {
                id_repuesto: {
                  in: selectedSparePartIds,
                },
                estado: true,
              },
            })
          : [];

      const sparePartMap = new Map(
        spareParts.map((sparePart) => [sparePart.id_repuesto, sparePart]),
      );

      if (spareParts.length !== selectedSparePartIds.length) {
        const missing = lines.filter((item) => !sparePartMap.has(item.id_repuesto));

        return {
          error: "Uno o más repuestos seleccionados no existen o están inactivos.",
          fieldErrors: Object.fromEntries(
            missing.map((item) => [
              lineKey(item.line, "id_repuesto"),
              ["El repuesto seleccionado no existe o está inactivo."],
            ]),
          ),
        };
      }

      const sparePartDetails = lines.map((item) => {
        const sparePart = sparePartMap.get(item.id_repuesto)!;

        return {
          id_repuesto: sparePart.id_repuesto,
          cantidad: item.cantidad,
          costo_unitario: String(sparePart.costo_unitario),
        };
      });

      const amounts = calculateRepairAmounts({
        mano_obra: data.mano_obra,
        items: sparePartDetails,
      });

      const overflowed = lines.filter((_item, index) => Number(amounts.lines[index].subtotal) > MAX_REPAIR_AMOUNT);

      if (overflowed.length > 0) {
        const message = "El subtotal de un repuesto no debe superar S/ 9,999,999,999.99.";

        return {
          error: message,
          fieldErrors: Object.fromEntries(overflowed.map((item) => [`items.${item.line}`, [message]])),
        };
      }

      if (Number(amounts.total) > MAX_REPAIR_AMOUNT) {
        return { error: "El costo total de la reparación no debe superar S/ 9,999,999,999.99." };
      }

      idReparacion = await getNextCorrelativeId(tx, {
        codigoEntidad: "reparacion",
        prefijo: "RPA",
      });

      await tx.reparacion.create({
        data: {
          id_reparacion: idReparacion,
          id_falla: data.id_falla,
          fecha_reparacion: data.fecha_reparacion,
          tecnico_proveedor: data.tecnico_proveedor || null,
          mano_obra: amounts.mano_obra,
          costo_total: amounts.total,
          estado_reparacion: data.estado_reparacion,
          observaciones: data.observaciones || null,
        },
      });

      const detailIds = await getNextCorrelativeIds(tx, {
        codigoEntidad: "detalle_repuesto_reparacion",
        prefijo: "DRP",
        cantidad: sparePartDetails.length,
      });

      for (const [index, detail] of sparePartDetails.entries()) {
        await tx.detalle_repuesto_reparacion.create({
          data: {
            id_detalle_repuesto: detailIds[index],
            id_reparacion: idReparacion,
            id_repuesto: detail.id_repuesto,
            cantidad: amounts.lines[index].cantidad,
            costo_unitario: amounts.lines[index].costo_unitario,
            subtotal: amounts.lines[index].subtotal,
          },
        });
      }

      if (data.estado_reparacion === "ejecutada") {
        await tx.falla_maquina.update({
          where: {
            id_falla: data.id_falla,
          },
          data: {
            estado_atencion: "reparada",
          },
        });

        await tx.maquina.update({
          where: {
            id_maquina: failure.id_maquina,
          },
          data: {
            estado: "operativa",
          },
        });
      }

      if (
        data.estado_reparacion === "programada" ||
        data.estado_reparacion === "observada"
      ) {
        await tx.falla_maquina.update({
          where: {
            id_falla: data.id_falla,
          },
          data: {
            estado_atencion: "en_atencion",
          },
        });

        await tx.maquina.update({
          where: {
            id_maquina: failure.id_maquina,
          },
          data: {
            estado: "en_reparacion",
          },
        });
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "reparacion",
        id_registro_afectado: idReparacion,
        accion: "crear",
        detalle: `Reparacion registrada para la falla ${data.id_falla}.`,
        tx,
      });

      return null;
    });
  } catch {
    return repairError(values, "No se pudo registrar la reparación. Intenta nuevamente.");
  }

  if (problem) {
    return repairError(values, problem.error, problem.fieldErrors);
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/repairs");
  revalidatePath("/dashboard/maintenance/failures");
  revalidatePath("/dashboard/maintenance/machines");

  return repairSaved(values, idReparacion);
}

export async function updateRepairStatusAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const id = formData.get("id_reparacion")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return rowStatusError(id, "No tienes permisos para cambiar el estado de las reparaciones.");
  }

  const parsed = repairStatusSchema.safeParse({
    id_reparacion: formData.get("id_reparacion"),
    estado_reparacion: formData.get("estado_reparacion"),
  });

  if (!parsed.success) {
    return rowStatusError(id, parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  const data = parsed.data;

  let problem: string | null = null;

  try {
    problem = await prisma.$transaction(async (tx) => {
      await lockRepairRow(tx, data.id_reparacion);

      const repair = await tx.reparacion.findUnique({
        where: {
          id_reparacion: data.id_reparacion,
        },
        include: {
          falla_maquina: true,
        },
      });

      if (!repair) {
        return "La reparación seleccionada no existe.";
      }

      if (["ejecutada", "anulada"].includes(repair.estado_reparacion)) {
        return "No se puede modificar una reparacion finalizada o anulada.";
      }

      if (repair.estado_reparacion === data.estado_reparacion) {
        return "La reparación ya estaba en ese estado.";
      }

      await tx.reparacion.update({
        where: {
          id_reparacion: data.id_reparacion,
        },
        data: {
          estado_reparacion: data.estado_reparacion,
        },
      });

      if (data.estado_reparacion === "ejecutada") {
        await tx.falla_maquina.update({
          where: {
            id_falla: repair.id_falla,
          },
          data: {
            estado_atencion: "reparada",
          },
        });

        await tx.maquina.update({
          where: {
            id_maquina: repair.falla_maquina.id_maquina,
          },
          data: {
            estado: "operativa",
          },
        });
      }

      if (
        data.estado_reparacion === "programada" ||
        data.estado_reparacion === "observada"
      ) {
        await tx.falla_maquina.update({
          where: {
            id_falla: repair.id_falla,
          },
          data: {
            estado_atencion: "en_atencion",
          },
        });

        await tx.maquina.update({
          where: {
            id_maquina: repair.falla_maquina.id_maquina,
          },
          data: {
            estado: "en_reparacion",
          },
        });
      }

      if (data.estado_reparacion === "anulada") {
        await tx.falla_maquina.update({
          where: {
            id_falla: repair.id_falla,
          },
          data: {
            estado_atencion: "pendiente",
          },
        });
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "reparacion",
        id_registro_afectado: data.id_reparacion,
        accion: "actualizar",
        detalle: `Estado de reparacion actualizado de ${repair.estado_reparacion} a ${data.estado_reparacion}.`,
        tx,
      });

      return null;
    });
  } catch {
    return rowStatusError(id, "No se pudo cambiar el estado de la reparación. Intenta nuevamente.");
  }

  if (problem) {
    return rowStatusError(id, problem);
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/repairs");
  revalidatePath("/dashboard/maintenance/failures");
  revalidatePath("/dashboard/maintenance/machines");

  return rowStatusDone(id, data.estado_reparacion);
}
