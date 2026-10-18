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
  materialSchema,
  materialUpdateSchema,
} from "@/schemas/inventory/material.schema";

/** Lo que el formulario envio, tal cual, para volver a mostrarlo. */
export type MaterialFormValues = {
  nombre_material: string;
  categoria: string;
  unidad_medida: string;
  stock_actual: string;
  stock_reservado: string;
  stock_minimo: string;
  costo_unitario_actual: string;
};

// Entrega 10.3: el alta y la edicion no redirigen; devuelven el resultado y
// el formulario da el aviso y cierra el panel o vuelve al listado.
export type MaterialFormState = FormActionState<MaterialFormValues, { id_material: string }>;

const INVENTORY_PATH = "/dashboard/inventory";
const MATERIALS_PATH = "/dashboard/inventory/materials";

// El cambio de estado sigue redirigiendo (y negando con requireRole) hasta que
// pase a ConfirmActionButton.
async function requireAdmin() {
  return requireRole(["ADMIN"]);
}

// El formulario niega el permiso con un error dentro de el, sin redirigir.
async function getMaterialFormSession() {
  return getAuthorizedSession(["ADMIN"]);
}

function getMaterialFormValues(formData: FormData): MaterialFormValues {
  const text = (name: keyof MaterialFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombre_material: text("nombre_material"),
    categoria: text("categoria"),
    unidad_medida: text("unidad_medida"),
    stock_actual: text("stock_actual"),
    stock_reservado: text("stock_reservado"),
    stock_minimo: text("stock_minimo"),
    costo_unitario_actual: text("costo_unitario_actual"),
  };
}

function materialError(
  values: MaterialFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): MaterialFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function materialSaved(values: MaterialFormValues, idMaterial: string): MaterialFormState {
  return { status: "success", data: { id_material: idMaterial }, values, operationId: newOperationId() };
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
  const values = getMaterialFormValues(formData);
  const session = await getMaterialFormSession();

  if (!session) {
    return materialError(values, "No tienes permisos para registrar materiales.");
  }

  const parsed = materialSchema.safeParse(getMaterialFormData(formData, true));

  if (!parsed.success) {
    return materialError(values, "Revisa los datos del material.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const categoryIsActive = await validateMaterialCategory(data.categoria, true);

  if (!categoryIsActive) {
    return materialError(values, "Selecciona una categoría de material activa.", {
      categoria: ["Selecciona una categoría de material activa."],
    });
  }

  const hasDuplicateName = await validateDuplicateMaterialName(
    data.nombre_material,
  );

  if (hasDuplicateName) {
    return materialError(values, "Ya existe un material con ese nombre.", {
      nombre_material: ["Ya existe un material con ese nombre."],
    });
  }

  let idMaterial = "";

  try {
    await prisma.$transaction(async (tx) => {
      idMaterial = await getNextCorrelativeId(tx, {
        codigoEntidad: "material",
        prefijo: "MAT",
      });

      // El kardex inicial y la alerta usan el stock que devuelve la escritura
      // (regla 5): la base lo guarda con dos decimales, y es lo que queda.
      const stored = await tx.material.create({
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
        select: {
          stock_actual: true,
          stock_minimo: true,
        },
      });

      if (stored.stock_actual.greaterThan(0)) {
        const idMovimiento = await getNextCorrelativeId(tx, {
          codigoEntidad: "movimiento_inventario",
          prefijo: "MVI",
        });

        await tx.movimiento_inventario.create({
          data: {
            id_movimiento: idMovimiento,
            id_material: idMaterial,
            tipo_movimiento: "entrada",
            cantidad: stored.stock_actual,
            stock_anterior: 0,
            stock_resultante: stored.stock_actual,
            motivo: "Stock inicial registrado al crear el material",
            id_usuario_responsable: session.user.id,
          },
        });
      }

      if (
        stored.stock_minimo.greaterThan(0) &&
        stored.stock_actual.lessThanOrEqualTo(stored.stock_minimo)
      ) {
        const idAlerta = await getNextCorrelativeId(tx, {
          codigoEntidad: "alerta_stock",
          prefijo: "ALE",
        });

        await tx.alerta_stock.create({
          data: {
            id_alerta: idAlerta,
            id_material: idMaterial,
            stock_detectado: stored.stock_actual,
            stock_minimo: stored.stock_minimo,
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

    return materialError(
      values,
      errorMessage,
      errorMessage === "Ya existe un material con ese nombre."
        ? { nombre_material: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);

  return materialSaved(values, idMaterial);
}

export async function updateMaterialAction(
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  const values = getMaterialFormValues(formData);
  const session = await getMaterialFormSession();

  if (!session) {
    return materialError(values, "No tienes permisos para actualizar materiales.");
  }

  const idMaterial = formData.get("id_material")?.toString();

  if (!idMaterial) {
    return materialError(values, "El material no existe.");
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
    return materialError(values, "El material no existe.");
  }

  const parsed = materialUpdateSchema.safeParse(
    getMaterialFormData(formData, false),
  );

  if (!parsed.success) {
    return materialError(values, "Revisa los datos del material.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const categoryExists = await validateMaterialCategory(data.categoria, false);

  if (!categoryExists) {
    return materialError(values, "Selecciona una categoría de material válida.", {
      categoria: ["Selecciona una categoría de material válida."],
    });
  }

  const hasDuplicateName = await validateDuplicateMaterialName(
    data.nombre_material,
    idMaterial,
  );

  if (hasDuplicateName) {
    return materialError(values, "Ya existe otro material con ese nombre.", {
      nombre_material: ["Ya existe otro material con ese nombre."],
    });
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

    return materialError(
      values,
      errorMessage,
      errorMessage === "Ya existe otro material con ese nombre."
        ? { nombre_material: [errorMessage] }
        : undefined,
    );
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

  return materialSaved(values, idMaterial);
}

export async function toggleMaterialStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idMaterial = formData.get("id_material")?.toString();
  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idMaterial || nextStatus === null) {
    redirect(MATERIALS_PATH);
  }

  // Fija el estado pedido solo si el material tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton. count 0: no existe
  // o ya tenia ese estado, y no hay nada que registrar.
  const { count } = await prisma.material.updateMany({
    where: {
      id_material: idMaterial,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  if (count === 0) {
    redirect(MATERIALS_PATH);
  }

  const material = await prisma.material.findUnique({
    where: {
      id_material: idMaterial,
    },
    select: {
      nombre_material: true,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "material",
    id_registro_afectado: idMaterial,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Material ${nextStatus ? "activado" : "inactivado"}: ${
      material?.nombre_material ?? idMaterial
    }`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  redirect(
    `${MATERIALS_PATH}?toast=${nextStatus ? "material-activated" : "material-deactivated"}`,
  );
}
