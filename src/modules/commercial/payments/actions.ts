"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { paymentSchema } from "@/schemas/commercial/payment.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

export async function createPaymentAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

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

    if (quote.estado === "pagada" || Number(quote.saldo.toString()) <= 0) {
      throw new Error("La proforma ya se encuentra pagada.");
    }

    const saldoActual = Number(quote.saldo.toString());

    if (monto_pagado > saldoActual) {
      throw new Error(
        `El pago no puede ser mayor que el saldo pendiente: S/ ${saldoActual.toFixed(
          2
        )}.`
      );
    }

    const nuevoSaldo = Number((saldoActual - monto_pagado).toFixed(2));
    const nuevoEstado = nuevoSaldo === 0 ? "pagada" : "aceptada";

    const lastPayment = await tx.pago_cliente.findFirst({
      orderBy: {
        id_pago_cliente: "desc",
      },
      select: {
        id_pago_cliente: true,
      },
    });

    const id_pago_cliente = buildNextId("PCL", lastPayment?.id_pago_cliente);

    await tx.pago_cliente.create({
      data: {
        id_pago_cliente,
        id_proforma: quote.id_proforma,
        id_pedido: quote.id_pedido,
        id_usuario_registro: session.user.id,
        fecha_pago: new Date(),
        monto_pagado,
        metodo_pago,
        tipo_pago,
        saldo_actual: nuevoSaldo,
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });

    await tx.proforma.update({
      where: {
        id_proforma: quote.id_proforma,
      },
      data: {
        saldo: nuevoSaldo,
        estado: nuevoEstado,
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

  redirect(`/dashboard/commercial/quotes/${id_proforma}`);
}
