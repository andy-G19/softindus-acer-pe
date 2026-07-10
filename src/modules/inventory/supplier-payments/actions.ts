"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
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

  const purchase = await prisma.compra.findUnique({
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

  const previousPayments = await prisma.pago_proveedor.findMany({
    where: {
      id_compra: data.id_compra,
    },
    select: {
      monto_pagado: true,
    },
  });

  const totalPaid = previousPayments.reduce((acc, payment) => {
    return acc + Number(payment.monto_pagado.toString());
  }, 0);

  const purchaseTotal = Number(purchase.monto_total.toString());
  const currentBalance = purchaseTotal - totalPaid;

  if (data.monto_pagado > currentBalance) {
    throw new Error(
      `El pago no puede superar el saldo pendiente. Saldo actual: S/ ${currentBalance.toFixed(
        2,
      )}`,
    );
  }

  const newBalance = currentBalance - data.monto_pagado;

  let newPaymentStatus = "pendiente";

  if (newBalance <= 0) {
    newPaymentStatus = "pagado";
  } else if (newBalance < purchaseTotal) {
    newPaymentStatus = "parcial";
  }

  await prisma.$transaction(async (tx) => {
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
        monto_pagado: data.monto_pagado,
        metodo_pago: data.metodo_pago,
        saldo_pendiente: newBalance,
        estado_pago: newPaymentStatus,
        observaciones: toNullable(data.observaciones),
      },
    });

    await tx.compra.update({
      where: {
        id_compra: data.id_compra,
      },
      data: {
        estado_pago: newPaymentStatus,
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
