"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import {
  quickSupplierSchema,
  supplierSchema,
} from "@/schemas/inventory/supplier.schema";

export type SupplierFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const INVENTORY_PATH = "/dashboard/inventory";
const SUPPLIERS_PATH = "/dashboard/inventory/suppliers";
const initialState: SupplierFormState = { error: "" };

async function requireAdmin() {
  return requireRole(["ADMIN"]);
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
  const session = await requireAdmin();
  const parsed = supplierSchema.safeParse(getSupplierFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del proveedor.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const supplierTypeIsActive = await validateSupplierType(
    data.tipo_proveedor,
    true,
  );

  if (!supplierTypeIsActive) {
    return {
      error: "Selecciona un tipo de proveedor activo.",
      fieldErrors: {
        tipo_proveedor: ["Selecciona un tipo de proveedor activo."],
      },
    };
  }

  const hasDuplicateDocument = await validateDuplicateSupplierDocument(
    data.numero_documento,
  );

  if (hasDuplicateDocument) {
    return {
      error: "Ya existe un proveedor con ese número de documento.",
      fieldErrors: {
        numero_documento: [
          "Ya existe un proveedor con ese número de documento.",
        ],
      },
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const idProveedor = await getNextCorrelativeId(tx, {
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

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe un proveedor con ese número de documento."
          ? { numero_documento: [errorMessage] }
          : undefined,
    };
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  redirect(`${SUPPLIERS_PATH}?toast=supplier-created`);

  return initialState;
}

export async function updateSupplierAction(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const session = await requireAdmin();
  const idProveedor = formData.get("id_proveedor")?.toString();

  if (!idProveedor) {
    return {
      error: "El proveedor no existe.",
    };
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
    return {
      error: "El proveedor no existe.",
    };
  }

  const parsed = supplierSchema.safeParse(getSupplierFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del proveedor.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const supplierTypeExists = await validateSupplierType(
    data.tipo_proveedor,
    false,
  );

  if (!supplierTypeExists) {
    return {
      error: "Selecciona un tipo de proveedor válido.",
      fieldErrors: {
        tipo_proveedor: ["Selecciona un tipo de proveedor válido."],
      },
    };
  }

  const hasDuplicateDocument = await validateDuplicateSupplierDocument(
    data.numero_documento,
    idProveedor,
  );

  if (hasDuplicateDocument) {
    return {
      error: "Ya existe otro proveedor con ese número de documento.",
      fieldErrors: {
        numero_documento: [
          "Ya existe otro proveedor con ese número de documento.",
        ],
      },
    };
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

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage ===
        "Ya existe otro proveedor con ese número de documento."
          ? { numero_documento: [errorMessage] }
          : undefined,
    };
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
  redirect(`${SUPPLIERS_PATH}?toast=supplier-updated`);

  return initialState;
}

export async function toggleSupplierStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idProveedor = formData.get("id_proveedor")?.toString();

  if (!idProveedor) {
    redirect(SUPPLIERS_PATH);
  }

  const supplier = await prisma.proveedor.findUnique({
    where: {
      id_proveedor: idProveedor,
    },
    select: {
      id_proveedor: true,
      razon_social: true,
      estado: true,
    },
  });

  if (!supplier) {
    redirect(SUPPLIERS_PATH);
  }

  const nextStatus = !supplier.estado;

  await prisma.proveedor.update({
    where: {
      id_proveedor: supplier.id_proveedor,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "proveedor",
    id_registro_afectado: supplier.id_proveedor,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Proveedor ${nextStatus ? "activado" : "inactivado"}: ${
      supplier.razon_social
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
