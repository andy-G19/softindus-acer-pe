"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { quoteSchema } from "@/schemas/commercial/quote.schema";

const QUOTES_PATH = "/dashboard/commercial/quotes";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

async function requireCommercialPermission() {
  return requireRole(["ADMIN", "SELLER"]);
}

export async function createQuoteAction(formData: FormData) {
  const session = await requireCommercialPermission();

  const rawData = {
    id_pedido: formData.get("id_pedido")?.toString(),
    adelanto_inicial: formData.get("adelanto_inicial"),
    metodo_pago_adelanto: formData.get("metodo_pago_adelanto"),
    validez_dias: formData.get("validez_dias"),
    observaciones: formData.get("observaciones")?.toString() ?? "",
  };

  const parsed = quoteSchema.safeParse(rawData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const order = await prisma.pedido.findUnique({
    where: {
      id_pedido: parsed.data.id_pedido,
    },
    include: {
      detalle_pedido: {
        select: {
          subtotal: true,
        },
      },
      proforma: {
        where: {
          estado: {
            in: ["vigente", "aceptada", "pagada"],
          },
        },
        select: {
          id_proforma: true,
          numero_proforma: true,
          estado: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("El pedido seleccionado no existe.");
  }

  if (order.detalle_pedido.length === 0) {
    throw new Error("El pedido no tiene productos asociados.");
  }

  if (order.proforma.length > 0) {
    throw new Error(
      `Este pedido ya tiene una proforma activa: ${order.proforma[0].numero_proforma}.`
    );
  }

  const montoTotal = order.detalle_pedido.reduce((total, detail) => {
    return total + Number(detail.subtotal.toString());
  }, 0);

  if (montoTotal <= 0) {
    throw new Error("El monto total de la proforma debe ser mayor que cero.");
  }

  const adelantoInicial = parsed.data.adelanto_inicial ?? 0;

  if (adelantoInicial > montoTotal) {
    throw new Error("El adelanto inicial no puede ser mayor que el monto total.");
  }

  const saldo = Number((montoTotal - adelantoInicial).toFixed(2));
  const hasAdvance = adelantoInicial > 0;

  await prisma.$transaction(async (tx) => {
    const id_proforma = await getNextCorrelativeId(tx, {
      codigoEntidad: "proforma",
      prefijo: "PRF",
    });
    const numero_proforma = id_proforma.replace("PRF", "PF-");
    const fechaEmision = new Date();

    // Sin adelanto la proforma nace vigente; con adelanto el cliente ya la
    // aceptó y pagó algo, así que sigue los mismos estados que un pago normal
    // (ver createPaymentAction).
    const estado = !hasAdvance ? "vigente" : saldo <= 0 ? "pagada" : "aceptada";

    await tx.proforma.create({
      data: {
        id_proforma,
        id_pedido: parsed.data.id_pedido,
        numero_proforma,
        fecha_emision: fechaEmision,
        monto_total: montoTotal,
        adelanto_inicial: hasAdvance ? adelantoInicial : null,
        saldo,
        estado,
        validez_dias: parsed.data.validez_dias ?? null,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "proforma",
      id_registro_afectado: id_proforma,
      accion: "crear",
      detalle: `Proforma creada para el pedido ${parsed.data.id_pedido}.`,
      tx,
    });

    // El adelanto es dinero que ya entró: se registra como pago_cliente para
    // que aparezca en el historial de pagos, quede en la trazabilidad y
    // bloquee la anulación de una proforma ya cobrada.
    if (hasAdvance) {
      const id_pago_cliente = await getNextCorrelativeId(tx, {
        codigoEntidad: "pago_cliente",
        prefijo: "PCL",
      });

      await tx.pago_cliente.create({
        data: {
          id_pago_cliente,
          id_proforma,
          id_pedido: parsed.data.id_pedido,
          id_usuario_registro: session.user.id,
          fecha_pago: fechaEmision,
          monto_pagado: adelantoInicial,
          metodo_pago: parsed.data.metodo_pago_adelanto ?? "efectivo",
          tipo_pago: saldo <= 0 ? "cancelacion" : "adelanto",
          saldo_actual: saldo,
          observaciones: "Adelanto inicial registrado al crear la proforma.",
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "pago_cliente",
        id_registro_afectado: id_pago_cliente,
        accion: "crear",
        detalle: `Adelanto inicial registrado para la proforma ${id_proforma}.`,
        tx,
      });
    }
  });

  revalidatePath(QUOTES_PATH);
  revalidatePath("/dashboard/commercial/orders");

  redirect(`${QUOTES_PATH}?toast=quote-created`);
}

export async function annulQuoteAction(formData: FormData) {
  const session = await requireCommercialPermission();
  const quoteId = formData.get("id_proforma")?.toString().trim();

  if (!quoteId) {
    redirect(QUOTES_PATH);
  }

  const quote = await prisma.proforma.findUnique({
    where: {
      id_proforma: quoteId,
    },
    include: {
      pago_cliente: {
        select: {
          id_pago_cliente: true,
        },
      },
      comprobante_venta: {
        where: {
          estado: "emitido",
        },
        select: {
          id_comprobante: true,
        },
      },
    },
  });

  if (!quote || quote.estado === "anulada") {
    redirect(QUOTES_PATH);
  }

  if (quote.pago_cliente.length > 0 || quote.comprobante_venta.length > 0) {
    redirect(`${QUOTES_PATH}/${quoteId}`);
  }

  await prisma.proforma.update({
    where: {
      id_proforma: quoteId,
    },
    data: {
      estado: "anulada",
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "proforma",
    id_registro_afectado: quoteId,
    accion: "anular",
    detalle: `Proforma anulada: ${quote.numero_proforma}`,
  });

  revalidatePath(QUOTES_PATH);
  revalidatePath(`${QUOTES_PATH}/${quoteId}`);
  revalidatePath("/dashboard/commercial/orders");

  redirect(`${QUOTES_PATH}?toast=quote-annulled`);
}
