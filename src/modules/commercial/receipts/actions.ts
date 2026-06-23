"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { receiptSchema } from "@/schemas/commercial/receipt.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

export async function createReceiptAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const rawData = {
    id_proforma: formData.get("id_proforma")?.toString(),
    tipo_comprobante: formData.get("tipo_comprobante")?.toString(),
    numero_comprobante: formData.get("numero_comprobante")?.toString(),
    monto_total: formData.get("monto_total"),
    observaciones: formData.get("observaciones")?.toString() ?? "",
  };

  const parsed = receiptSchema.safeParse(rawData);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const { id_proforma, tipo_comprobante, numero_comprobante, monto_total } =
    parsed.data;

  const quote = await prisma.proforma.findUnique({
    where: {
      id_proforma,
    },
    include: {
      comprobante_venta: {
        where: {
          estado: "emitido",
        },
        select: {
          id_comprobante: true,
          numero_comprobante: true,
        },
      },
    },
  });

  if (!quote) {
    throw new Error("La proforma seleccionada no existe.");
  }

  if (quote.estado === "anulada") {
    throw new Error("No se puede emitir comprobante para una proforma anulada.");
  }

  if (quote.comprobante_venta.length > 0) {
    throw new Error(
      `Esta proforma ya tiene un comprobante emitido: ${quote.comprobante_venta[0].numero_comprobante}.`
    );
  }

  if (monto_total > Number(quote.monto_total.toString())) {
    throw new Error("El comprobante no puede superar el monto total de la proforma.");
  }

  const existingNumber = await prisma.comprobante_venta.findUnique({
    where: {
      numero_comprobante,
    },
    select: {
      id_comprobante: true,
    },
  });

  if (existingNumber) {
    throw new Error("Ya existe un comprobante con ese número.");
  }

  const lastReceipt = await prisma.comprobante_venta.findFirst({
    orderBy: {
      id_comprobante: "desc",
    },
    select: {
      id_comprobante: true,
    },
  });

  const id_comprobante = buildNextId("CMP", lastReceipt?.id_comprobante);

  await prisma.comprobante_venta.create({
    data: {
      id_comprobante,
      id_pedido: quote.id_pedido,
      id_proforma: quote.id_proforma,
      tipo_comprobante,
      numero_comprobante,
      fecha_emision: new Date(),
      monto_total,
      estado: "emitido",
      observaciones: emptyToNull(formData.get("observaciones")),
    },
  });

  revalidatePath("/dashboard/commercial/quotes");
  revalidatePath(`/dashboard/commercial/quotes/${id_proforma}`);
  revalidatePath("/dashboard/commercial/orders");

  redirect(`/dashboard/commercial/quotes/${id_proforma}`);
}