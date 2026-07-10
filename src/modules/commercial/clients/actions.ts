"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, type Role } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { clientSchema } from "@/schemas/commercial/client.schema";

export type ClientFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const CLIENTS_PATH = "/dashboard/commercial/clients";
const CLIENT_CREATED_PATH = `${CLIENTS_PATH}?toast=client-created`;
const CLIENT_UPDATED_PATH = `${CLIENTS_PATH}?toast=client-updated`;
const ALLOWED_CLIENT_ROLES: Role[] = ["ADMIN", "SELLER"];
const initialErrorState: ClientFormState = { error: "" };

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

async function requireCommercialClientPermission() {
  return getAuthorizedSession(ALLOWED_CLIENT_ROLES);
}

function getClientFormData(formData: FormData) {
  return {
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
}

async function validateDuplicateClientDocument(
  numeroDocumento: string | null,
  currentClientId?: string,
) {
  if (!numeroDocumento) {
    return false;
  }

  const existingClient = await prisma.cliente.findUnique({
    where: {
      numero_documento: numeroDocumento,
    },
    select: {
      id_cliente: true,
    },
  });

  if (!existingClient) {
    return false;
  }

  return existingClient.id_cliente !== currentClientId;
}

function getPrismaUniqueErrorMessage(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return message;
  }

  return "No se pudo guardar el cliente. Intenta nuevamente.";
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const session = await requireCommercialClientPermission();

  if (!session) {
    return {
      error: "No tienes permisos para registrar clientes.",
    };
  }

  const rawData = getClientFormData(formData);

  const parsed = clientSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos del cliente.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const numeroDocumento = emptyToNull(formData.get("numero_documento"));
  const hasDuplicateDocument =
    await validateDuplicateClientDocument(numeroDocumento);

  if (hasDuplicateDocument) {
    return {
      error: "Ya existe un cliente con ese número de documento.",
      fieldErrors: {
        numero_documento: [
          "Ya existe un cliente con ese número de documento.",
        ],
      },
    };
  }

  let id_cliente = "";

  try {
    await prisma.$transaction(async (tx) => {
      id_cliente = await getNextCorrelativeId(tx, {
        codigoEntidad: "cliente",
        prefijo: "CLI",
      });

      await tx.cliente.create({
        data: {
          id_cliente,
          tipo_cliente: parsed.data.tipo_cliente,
          nombre_razon_social: parsed.data.nombre_razon_social,
          tipo_documento: emptyToNull(formData.get("tipo_documento")),
          numero_documento: numeroDocumento,
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
        tx,
      });
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe un cliente con ese número de documento.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe un cliente con ese número de documento."
          ? { numero_documento: [errorMessage] }
          : undefined,
    };
  }

  revalidatePath(CLIENTS_PATH);
  redirect(CLIENT_CREATED_PATH);

  return initialErrorState;
}

export async function updateClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const session = await requireCommercialClientPermission();

  if (!session) {
    return {
      error: "No tienes permisos para actualizar clientes.",
    };
  }

  const idCliente = formData.get("id_cliente")?.toString();

  if (!idCliente) {
    return {
      error: "El cliente no existe.",
    };
  }

  const client = await prisma.cliente.findUnique({
    where: {
      id_cliente: idCliente,
    },
    select: {
      id_cliente: true,
    },
  });

  if (!client) {
    return {
      error: "El cliente no existe.",
    };
  }

  const rawData = getClientFormData(formData);
  const parsed = clientSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos del cliente.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const numeroDocumento = emptyToNull(formData.get("numero_documento"));
  const hasDuplicateDocument = await validateDuplicateClientDocument(
    numeroDocumento,
    idCliente,
  );

  if (hasDuplicateDocument) {
    return {
      error: "Ya existe otro cliente con ese número de documento.",
      fieldErrors: {
        numero_documento: [
          "Ya existe otro cliente con ese número de documento.",
        ],
      },
    };
  }

  try {
    await prisma.cliente.update({
      where: {
        id_cliente: idCliente,
      },
      data: {
        tipo_cliente: parsed.data.tipo_cliente,
        nombre_razon_social: parsed.data.nombre_razon_social,
        tipo_documento: emptyToNull(formData.get("tipo_documento")),
        numero_documento: numeroDocumento,
        telefono: emptyToNull(formData.get("telefono")),
        correo: emptyToNull(formData.get("correo")),
        direccion: emptyToNull(formData.get("direccion")),
        lugar_origen: emptyToNull(formData.get("lugar_origen")),
        observaciones: emptyToNull(formData.get("observaciones")),
      },
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe otro cliente con ese número de documento.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage ===
        "Ya existe otro cliente con ese número de documento."
          ? { numero_documento: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "cliente",
    id_registro_afectado: idCliente,
    accion: "actualizar",
    detalle: `Cliente actualizado: ${parsed.data.nombre_razon_social}`,
  });

  revalidatePath(CLIENTS_PATH);
  redirect(CLIENT_UPDATED_PATH);

  return initialErrorState;
}

export async function toggleClientStatusAction(formData: FormData) {
  const session = await requireCommercialClientPermission();

  if (!session) {
    redirect("/dashboard/access-denied");
  }

  const idCliente = formData.get("id_cliente")?.toString();

  if (!idCliente) {
    redirect(CLIENTS_PATH);
  }

  const client = await prisma.cliente.findUnique({
    where: {
      id_cliente: idCliente,
    },
    select: {
      id_cliente: true,
      nombre_razon_social: true,
      estado: true,
    },
  });

  if (!client) {
    redirect(CLIENTS_PATH);
  }

  const nextStatus = !client.estado;

  await prisma.cliente.update({
    where: {
      id_cliente: client.id_cliente,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "cliente",
    id_registro_afectado: client.id_cliente,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Cliente ${nextStatus ? "activado" : "inactivado"}: ${
      client.nombre_razon_social
    }`,
  });

  revalidatePath(CLIENTS_PATH);
  redirect(
    `${CLIENTS_PATH}?toast=${nextStatus ? "client-activated" : "client-deactivated"}`,
  );
}
