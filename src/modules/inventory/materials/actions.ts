"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import {
  materialSchema,
  materialUpdateSchema,
} from "@/schemas/inventory/material.schema";

export type MaterialFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const INVENTORY_PATH = "/dashboard/inventory";
const MATERIALS_PATH = "/dashboard/inventory/materials";
const initialState: MaterialFormState = { error: "" };

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  return session;
}

function getMaterialFormData(formData: FormData, includeStock: boolean) {
  return {
    nombre_material: formData.get("nombre_material")?.toString().trim(),
    categoria: formData.get("categoria")?.toString().trim(),
    unidad_medida: formData.get("unidad_medida")?.toString().trim(),
    stock_minimo: formData.get("stock_minimo")?.toString() || "0",
    costo_unitario_actual:
      formData.get("costo_unitario_actual")?.toString() || "0",
    ...(includeStock
      ? {
          stock_actual: formData.get("stock_actual")?.toString() || "0",
          stock_reservado:
            formData.get("stock_reservado")?.toString() || "0",
        }
      : {}),
  };
}

async function validateDuplicateMaterialName(
  materialName: string,
  currentMaterialId?: string,
) {
  const existingMaterial = await prisma.material.findUnique({
    where: {
      nombre_material: materialName,
    },
    select: {
      id_material: true,
    },
  });

  if (!existingMaterial) {
    return false;
  }

  return existingMaterial.id_material !== currentMaterialId;
}

async function validateMaterialCategory(slug: string, mustBeActive: boolean) {
  const category = await prisma.categoria_material.findUnique({
    where: {
      slug,
    },
    select: {
      estado: true,
    },
  });

  if (!category) {
    return false;
  }

  return mustBeActive ? category.estado : true;
}

function getPrismaUniqueErrorMessage(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return message;
  }

  return "No se pudo guardar el material. Intenta nuevamente.";
}

export async function createMaterialAction(
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  const session = await requireAdmin();
  const parsed = materialSchema.safeParse(getMaterialFormData(formData, true));

  if (!parsed.success) {
    return {
      error: "Revisa los datos del material.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const categoryIsActive = await validateMaterialCategory(data.categoria, true);

  if (!categoryIsActive) {
    return {
      error: "Selecciona una categoría de material activa.",
      fieldErrors: {
        categoria: ["Selecciona una categoría de material activa."],
      },
    };
  }

  const hasDuplicateName = await validateDuplicateMaterialName(
    data.nombre_material,
  );

  if (hasDuplicateName) {
    return {
      error: "Ya existe un material con ese nombre.",
      fieldErrors: {
        nombre_material: ["Ya existe un material con ese nombre."],
      },
    };
  }

  const [lastMaterial, lastMovement, lastAlert] = await Promise.all([
    prisma.material.findFirst({
      orderBy: {
        id_material: "desc",
      },
      select: {
        id_material: true,
      },
    }),
    prisma.movimiento_inventario.findFirst({
      orderBy: {
        id_movimiento: "desc",
      },
      select: {
        id_movimiento: true,
      },
    }),
    prisma.alerta_stock.findFirst({
      orderBy: {
        id_alerta: "desc",
      },
      select: {
        id_alerta: true,
      },
    }),
  ]);

  const idMaterial = buildNextId("MAT", lastMaterial?.id_material);
  const idMovimiento = buildNextId("MVI", lastMovement?.id_movimiento);
  const idAlerta = buildNextId("ALE", lastAlert?.id_alerta);
  const shouldCreateInitialMovement = data.stock_actual > 0;
  const shouldCreateStockAlert =
    data.stock_minimo > 0 && data.stock_actual <= data.stock_minimo;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.material.create({
        data: {
          id_material: idMaterial,
          nombre_material: data.nombre_material,
          categoria: data.categoria,
          unidad_medida: data.unidad_medida,
          stock_actual: data.stock_actual,
          stock_reservado: data.stock_reservado,
          stock_minimo: data.stock_minimo,
          costo_unitario_actual: data.costo_unitario_actual,
          estado: true,
        },
      });

      if (shouldCreateInitialMovement) {
        await tx.movimiento_inventario.create({
          data: {
            id_movimiento: idMovimiento,
            id_material: idMaterial,
            tipo_movimiento: "entrada",
            cantidad: data.stock_actual,
            stock_anterior: 0,
            stock_resultante: data.stock_actual,
            motivo: "Stock inicial registrado al crear el material",
            id_usuario_responsable: session.user.id,
          },
        });
      }

      if (shouldCreateStockAlert) {
        await tx.alerta_stock.create({
          data: {
            id_alerta: idAlerta,
            id_material: idMaterial,
            stock_detectado: data.stock_actual,
            stock_minimo: data.stock_minimo,
            estado_alerta: "activa",
            mensaje: `El material ${data.nombre_material} está en stock bajo.`,
          },
        });
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "material",
        id_registro_afectado: idMaterial,
        accion: "crear",
        detalle: `Material creado: ${data.nombre_material}`,
        tx,
      });
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe un material con ese nombre.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe un material con ese nombre."
          ? { nombre_material: [errorMessage] }
          : undefined,
    };
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  redirect(MATERIALS_PATH);

  return initialState;
}

export async function updateMaterialAction(
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  const session = await requireAdmin();
  const idMaterial = formData.get("id_material")?.toString();

  if (!idMaterial) {
    return {
      error: "El material no existe.",
    };
  }

  const material = await prisma.material.findUnique({
    where: {
      id_material: idMaterial,
    },
    select: {
      id_material: true,
    },
  });

  if (!material) {
    return {
      error: "El material no existe.",
    };
  }

  const parsed = materialUpdateSchema.safeParse(
    getMaterialFormData(formData, false),
  );

  if (!parsed.success) {
    return {
      error: "Revisa los datos del material.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const categoryExists = await validateMaterialCategory(data.categoria, false);

  if (!categoryExists) {
    return {
      error: "Selecciona una categoría de material válida.",
      fieldErrors: {
        categoria: ["Selecciona una categoría de material válida."],
      },
    };
  }

  const hasDuplicateName = await validateDuplicateMaterialName(
    data.nombre_material,
    idMaterial,
  );

  if (hasDuplicateName) {
    return {
      error: "Ya existe otro material con ese nombre.",
      fieldErrors: {
        nombre_material: ["Ya existe otro material con ese nombre."],
      },
    };
  }

  try {
    await prisma.material.update({
      where: {
        id_material: idMaterial,
      },
      data: {
        nombre_material: data.nombre_material,
        categoria: data.categoria,
        unidad_medida: data.unidad_medida,
        stock_minimo: data.stock_minimo,
        costo_unitario_actual: data.costo_unitario_actual,
      },
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe otro material con ese nombre.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe otro material con ese nombre."
          ? { nombre_material: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "material",
    id_registro_afectado: idMaterial,
    accion: "actualizar",
    detalle: `Material actualizado: ${data.nombre_material}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  redirect(MATERIALS_PATH);

  return initialState;
}

export async function toggleMaterialStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idMaterial = formData.get("id_material")?.toString();

  if (!idMaterial) {
    redirect(MATERIALS_PATH);
  }

  const material = await prisma.material.findUnique({
    where: {
      id_material: idMaterial,
    },
    select: {
      id_material: true,
      nombre_material: true,
      estado: true,
    },
  });

  if (!material) {
    redirect(MATERIALS_PATH);
  }

  const nextStatus = !material.estado;

  await prisma.material.update({
    where: {
      id_material: material.id_material,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "material",
    id_registro_afectado: material.id_material,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Material ${nextStatus ? "activado" : "inactivado"}: ${
      material.nombre_material
    }`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  redirect(MATERIALS_PATH);
}
