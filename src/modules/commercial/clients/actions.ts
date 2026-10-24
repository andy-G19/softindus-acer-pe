"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, type Role } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import {
  parseRequestedStatus,
  statusToggleDone,
  statusToggleError,
  type StatusToggleState,
} from "@/lib/requested-status";
import { clientSchema } from "@/schemas/commercial/client.schema";

/** Lo que el formulario envio, tal cual, para volver a mostrarlo. */
export type ClientFormValues = {
  tipo_cliente: string;
  nombre_razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  correo: string;
  direccion: string;
  lugar_origen: string;
  observaciones: string;
};

// Entrega 9: el alta y la edicion no redirigen; devuelven el resultado y el
// formulario da el aviso y vuelve al listado.
export type ClientFormState = FormActionState<ClientFormValues, { id_cliente: string }>;

const CLIENTS_PATH = "/dashboard/commercial/clients";
const ALLOWED_CLIENT_ROLES: Role[] = ["ADMIN", "SELLER"];

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

async function requireCommercialClientPermission() {
  return getAuthorizedSession(ALLOWED_CLIENT_ROLES);
}

function getClientFormValues(formData: FormData): ClientFormValues {
  const text = (name: keyof ClientFormValues) => formData.get(name)?.toString() ?? "";

  return {
    tipo_cliente: text("tipo_cliente"),
    nombre_razon_social: text("nombre_razon_social"),
    tipo_documento: text("tipo_documento"),
    numero_documento: text("numero_documento"),
    telefono: text("telefono"),
    correo: text("correo"),
    direccion: text("direccion"),
    lugar_origen: text("lugar_origen"),
    observaciones: text("observaciones"),
  };
}

function clientError(values: ClientFormValues, error: string, fieldErrors?: FieldErrors): ClientFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function clientSaved(values: ClientFormValues, idCliente: string): ClientFormState {
  return { status: "success", data: { id_cliente: idCliente }, values, operationId: newOperationId() };
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
  const values = getClientFormValues(formData);
  const session = await requireCommercialClientPermission();

  if (!session) {
    return clientError(values, "No tienes permisos para registrar clientes.");
  }

  const rawData = getClientFormData(formData);

  const parsed = clientSchema.safeParse(rawData);

  if (!parsed.success) {
    return clientError(values, "Revisa los datos del cliente.", parsed.error.flatten().fieldErrors);
  }

  const numeroDocumento = emptyToNull(formData.get("numero_documento"));
  const hasDuplicateDocument =
    await validateDuplicateClientDocument(numeroDocumento);

  if (hasDuplicateDocument) {
    return clientError(values, "Ya existe un cliente con ese número de documento.", {
      numero_documento: ["Ya existe un cliente con ese número de documento."],
    });
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

    return clientError(
      values,
      errorMessage,
      errorMessage === "Ya existe un cliente con ese número de documento."
        ? { numero_documento: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(CLIENTS_PATH);

  return clientSaved(values, id_cliente);
}

export async function updateClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const values = getClientFormValues(formData);
  const session = await requireCommercialClientPermission();

  if (!session) {
    return clientError(values, "No tienes permisos para actualizar clientes.");
  }

  const idCliente = formData.get("id_cliente")?.toString();

  if (!idCliente) {
    return clientError(values, "El cliente no existe.");
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
    return clientError(values, "El cliente no existe.");
  }

  const rawData = getClientFormData(formData);
  const parsed = clientSchema.safeParse(rawData);

  if (!parsed.success) {
    return clientError(values, "Revisa los datos del cliente.", parsed.error.flatten().fieldErrors);
  }

  const numeroDocumento = emptyToNull(formData.get("numero_documento"));
  const hasDuplicateDocument = await validateDuplicateClientDocument(
    numeroDocumento,
    idCliente,
  );

  if (hasDuplicateDocument) {
    return clientError(values, "Ya existe otro cliente con ese número de documento.", {
      numero_documento: ["Ya existe otro cliente con ese número de documento."],
    });
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

    return clientError(
      values,
      errorMessage,
      errorMessage === "Ya existe otro cliente con ese número de documento."
        ? { numero_documento: [errorMessage] }
        : undefined,
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "cliente",
    id_registro_afectado: idCliente,
    accion: "actualizar",
    detalle: `Cliente actualizado: ${parsed.data.nombre_razon_social}`,
  });

  revalidatePath(CLIENTS_PATH);

  return clientSaved(values, idCliente);
}

// Activar o inactivar desde la fila (ConfirmActionButton, entrega 10.4a):
// devuelve el resultado en lugar de redirigir, y un error (sin permiso, ya
// tenia ese estado o no existe) queda en la confirmacion.
export async function toggleClientStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const idCliente = formData.get("id_cliente")?.toString().trim() ?? "";
  const session = await requireCommercialClientPermission();

  if (!session) {
    return statusToggleError(idCliente, "No tienes permisos para activar o inactivar clientes.");
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idCliente) {
    return statusToggleError(idCliente, "El cliente no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(idCliente, "Estado no válido.");
  }

  // Fija el estado pedido solo si el cliente tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton.
  const { count } = await prisma.cliente.updateMany({
    where: {
      id_cliente: idCliente,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  const client = await prisma.cliente.findUnique({
    where: {
      id_cliente: idCliente,
    },
    select: {
      nombre_razon_social: true,
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      idCliente,
      client ? `El cliente ya estaba ${nextStatus ? "activo" : "inactivo"}.` : "El cliente no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "cliente",
    id_registro_afectado: idCliente,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Cliente ${nextStatus ? "activado" : "inactivado"}: ${
      client?.nombre_razon_social ?? idCliente
    }`,
  });

  revalidatePath(CLIENTS_PATH);

  return statusToggleDone(idCliente, nextStatus);
}
