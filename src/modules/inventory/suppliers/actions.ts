"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { parseRequestedStatus } from "@/lib/requested-status";
import {
  quickSupplierSchema,
  supplierSchema,
} from "@/schemas/inventory/supplier.schema";

/** Lo que el formulario envio, tal cual, para volver a mostrarlo. */
export type SupplierFormValues = {
  razon_social: string;
  tipo_documento: string;
  numero_documento: string;
  telefono: string;
  correo: string;
  direccion: string;
  contacto_principal: string;
  tipo_proveedor: string;
  condicion_pago: string;
  observaciones: string;
};

// Entrega 10.3b: el alta y la edicion no redirigen; devuelven el resultado y
// el formulario da el aviso y cierra el panel o vuelve al listado.
export type SupplierFormState = FormActionState<SupplierFormValues, { id_proveedor: string }>;

const INVENTORY_PATH = "/dashboard/inventory";
const SUPPLIERS_PATH = "/dashboard/inventory/suppliers";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

// El formulario niega el permiso con un error, sin redirigir.
async function getSupplierSession() {
  return getAuthorizedSession(["ADMIN"]);
}

function getSupplierFormValues(formData: FormData): SupplierFormValues {
  const text = (name: keyof SupplierFormValues) => formData.get(name)?.toString() ?? "";

  return {
    razon_social: text("razon_social"),
    tipo_documento: text("tipo_documento"),
    numero_documento: text("numero_documento"),
    telefono: text("telefono"),
    correo: text("correo"),
    direccion: text("direccion"),
    contacto_principal: text("contacto_principal"),
    tipo_proveedor: text("tipo_proveedor"),
    condicion_pago: text("condicion_pago"),
    observaciones: text("observaciones"),
  };
}

function supplierError(
  values: SupplierFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): SupplierFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function supplierSaved(values: SupplierFormValues, idProveedor: string): SupplierFormState {
  return { status: "success", data: { id_proveedor: idProveedor }, values, operationId: newOperationId() };
}

function toNullable(value: string | undefined | null) {
  return value && value.trim() !== "" ? value.trim() : null;
}

function getSupplierFormData(formData: FormData) {
  return {
    razon_social: formData.get("razon_social")?.toString().trim(),
    tipo_documento: formData.get("tipo_documento")?.toString().trim(),
    numero_documento: formData.get("numero_documento")?.toString().trim(),
    telefono: formData.get("telefono")?.toString().trim(),
    correo: formData.get("correo")?.toString().trim(),
    direccion: formData.get("direccion")?.toString().trim(),
    contacto_principal: formData.get("contacto_principal")?.toString().trim(),
    tipo_proveedor: formData.get("tipo_proveedor")?.toString().trim(),
    condicion_pago: formData.get("condicion_pago")?.toString().trim(),
    observaciones: formData.get("observaciones")?.toString().trim(),
  };
}

async function validateDuplicateSupplierDocument(
  documentNumber: string | undefined,
  currentSupplierId?: string,
) {
  if (!documentNumber) {
    return false;
  }

  const existingSupplier = await prisma.proveedor.findUnique({
    where: {
      numero_documento: documentNumber,
    },
    select: {
      id_proveedor: true,
    },
  });

  if (!existingSupplier) {
    return false;
  }

  return existingSupplier.id_proveedor !== currentSupplierId;
}

async function validateSupplierType(slug: string, mustBeActive: boolean) {
  const supplierType = await prisma.tipo_proveedor_catalogo.findUnique({
    where: {
      slug,
    },
    select: {
      estado: true,
    },
  });

  if (!supplierType) {
    return false;
  }

  return mustBeActive ? supplierType.estado : true;
}

function getPrismaUniqueErrorMessage(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return message;
  }

  return "No se pudo guardar el proveedor. Intenta nuevamente.";
}

export async function createSupplierAction(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const values = getSupplierFormValues(formData);
  const session = await getSupplierSession();

  if (!session) {
    return supplierError(values, "No tienes permisos para registrar proveedores.");
  }

  const parsed = supplierSchema.safeParse(getSupplierFormData(formData));

  if (!parsed.success) {
    return supplierError(values, "Revisa los datos del proveedor.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const supplierTypeIsActive = await validateSupplierType(
    data.tipo_proveedor,
    true,
  );

  if (!supplierTypeIsActive) {
    return supplierError(values, "Selecciona un tipo de proveedor activo.", {
      tipo_proveedor: ["Selecciona un tipo de proveedor activo."],
    });
  }

  const hasDuplicateDocument = await validateDuplicateSupplierDocument(
    data.numero_documento,
  );

  if (hasDuplicateDocument) {
    return supplierError(values, "Ya existe un proveedor con ese número de documento.", {
      numero_documento: ["Ya existe un proveedor con ese número de documento."],
    });
  }

  let idProveedor = "";

  try {
    await prisma.$transaction(async (tx) => {
      idProveedor = await getNextCorrelativeId(tx, {
        codigoEntidad: "proveedor",
        prefijo: "PVE",
      });

      await tx.proveedor.create({
        data: {
          id_proveedor: idProveedor,
          razon_social: data.razon_social,
          tipo_documento: data.tipo_documento ?? null,
          numero_documento: data.numero_documento ?? null,
          telefono: toNullable(data.telefono),
          correo: toNullable(data.correo),
          direccion: toNullable(data.direccion),
          contacto_principal: toNullable(data.contacto_principal),
          tipo_proveedor: data.tipo_proveedor,
          condicion_pago: data.condicion_pago ?? null,
          estado: true,
          observaciones: toNullable(data.observaciones),
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "proveedor",
        id_registro_afectado: idProveedor,
        accion: "crear",
        detalle: `Proveedor creado: ${data.razon_social}`,
        tx,
      });
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe un proveedor con ese número de documento.",
    );

    return supplierError(
      values,
      errorMessage,
      errorMessage === "Ya existe un proveedor con ese número de documento."
        ? { numero_documento: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);

  return supplierSaved(values, idProveedor);
}

export async function updateSupplierAction(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const values = getSupplierFormValues(formData);
  const session = await getSupplierSession();

  if (!session) {
    return supplierError(values, "No tienes permisos para actualizar proveedores.");
  }

  const idProveedor = formData.get("id_proveedor")?.toString();

  if (!idProveedor) {
    return supplierError(values, "El proveedor no existe.");
  }

  const supplier = await prisma.proveedor.findUnique({
    where: {
      id_proveedor: idProveedor,
    },
    select: {
      id_proveedor: true,
    },
  });

  if (!supplier) {
    return supplierError(values, "El proveedor no existe.");
  }

  const parsed = supplierSchema.safeParse(getSupplierFormData(formData));

  if (!parsed.success) {
    return supplierError(values, "Revisa los datos del proveedor.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const supplierTypeExists = await validateSupplierType(
    data.tipo_proveedor,
    false,
  );

  if (!supplierTypeExists) {
    return supplierError(values, "Selecciona un tipo de proveedor válido.", {
      tipo_proveedor: ["Selecciona un tipo de proveedor válido."],
    });
  }

  const hasDuplicateDocument = await validateDuplicateSupplierDocument(
    data.numero_documento,
    idProveedor,
  );

  if (hasDuplicateDocument) {
    return supplierError(values, "Ya existe otro proveedor con ese número de documento.", {
      numero_documento: ["Ya existe otro proveedor con ese número de documento."],
    });
  }

  try {
    await prisma.proveedor.update({
      where: {
        id_proveedor: idProveedor,
      },
      data: {
        razon_social: data.razon_social,
        tipo_documento: data.tipo_documento ?? null,
        numero_documento: data.numero_documento ?? null,
        telefono: toNullable(data.telefono),
        correo: toNullable(data.correo),
        direccion: toNullable(data.direccion),
        contacto_principal: toNullable(data.contacto_principal),
        tipo_proveedor: data.tipo_proveedor,
        condicion_pago: data.condicion_pago ?? null,
        observaciones: toNullable(data.observaciones),
      },
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe otro proveedor con ese número de documento.",
    );

    return supplierError(
      values,
      errorMessage,
      errorMessage === "Ya existe otro proveedor con ese número de documento."
        ? { numero_documento: [errorMessage] }
        : undefined,
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "proveedor",
    id_registro_afectado: idProveedor,
    accion: "actualizar",
    detalle: `Proveedor actualizado: ${data.razon_social}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);

  return supplierSaved(values, idProveedor);
}

export async function toggleSupplierStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idProveedor = formData.get("id_proveedor")?.toString();
  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idProveedor || nextStatus === null) {
    redirect(SUPPLIERS_PATH);
  }

  // Fija el estado pedido solo si el proveedor tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton. count 0: no existe
  // o ya tenia ese estado, y no hay nada que registrar.
  const { count } = await prisma.proveedor.updateMany({
    where: {
      id_proveedor: idProveedor,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  if (count === 0) {
    redirect(SUPPLIERS_PATH);
  }

  const supplier = await prisma.proveedor.findUnique({
    where: {
      id_proveedor: idProveedor,
    },
    select: {
      razon_social: true,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "proveedor",
    id_registro_afectado: idProveedor,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Proveedor ${nextStatus ? "activado" : "inactivado"}: ${
      supplier?.razon_social ?? idProveedor
    }`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  redirect(
    `${SUPPLIERS_PATH}?toast=${nextStatus ? "supplier-activated" : "supplier-deactivated"}`,
  );
}

export type QuickSupplierResult =
  | { ok: true; supplier: { id: string; label: string } }
  | { ok: false; error: string };

/**
 * Alta rápida de proveedor invocada desde otro formulario (hoy, el de
 * repuestos). A diferencia del resto de acciones del módulo, no redirige ni
 * usa useActionState: devuelve el proveedor creado para que el formulario que
 * la llamó pueda seleccionarlo sin perder lo que el usuario ya había escrito.
 */
export async function createQuickSupplierAction(input: {
  razon_social: string;
  tipo_proveedor: string;
  telefono?: string;
}): Promise<QuickSupplierResult> {
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return { ok: false, error: "No tienes permisos para registrar proveedores." };
  }

  const parsed = quickSupplierSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos del proveedor.",
    };
  }

  const data = parsed.data;

  if (!(await validateSupplierType(data.tipo_proveedor, true))) {
    return { ok: false, error: "Selecciona un tipo de proveedor activo." };
  }

  const existingSupplier = await prisma.proveedor.findFirst({
    where: {
      razon_social: {
        equals: data.razon_social,
        mode: "insensitive",
      },
    },
    select: {
      id_proveedor: true,
      razon_social: true,
      estado: true,
    },
  });

  if (existingSupplier) {
    if (!existingSupplier.estado) {
      return {
        ok: false,
        error: `Ya existe un proveedor inactivo con esa razón social (${existingSupplier.id_proveedor}). Actívalo desde el módulo Proveedores.`,
      };
    }

    // Ya existe y está activo: no se duplica, se devuelve el que hay para que
    // el formulario lo seleccione.
    return {
      ok: true,
      supplier: {
        id: existingSupplier.id_proveedor,
        label: existingSupplier.razon_social,
      },
    };
  }

  let idProveedor = "";

  try {
    await prisma.$transaction(async (tx) => {
      idProveedor = await getNextCorrelativeId(tx, {
        codigoEntidad: "proveedor",
        prefijo: "PVE",
      });

      await tx.proveedor.create({
        data: {
          id_proveedor: idProveedor,
          razon_social: data.razon_social,
          tipo_proveedor: data.tipo_proveedor,
          telefono: toNullable(data.telefono),
          estado: true,
          observaciones: "Registrado desde el alta rápida de repuestos.",
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "proveedor",
        id_registro_afectado: idProveedor,
        accion: "crear",
        detalle: `Proveedor creado (alta rápida): ${data.razon_social}`,
        tx,
      });
    });
  } catch {
    return {
      ok: false,
      error: "No se pudo registrar el proveedor. Intenta nuevamente.",
    };
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);

  return {
    ok: true,
    supplier: { id: idProveedor, label: data.razon_social },
  };
}
