"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { quoteSchema } from "@/schemas/commercial/quote.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();

  return text ? text : null;
}

export async function createQuoteAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const rawData = {
    id_pedido: formData.get("id_pedido")?.toString(),
    adelanto_inicial: formData.get("adelanto_inicial"),
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

  const saldo = montoTotal - adelantoInicial;

  const lastQuote = await prisma.proforma.findFirst({
    orderBy: {
      id_proforma: "desc",
    },
    select: {
      id_proforma: true,
    },
  });

  const id_proforma = buildNextId("PRF", lastQuote?.id_proforma);
  const numero_proforma = id_proforma.replace("PRF", "PF-");

  await prisma.proforma.create({
    data: {
      id_proforma,
      id_pedido: parsed.data.id_pedido,
      numero_proforma,
      fecha_emision: new Date(),
      monto_total: montoTotal,
      adelanto_inicial: adelantoInicial > 0 ? adelantoInicial : null,
      saldo,
      estado: "vigente",
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
  });

  revalidatePath("/dashboard/commercial/quotes");
  revalidatePath("/dashboard/commercial/orders");

  redirect("/dashboard/commercial/quotes");
}
