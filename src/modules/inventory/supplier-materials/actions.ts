"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import {
  parseRequestedStatus,
  statusToggleDone,
  statusToggleError,
  type StatusToggleState,
} from "@/lib/requested-status";
import { supplierMaterialSchema } from "@/schemas/inventory/supplier-material.schema";

/** Lo que el formulario envio, tal cual, para volver a mostrarlo. */
export type SupplierMaterialFormValues = {
  id_proveedor: string;
  id_material: string;
  unidad_medida: string;
  precio_referencial: string;
  tiempo_entrega_dias: string;
  disponibilidad: string;
};

// Entrega 10.3b: el alta y la edicion no redirigen; devuelven el resultado y
// el formulario da el aviso y cierra el panel o vuelve al listado.
export type SupplierMaterialFormState = FormActionState<
  SupplierMaterialFormValues,
  { id_proveedor_material: string }
>;

type SupplierMaterialValidationResult =
  | {
      ok: false;
      error: string;
      fieldErrors: FieldErrors;
    }
  | {
      ok: true;
      supplier: {
        razon_social: string;
      };
      material: {
        nombre_material: string;
      };
    };

const SUPPLIER_MATERIALS_PATH = "/dashboard/inventory/supplier-materials";

// El formulario y la fila niegan el permiso con un error, sin redirigir.
async function getSupplierMaterialSession() {
  return getAuthorizedSession(["ADMIN"]);
}

function getSupplierMaterialFormValues(formData: FormData): SupplierMaterialFormValues {
  const text = (name: keyof SupplierMaterialFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_proveedor: text("id_proveedor"),
    id_material: text("id_material"),
    unidad_medida: text("unidad_medida"),
    precio_referencial: text("precio_referencial"),
    tiempo_entrega_dias: text("tiempo_entrega_dias"),
    disponibilidad: text("disponibilidad"),
  };
}

function relationError(
  values: SupplierMaterialFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): SupplierMaterialFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function relationSaved(
  values: SupplierMaterialFormValues,
  idProveedorMaterial: string,
): SupplierMaterialFormState {
  return {
    status: "success",
    data: { id_proveedor_material: idProveedorMaterial },
    values,
    operationId: newOperationId(),
  };
}

function getSupplierMaterialFormData(formData: FormData) {
  return {
    id_proveedor: formData.get("id_proveedor"),
    id_material: formData.get("id_material"),
    precio_referencial: formData.get("precio_referencial"),
    unidad_medida: formData.get("unidad_medida"),
    tiempo_entrega_dias: formData.get("tiempo_entrega_dias"),
    disponibilidad: formData.get("disponibilidad"),
  };
}

// El proveedor y el material deben estar activos. Al editar (current), los que
// la asociacion ya tiene se aceptan aunque esten inactivos mientras no se
// cambien: la consulta de edicion los ofrece (hallazgo 4 de la 10.3a).
async function validateActiveSupplierAndMaterial(
  supplierId: string,
  materialId: string,
  current?: { id_proveedor: string; id_material: string },
): Promise<SupplierMaterialValidationResult> {
  const [supplier, material] = await Promise.all([
    prisma.proveedor.findFirst({
      where: {
        id_proveedor: supplierId,
        ...(supplierId === current?.id_proveedor ? {} : { estado: true }),
      },
      select: {
        razon_social: true,
      },
    }),
    prisma.material.findFirst({
      where: {
        id_material: materialId,
        ...(materialId === current?.id_material ? {} : { estado: true }),
      },
      select: {
        nombre_material: true,
      },
    }),
  ]);

  if (!supplier) {
    return {
      ok: false,
      error: "El proveedor seleccionado no existe o está inactivo.",
      fieldErrors: {
        id_proveedor: ["El proveedor seleccionado no existe o está inactivo."],
      },
    };
  }

  if (!material) {
    return {
      ok: false,
      error: "El material seleccionado no existe o está inactivo.",
      fieldErrors: {
        id_material: ["El material seleccionado no existe o está inactivo."],
      },
    };
  }

  return { ok: true, supplier, material };
}

async function hasDuplicateRelation(
  supplierId: string,
  materialId: string,
  currentRelationId?: string,
) {
  const existingRelation = await prisma.proveedor_material.findFirst({
    where: {
      id_proveedor: supplierId,
      id_material: materialId,
    },
    select: {
      id_proveedor_material: true,
    },
  });

  if (!existingRelation) {
    return false;
  }

  return existingRelation.id_proveedor_material !== currentRelationId;
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Este proveedor ya está asociado con el material seleccionado.";
  }

  return "No se pudo guardar la asociación proveedor-material. Intenta nuevamente.";
}

export async function createSupplierMaterialAction(
  _prevState: SupplierMaterialFormState,
  formData: FormData,
): Promise<SupplierMaterialFormState> {
  const values = getSupplierMaterialFormValues(formData);
  const session = await getSupplierMaterialSession();

  if (!session) {
    return relationError(values, "No tienes permisos para registrar asociaciones proveedor-material.");
  }

  const parsed = supplierMaterialSchema.safeParse(
    getSupplierMaterialFormData(formData),
  );

  if (!parsed.success) {
    return relationError(values, "Revisa los datos de la asociación.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const validation = await validateActiveSupplierAndMaterial(
    data.id_proveedor,
    data.id_material,
  );

  if (!validation.ok) {
    return relationError(values, validation.error, validation.fieldErrors);
  }

  const duplicated = await hasDuplicateRelation(
    data.id_proveedor,
    data.id_material,
  );

  if (duplicated) {
    return relationError(values, "Este proveedor ya está asociado con el material seleccionado.", {
      id_material: ["Este proveedor ya está asociado con el material seleccionado."],
    });
  }

  let idProveedorMaterial = "";

  try {
    await prisma.$transaction(async (tx) => {
      idProveedorMaterial = await getNextCorrelativeId(tx, {
        codigoEntidad: "proveedor_material",
        prefijo: "PVM",
      });

      await tx.proveedor_material.create({
        data: {
          id_proveedor_material: idProveedorMaterial,
          id_proveedor: data.id_proveedor,
          id_material: data.id_material,
          precio_referencial: data.precio_referencial ?? null,
          unidad_medida: data.unidad_medida,
          tiempo_entrega_dias:
            data.tiempo_entrega_dias === undefined
              ? null
              : Math.trunc(data.tiempo_entrega_dias),
          disponibilidad: data.disponibilidad ?? null,
          estado: true,
          fecha_actualizacion: new Date(),
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "proveedor_material",
        id_registro_afectado: idProveedorMaterial,
        accion: "crear",
        detalle: `Proveedor-material creado: ${validation.supplier.razon_social} - ${validation.material.nombre_material}`,
        tx,
      });
    });
  } catch (error) {
    return relationError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath(SUPPLIER_MATERIALS_PATH);

  return relationSaved(values, idProveedorMaterial);
}

export async function updateSupplierMaterialAction(
  _prevState: SupplierMaterialFormState,
  formData: FormData,
): Promise<SupplierMaterialFormState> {
  const values = getSupplierMaterialFormValues(formData);
  const session = await getSupplierMaterialSession();

  if (!session) {
    return relationError(values, "No tienes permisos para actualizar asociaciones proveedor-material.");
  }

  const relationId = formData.get("id_proveedor_material")?.toString().trim();

  if (!relationId) {
    return relationError(values, "La asociación proveedor-material no existe.");
  }

  const currentRelation = await prisma.proveedor_material.findUnique({
    where: {
      id_proveedor_material: relationId,
    },
  });

  if (!currentRelation) {
    return relationError(values, "La asociación proveedor-material no existe.");
  }

  const parsed = supplierMaterialSchema.safeParse(
    getSupplierMaterialFormData(formData),
  );

  if (!parsed.success) {
    return relationError(values, "Revisa los datos de la asociación.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const validation = await validateActiveSupplierAndMaterial(
    data.id_proveedor,
    data.id_material,
    currentRelation,
  );

  if (!validation.ok) {
    return relationError(values, validation.error, validation.fieldErrors);
  }

  const duplicated = await hasDuplicateRelation(
    data.id_proveedor,
    data.id_material,
    relationId,
  );

  if (duplicated) {
    return relationError(values, "Ya existe otra asociación para ese proveedor y material.", {
      id_material: ["Ya existe otra asociación para ese proveedor y material."],
    });
  }

  try {
    await prisma.proveedor_material.update({
      where: {
        id_proveedor_material: relationId,
      },
      data: {
        id_proveedor: data.id_proveedor,
        id_material: data.id_material,
        precio_referencial: data.precio_referencial ?? null,
        unidad_medida: data.unidad_medida,
        tiempo_entrega_dias:
          data.tiempo_entrega_dias === undefined
            ? null
            : Math.trunc(data.tiempo_entrega_dias),
        disponibilidad: data.disponibilidad ?? null,
        fecha_actualizacion: new Date(),
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "proveedor_material",
      id_registro_afectado: relationId,
      accion: "actualizar",
      detalle: `Proveedor-material actualizado: ${validation.supplier.razon_social} - ${validation.material.nombre_material}`,
    });
  } catch (error) {
    return relationError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath(SUPPLIER_MATERIALS_PATH);

  return relationSaved(values, relationId);
}

// Activar o inactivar desde la fila (ConfirmActionButton): devuelve el
// resultado en lugar de redirigir, y un error (sin permiso, ya tenia ese estado
// o no existe) queda en la confirmacion.
export async function toggleSupplierMaterialStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const relationId = formData.get("id_proveedor_material")?.toString().trim() ?? "";
  const session = await getSupplierMaterialSession();

  if (!session) {
    return statusToggleError(relationId, "No tienes permisos para activar o inactivar asociaciones proveedor-material.");
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!relationId) {
    return statusToggleError(relationId, "La asociación proveedor-material no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(relationId, "Estado no válido.");
  }

  // Fija el estado pedido solo si la asociacion tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton.
  const { count } = await prisma.proveedor_material.updateMany({
    where: {
      id_proveedor_material: relationId,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
      fecha_actualizacion: new Date(),
    },
  });

  const relation = await prisma.proveedor_material.findUnique({
    where: {
      id_proveedor_material: relationId,
    },
    include: {
      proveedor: {
        select: {
          razon_social: true,
        },
      },
      material: {
        select: {
          nombre_material: true,
        },
      },
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      relationId,
      relation
        ? `La asociación ya estaba ${nextStatus ? "activa" : "inactiva"}.`
        : "La asociación proveedor-material no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "proveedor_material",
    id_registro_afectado: relationId,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Proveedor-material ${nextStatus ? "activado" : "inactivado"}: ${
      relation
        ? `${relation.proveedor.razon_social} - ${relation.material.nombre_material}`
        : relationId
    }`,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath(SUPPLIER_MATERIALS_PATH);

  return statusToggleDone(relationId, nextStatus);
}
