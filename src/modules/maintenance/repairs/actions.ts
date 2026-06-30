"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import {
  repairSchema,
  repairSparePartSchema,
  repairStatusSchema,
} from "@/schemas/maintenance/repair.schema";

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
  if (role !== APP_ROLES.ADMIN) {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

export async function createRepairAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = repairSchema.safeParse({
    id_falla: formData.get("id_falla"),
    fecha_reparacion: formData.get("fecha_reparacion"),
    tecnico_proveedor: formData.get("tecnico_proveedor") ?? "",
    mano_obra: formData.get("mano_obra") ?? "",
    estado_reparacion: formData.get("estado_reparacion"),
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const sparePartInputs = [1, 2, 3].map((index) => {
    const parsedSparePart = repairSparePartSchema.safeParse({
      id_repuesto: formData.get(`id_repuesto_${index}`) ?? "",
      cantidad: formData.get(`cantidad_${index}`) ?? "",
    });

    if (!parsedSparePart.success) {
      const message = parsedSparePart.error.issues
        .map((issue) => issue.message)
        .join(" ");

      throw new Error(message);
    }

    return parsedSparePart.data;
  });

  const selectedSpareParts = sparePartInputs.filter(
    (item) => item.id_repuesto && item.cantidad,
  );

  const selectedSparePartIds = selectedSpareParts.map(
    (item) => item.id_repuesto as string,
  );

  const uniqueSparePartIds = new Set(selectedSparePartIds);

  if (uniqueSparePartIds.size !== selectedSparePartIds.length) {
    throw new Error("No repitas el mismo repuesto en la reparación.");
  }

  const failure = await prisma.falla_maquina.findUnique({
    where: {
      id_falla: data.id_falla,
    },
    include: {
      maquina: true,
    },
  });

  if (!failure) {
    throw new Error("La falla seleccionada no existe.");
  }

  const spareParts =
    selectedSparePartIds.length > 0
      ? await prisma.repuesto.findMany({
          where: {
            id_repuesto: {
              in: selectedSparePartIds,
            },
            estado: true,
          },
        })
      : [];

  if (spareParts.length !== selectedSparePartIds.length) {
    throw new Error(
      "Uno o más repuestos seleccionados no existen o están inactivos.",
    );
  }

  const sparePartMap = new Map(
    spareParts.map((sparePart) => [sparePart.id_repuesto, sparePart]),
  );

  const sparePartDetails = selectedSpareParts.map((item) => {
    const sparePart = sparePartMap.get(item.id_repuesto as string);

    if (!sparePart) {
      throw new Error("No se encontró uno de los repuestos seleccionados.");
    }

    const quantity = item.cantidad ?? 0;
    const unitCost = toNumber(sparePart.costo_unitario);
    const subtotal = quantity * unitCost;

    return {
      id_repuesto: sparePart.id_repuesto,
      cantidad: quantity,
      costo_unitario: unitCost,
      subtotal,
    };
  });

  const laborCost = data.mano_obra ?? 0;

  const sparePartsTotal = sparePartDetails.reduce((total, item) => {
    return total + item.subtotal;
  }, 0);

  const totalCost = laborCost + sparePartsTotal;

  const lastRepair = await prisma.reparacion.findFirst({
    orderBy: {
      id_reparacion: "desc",
    },
    select: {
      id_reparacion: true,
    },
  });

  const lastRepairDetail = await prisma.detalle_repuesto_reparacion.findFirst({
    orderBy: {
      id_detalle_repuesto: "desc",
    },
    select: {
      id_detalle_repuesto: true,
    },
  });

  const idReparacion = buildSequentialId(lastRepair?.id_reparacion, "RPA");

  await prisma.$transaction(async (tx) => {
    await tx.reparacion.create({
      data: {
        id_reparacion: idReparacion,
        id_falla: data.id_falla,
        fecha_reparacion: data.fecha_reparacion,
        tecnico_proveedor: data.tecnico_proveedor || null,
        mano_obra: data.mano_obra,
        costo_total: totalCost,
        estado_reparacion: data.estado_reparacion,
        observaciones: data.observaciones || null,
      },
    });

    let nextDetailId = lastRepairDetail?.id_detalle_repuesto ?? null;

    for (const detail of sparePartDetails) {
      nextDetailId = buildSequentialId(nextDetailId, "DRP");

      await tx.detalle_repuesto_reparacion.create({
        data: {
          id_detalle_repuesto: nextDetailId,
          id_reparacion: idReparacion,
          id_repuesto: detail.id_repuesto,
          cantidad: detail.cantidad,
          costo_unitario: detail.costo_unitario,
          subtotal: detail.subtotal,
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
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/repairs");
  revalidatePath("/dashboard/maintenance/failures");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/repairs");
}

export async function updateRepairStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = repairStatusSchema.safeParse({
    id_reparacion: formData.get("id_reparacion"),
    estado_reparacion: formData.get("estado_reparacion"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const repair = await prisma.reparacion.findUnique({
    where: {
      id_reparacion: data.id_reparacion,
    },
    include: {
      falla_maquina: true,
    },
  });

  if (!repair) {
    throw new Error("La reparación seleccionada no existe.");
  }

  await prisma.$transaction(async (tx) => {
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
  });

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/maintenance/repairs");
  revalidatePath("/dashboard/maintenance/failures");
  revalidatePath("/dashboard/maintenance/machines");

  redirect("/dashboard/maintenance/repairs");
}
