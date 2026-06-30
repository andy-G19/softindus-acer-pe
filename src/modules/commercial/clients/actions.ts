"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { clientSchema } from "@/schemas/commercial/client.schema";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

export async function createClientAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return;
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    return;
  }

  const rawData = {
    tipo_cliente: formData.get("tipo_cliente")?.toString(),
    nombre_razon_social: formData.get("nombre_razon_social")?.toString(),
    tipo_documento: formData.get("tipo_documento")?.toString() ?? "",
    numero_documento: formData.get("numero_documento")?.toString() ?? "",
    telefono: formData.get("telefono")?.toString() ?? "",
    correo: formData.get("correo")?.toString() ?? "",
    direccion: formData.get("direccion")?.toString() ?? "",
    lugar_origen: formData.get("lugar_origen")?.toString() ?? "",
    observaciones: formData.get("observaciones")?.toString() ?? "",
  };

  const parsed = clientSchema.safeParse(rawData);

  if (!parsed.success) {
    return;
  }

  const lastClient = await prisma.cliente.findFirst({
    orderBy: {
      id_cliente: "desc",
    },
    select: {
      id_cliente: true,
    },
  });

  const id_cliente = buildNextId("CLI", lastClient?.id_cliente);

  await prisma.cliente.create({
    data: {
      id_cliente,
      tipo_cliente: parsed.data.tipo_cliente,
      nombre_razon_social: parsed.data.nombre_razon_social,
      tipo_documento: emptyToNull(formData.get("tipo_documento")),
      numero_documento: emptyToNull(formData.get("numero_documento")),
      telefono: emptyToNull(formData.get("telefono")),
      correo: emptyToNull(formData.get("correo")),
      direccion: emptyToNull(formData.get("direccion")),
      lugar_origen: emptyToNull(formData.get("lugar_origen")),
      observaciones: emptyToNull(formData.get("observaciones")),
      estado: true,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "cliente",
    id_registro_afectado: id_cliente,
    accion: "crear",
    detalle: `Cliente creado: ${parsed.data.nombre_razon_social}`,
  });

  revalidatePath("/dashboard/commercial/clients");
  redirect("/dashboard/commercial/clients");
}
