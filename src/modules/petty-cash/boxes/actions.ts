"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { pettyCashBoxSchema } from "@/schemas/petty-cash/petty-cash-box.schema";

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

export async function createPettyCashBoxAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = pettyCashBoxSchema.safeParse({
    nombre_caja: formData.get("nombre_caja"),
    saldo_inicial: formData.get("saldo_inicial"),
    fecha_apertura: formData.get("fecha_apertura"),
    responsable: formData.get("responsable"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;
  const boxName = data.nombre_caja.trim();

  const existingBox = await prisma.caja_chica.findFirst({
    where: {
      nombre_caja: {
        equals: boxName,
        mode: "insensitive",
      },
    },
  });

  if (existingBox) {
    throw new Error("Ya existe una caja chica con ese nombre.");
  }

  await prisma.$transaction(async (tx) => {
    const idCajaChica = await getNextCorrelativeId(tx, {
      codigoEntidad: "caja_chica",
      prefijo: "CAJ",
    });

    await tx.caja_chica.create({
      data: {
        id_caja_chica: idCajaChica,
        nombre_caja: boxName,
        saldo_inicial: data.saldo_inicial,
        saldo_actual: data.saldo_inicial,
        fecha_apertura: data.fecha_apertura,
        estado: "abierta",
        responsable: data.responsable || null,
        observaciones: data.observaciones || null,
      },
    });
  });

  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/boxes");

  redirect("/dashboard/petty-cash/boxes?toast=petty-cash-box-created");
}