"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { ActionErrorState } from "@/lib/errors";
import { parseRequestedStatus } from "@/lib/requested-status";
import { supplierMaterialSchema } from "@/schemas/inventory/supplier-material.schema";

export type SupplierMaterialFormState = ActionErrorState;

type SupplierMaterialValidationResult =
  | {
      ok: false;
      state: SupplierMaterialFormState;
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

async function requireAdmin() {
  return requireRole(["ADMIN"]);
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
      state: {
        error: "El proveedor seleccionado no existe o está inactivo.",
        fieldErrors: {
          id_proveedor: [
            "El proveedor seleccionado no existe o está inactivo.",
          ],
        },
      },
    };
  }

  if (!material) {
    return {
      ok: false,
      state: {
        error: "El material seleccionado no existe o está inactivo.",
        fieldErrors: {
          id_material: ["El material seleccionado no existe o está inactivo."],
        },
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
  const session = await requireAdmin();
  const parsed = supplierMaterialSchema.safeParse(
    getSupplierMaterialFormData(formData),
  );

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la asociación.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const validation = await validateActiveSupplierAndMaterial(
    data.id_proveedor,
    data.id_material,
  );

  if (!validation.ok) {
    return validation.state;
  }

  const duplicated = await hasDuplicateRelation(
    data.id_proveedor,
    data.id_material,
  );

  if (duplicated) {
    return {
      error: "Este proveedor ya está asociado con el material seleccionado.",
      fieldErrors: {
        id_material: [
          "Este proveedor ya está asociado con el material seleccionado.",
        ],
      },
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const idProveedorMaterial = await getNextCorrelativeId(tx, {
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
    return {
      error: getPrismaErrorMessage(error),
    };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath(SUPPLIER_MATERIALS_PATH);

  redirect(`${SUPPLIER_MATERIALS_PATH}?toast=supplier-material-created`);
}

export async function updateSupplierMaterialAction(
  _prevState: SupplierMaterialFormState,
  formData: FormData,
): Promise<SupplierMaterialFormState> {
  const session = await requireAdmin();
  const relationId = formData.get("id_proveedor_material")?.toString().trim();

  if (!relationId) {
    return { error: "La asociación proveedor-material no existe." };
  }

  const currentRelation = await prisma.proveedor_material.findUnique({
    where: {
      id_proveedor_material: relationId,
    },
  });

  if (!currentRelation) {
    return { error: "La asociación proveedor-material no existe." };
  }

  const parsed = supplierMaterialSchema.safeParse(
    getSupplierMaterialFormData(formData),
  );

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la asociación.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const validation = await validateActiveSupplierAndMaterial(
    data.id_proveedor,
    data.id_material,
    currentRelation,
  );

  if (!validation.ok) {
    return validation.state;
  }

  const duplicated = await hasDuplicateRelation(
    data.id_proveedor,
    data.id_material,
    relationId,
  );

  if (duplicated) {
    return {
      error: "Ya existe otra asociación para ese proveedor y material.",
      fieldErrors: {
        id_material: ["Ya existe otra asociación para ese proveedor y material."],
      },
    };
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
    return {
      error: getPrismaErrorMessage(error),
    };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath(SUPPLIER_MATERIALS_PATH);

  redirect(`${SUPPLIER_MATERIALS_PATH}?toast=supplier-material-updated`);
}

export async function toggleSupplierMaterialStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const relationId = formData.get("id_proveedor_material")?.toString().trim();
  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!relationId || nextStatus === null) {
    redirect(SUPPLIER_MATERIALS_PATH);
  }

  // Fija el estado pedido solo si la asociacion tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton. count 0: no existe
  // o ya tenia ese estado, y no hay nada que registrar.
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

  if (count === 0) {
    redirect(SUPPLIER_MATERIALS_PATH);
  }

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

  redirect(
    `${SUPPLIER_MATERIALS_PATH}?toast=${nextStatus ? "supplier-material-activated" : "supplier-material-deactivated"}`,
  );
}
