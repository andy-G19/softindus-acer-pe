"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { scrapSaleSchema } from "@/schemas/waste-scrap/scrap-sale.schema";

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

export async function createScrapSaleAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = scrapSaleSchema.safeParse({
    id_chatarra: formData.get("id_chatarra"),
    id_caja_chica: formData.get("id_caja_chica"),
    fecha_venta: formData.get("fecha_venta"),
    cantidad_vendida: formData.get("cantidad_vendida"),
    peso_vendido_kg: formData.get("peso_vendido_kg"),
    monto_recibido: formData.get("monto_recibido"),
    destino_dinero: formData.get("destino_dinero"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  const scrap = await prisma.chatarra.findUnique({
    where: {
      id_chatarra: data.id_chatarra,
    },
    include: {
      venta_chatarra: true,
    },
  });

  if (!scrap) {
    throw new Error("El registro de chatarra seleccionado no existe.");
  }

  if (scrap.estado === "vendida") {
    throw new Error("Esta chatarra ya fue vendida.");
  }

  if (scrap.venta_chatarra.length > 0) {
    throw new Error("Esta chatarra ya tiene una venta registrada.");
  }

  const pesoDisponible = toNumber(scrap.peso_kg);
  const cantidadDisponible = toNumber(scrap.cantidad);

  const pesoVendido = data.peso_vendido_kg ?? scrap.peso_kg;
  const cantidadVendida = data.cantidad_vendida ?? scrap.cantidad;

  if (!pesoVendido && !cantidadVendida) {
    throw new Error(
      "Debe registrar peso vendido, cantidad vendida o tener esos datos en la chatarra seleccionada.",
    );
  }

  if (data.peso_vendido_kg && pesoDisponible > 0) {
    if (data.peso_vendido_kg > pesoDisponible) {
      throw new Error("El peso vendido no puede superar el peso registrado.");
    }
  }

  if (data.cantidad_vendida && cantidadDisponible > 0) {
    if (data.cantidad_vendida > cantidadDisponible) {
      throw new Error(
        "La cantidad vendida no puede superar la cantidad registrada.",
      );
    }
  }

  let selectedCashBox: { id_caja_chica: string; estado: string } | null = null;

  if (data.id_caja_chica) {
    selectedCashBox = await prisma.caja_chica.findUnique({
      where: {
        id_caja_chica: data.id_caja_chica,
      },
      select: {
        id_caja_chica: true,
        estado: true,
      },
    });

    if (!selectedCashBox) {
      throw new Error("La caja chica seleccionada no existe.");
    }

    if (selectedCashBox.estado !== "abierta") {
      throw new Error("Solo se puede registrar el ingreso en una caja abierta.");
    }
  }

  const [lastSale, lastCashMovement] = await Promise.all([
    prisma.venta_chatarra.findFirst({
      orderBy: {
        id_venta_chatarra: "desc",
      },
      select: {
        id_venta_chatarra: true,
      },
    }),

    prisma.movimiento_caja.findFirst({
      orderBy: {
        id_movimiento_caja: "desc",
      },
      select: {
        id_movimiento_caja: true,
      },
    }),
  ]);

  const idVentaChatarra = buildSequentialId(
    lastSale?.id_venta_chatarra,
    "VCH",
  );

  const idMovimientoCaja = data.id_caja_chica
    ? buildSequentialId(lastCashMovement?.id_movimiento_caja, "MCA")
    : null;

  const fechaVenta = new Date(`${data.fecha_venta}T00:00:00`);

  await prisma.$transaction(async (tx) => {
    if (data.id_caja_chica && idMovimientoCaja) {
      await tx.movimiento_caja.create({
        data: {
          id_movimiento_caja: idMovimientoCaja,
          id_caja_chica: data.id_caja_chica,
          id_usuario_registro: session.user.id,
          tipo_movimiento: "ingreso",
          concepto: `Venta de chatarra ${scrap.id_chatarra}`,
          monto: data.monto_recibido,
          fecha_movimiento: fechaVenta,
          responsable: session.user.name ?? "Administrador",
          observaciones:
            data.destino_dinero ??
            "Ingreso generado por venta de chatarra.",
        },
      });

      await tx.caja_chica.update({
        where: {
          id_caja_chica: data.id_caja_chica,
        },
        data: {
          saldo_actual: {
            increment: data.monto_recibido,
          },
        },
      });
    }

    if (idMovimientoCaja) {
      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "movimiento_caja",
        id_registro_afectado: idMovimientoCaja,
        accion: "crear",
        detalle: `Movimiento de caja creado por venta de chatarra ${data.id_chatarra}.`,
        tx,
      });
    }

    await tx.venta_chatarra.create({
      data: {
        id_venta_chatarra: idVentaChatarra,
        id_chatarra: data.id_chatarra,
        id_movimiento_caja: idMovimientoCaja,
        fecha_venta: fechaVenta,
        cantidad_vendida: cantidadVendida ?? null,
        peso_vendido_kg: pesoVendido ?? null,
        monto_recibido: data.monto_recibido,
        destino_dinero: data.destino_dinero,
        id_usuario_registro: session.user.id,
        observaciones: data.observaciones,
      },
    });

    await tx.chatarra.update({
      where: {
        id_chatarra: data.id_chatarra,
      },
      data: {
        estado: "vendida",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "venta_chatarra",
      id_registro_afectado: idVentaChatarra,
      accion: "crear",
      detalle: `Venta de chatarra registrada para ${data.id_chatarra}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");
  revalidatePath("/dashboard/waste-scrap/scraps");
  revalidatePath("/dashboard/waste-scrap/scrap-sales/new");
  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/movements");
  revalidatePath("/dashboard/petty-cash/monthly-summary");
  revalidatePath("/dashboard/petty-cash/monthly-summary");

  redirect("/dashboard/waste-scrap/scraps");
}
