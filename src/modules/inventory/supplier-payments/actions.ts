"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockPurchaseRow } from "@/lib/row-locks";
import { calculateSupplierPayment } from "@/lib/supplier-payment-amounts";
import { supplierPaymentSchema } from "@/schemas/inventory/supplier-payment.schema";

function toNullable(value: string | undefined) {
  return value && value.trim() !== "" ? value.trim() : null;
}

export async function createSupplierPaymentAction(formData: FormData) {
  const session = await requireRole(["ADMIN"]);

  const parsed = supplierPaymentSchema.safeParse({
    id_compra: formData.get("id_compra"),
    fecha_pago: formData.get("fecha_pago"),
    monto_pagado: formData.get("monto_pagado"),
    metodo_pago: formData.get("metodo_pago"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    // C3 de la 11.2a: la compra se bloquea antes de leer lo que decide el pago (su
    // estado y los pagos anteriores). Dos pagos simultaneos, o un pago y una
    // anulacion, que toman el mismo candado se ponen en fila: el segundo ve lo que
    // el primero confirmo. Un rechazo lanza dentro de la transaccion, que se
    // deshace sin haber escrito nada.
    await lockPurchaseRow(tx, data.id_compra);

    const purchase = await tx.compra.findUnique({
      where: {
        id_compra: data.id_compra,
      },
    });

    if (!purchase) {
      throw new Error("La compra seleccionada no existe.");
    }

    if (purchase.estado_compra === "anulada") {
      throw new Error("No se puede registrar pagos en una compra anulada.");
    }

    if (purchase.estado_pago === "pagado") {
      throw new Error("Esta compra ya está pagada.");
    }

    const previousPayments = await tx.pago_proveedor.findMany({
      where: {
        id_compra: data.id_compra,
      },
      select: {
        monto_pagado: true,
      },
    });

    // Hallazgos 1 y 2 de la 11.2a: el saldo se cuenta en centesimos enteros, con
    // el redondeo de las columnas, y se guarda exactamente lo que devuelve.
    const payment = calculateSupplierPayment({
      total: purchase.monto_total,
      previousPayments: previousPayments.map((previous) => previous.monto_pagado),
      amount: data.monto_pagado,
    });

    if (!payment.accepted) {
      throw new Error(
        `El pago no puede superar el saldo pendiente. Saldo actual: S/ ${payment.balance}`,
      );
    }

    const idPagoProveedor = await getNextCorrelativeId(tx, {
      codigoEntidad: "pago_proveedor",
      prefijo: "PPR",
    });

    await tx.pago_proveedor.create({
      data: {
        id_pago_proveedor: idPagoProveedor,
        id_compra: data.id_compra,
        id_proveedor: purchase.id_proveedor,
        id_usuario_registro: session.user.id,
        fecha_pago: new Date(data.fecha_pago),
        monto_pagado: payment.amount,
        metodo_pago: data.metodo_pago,
        saldo_pendiente: payment.newBalance,
        estado_pago: payment.status,
        observaciones: toNullable(data.observaciones),
      },
    });

    await tx.compra.update({
      where: {
        id_compra: data.id_compra,
      },
      data: {
        estado_pago: payment.status,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "pago_proveedor",
      id_registro_afectado: idPagoProveedor,
      accion: "crear",
      detalle: `Pago a proveedor registrado para la compra ${data.id_compra}.`,
      tx,
    });
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/purchases");
  revalidatePath(`/dashboard/inventory/purchases/${data.id_compra}`);

  redirect(`/dashboard/inventory/purchases/${data.id_compra}?toast=supplier-payment-registered`);
}
