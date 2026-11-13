"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { formatCents, toCents } from "@/lib/decimal-cents";
import { roundCashAmount } from "@/lib/petty-cash-amounts";
import { scrapSaleSchema } from "@/schemas/waste-scrap/scrap-sale.schema";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

/** Centesimos de un peso o una cantidad, redondeados como su columna numeric(10, 2). */
function hundredths(value: { toString(): string }) {
  return toCents(value.toString()) ?? 0n;
}

export async function createScrapSaleAction(formData: FormData) {
  const session = await requireAdmin();

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

  // C2 de la 11.4b (D48): el peso y la cantidad escritos se redondean como sus columnas
  // numeric(10, 2) antes de compararlos con lo registrado y de guardarlos; los que se dejan vacios
  // toman los de la chatarra, como antes.
  const pesoEscrito =
    data.peso_vendido_kg !== undefined ? formatCents(hundredths(data.peso_vendido_kg)) : undefined;
  const cantidadEscrita =
    data.cantidad_vendida !== undefined ? formatCents(hundredths(data.cantidad_vendida)) : undefined;

  const pesoVendido = pesoEscrito ?? scrap.peso_kg;
  const cantidadVendida = cantidadEscrita ?? scrap.cantidad;

  if (!pesoVendido && !cantidadVendida) {
    throw new Error(
      "Debe registrar peso vendido, cantidad vendida o tener esos datos en la chatarra seleccionada.",
    );
  }

  if (pesoEscrito && scrap.peso_kg && hundredths(scrap.peso_kg) > 0n) {
    if (hundredths(pesoEscrito) > hundredths(scrap.peso_kg)) {
      throw new Error("El peso vendido no puede superar el peso registrado.");
    }
  }

  if (cantidadEscrita && scrap.cantidad && hundredths(scrap.cantidad) > 0n) {
    if (hundredths(cantidadEscrita) > hundredths(scrap.cantidad)) {
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

  const fechaVenta = new Date(`${data.fecha_venta}T00:00:00`);
  // C2 de la 11.4b (D48): el monto redondeado como las columnas; el mismo texto va a la venta, al
  // movimiento y al aumento del saldo.
  const montoRecibido = roundCashAmount(data.monto_recibido);

  await prisma.$transaction(async (tx) => {
    const idVentaChatarra = await getNextCorrelativeId(tx, {
      codigoEntidad: "venta_chatarra",
      prefijo: "VCH",
    });

    const idMovimientoCaja = data.id_caja_chica
      ? await getNextCorrelativeId(tx, {
          codigoEntidad: "movimiento_caja",
          prefijo: "MCA",
        })
      : null;

    if (data.id_caja_chica && idMovimientoCaja) {
      await tx.movimiento_caja.create({
        data: {
          id_movimiento_caja: idMovimientoCaja,
          id_caja_chica: data.id_caja_chica,
          id_usuario_registro: session.user.id,
          tipo_movimiento: "ingreso",
          concepto: `Venta de chatarra ${scrap.id_chatarra}`,
          monto: montoRecibido,
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
            increment: montoRecibido,
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
        monto_recibido: montoRecibido,
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

  redirect("/dashboard/waste-scrap/scraps?toast=scrap-sale-created");
}
