"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerAuditLog } from "@/lib/audit";
import { calculateClientPayment, hasCents } from "@/lib/client-payment-amounts";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { paymentSchema } from "@/schemas/commercial/payment.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

export async function createPaymentAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "SELLER"]);

  const rawData = {
    id_proforma: formData.get("id_proforma")?.toString(),
    monto_pagado: formData.get("monto_pagado"),
    metodo_pago: formData.get("metodo_pago")?.toString(),
    tipo_pago: formData.get("tipo_pago")?.toString(),
    observaciones: formData.get("observaciones")?.toString() ?? "",
  };

  const parsed = paymentSchema.safeParse(rawData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const { id_proforma, monto_pagado, metodo_pago, tipo_pago } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const quote = await tx.proforma.findUnique({
      where: {
        id_proforma,
      },
      select: {
        id_proforma: true,
        id_pedido: true,
        saldo: true,
        estado: true,
      },
    });

    if (!quote) {
      throw new Error("La proforma seleccionada no existe.");
    }

    if (quote.estado === "anulada") {
      throw new Error("No se puede registrar pagos en una proforma anulada.");
    }

    if (quote.estado === "pagada" || !hasCents(quote.saldo)) {
      throw new Error("La proforma ya se encuentra pagada.");
    }

    // C2 de la 11.3a: el monto se redondea como la columna antes de compararlo con el saldo
    // guardado y de restarlo, en centimos (client-payment-amounts.ts).
    const payment = calculateClientPayment({ balance: quote.saldo, amount: monto_pagado });

    if (!payment.accepted) {
      throw new Error(`El pago no puede ser mayor que el saldo pendiente: S/ ${payment.balance}.`);
    }

    const id_pago_cliente = await getNextCorrelativeId(tx, {
      codigoEntidad: "pago_cliente",
      prefijo: "PCL",
    });

    await tx.pago_cliente.create({
      data: {
        id_pago_cliente,
        id_proforma: quote.id_proforma,
        id_pedido: quote.id_pedido,
        id_usuario_registro: session.user.id,
        fecha_pago: new Date(),
        monto_pagado: payment.amount,
        metodo_pago,
        tipo_pago,
        saldo_actual: payment.newBalance,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.proforma.update({
      where: {
        id_proforma: quote.id_proforma,
      },
      data: {
        saldo: payment.newBalance,
        estado: payment.status,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "pago_cliente",
      id_registro_afectado: id_pago_cliente,
      accion: "crear",
      detalle: `Pago de cliente registrado para la proforma ${quote.id_proforma}.`,
      tx,
    });
  });

  revalidatePath("/dashboard/commercial/quotes");
  revalidatePath(`/dashboard/commercial/quotes/${id_proforma}`);
  revalidatePath("/dashboard/commercial/orders");

  redirect(`/dashboard/commercial/quotes/${id_proforma}?toast=payment-registered`);
}
