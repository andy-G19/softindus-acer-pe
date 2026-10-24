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
import { productCategorySchema } from "@/schemas/commercial/product-category.schema";
import { productSchema } from "@/schemas/commercial/product.schema";

/** Lo que el formulario de producto envio, tal cual, para volver a mostrarlo. */
export type ProductFormValues = {
  nombre_producto: string;
  categoria: string;
  unidad_medida: string;
  precio_referencial: string;
  descripcion: string;
};

// Entrega 10.4a: el alta y la edicion de productos no redirigen; devuelven el
// resultado y el formulario da el aviso y cierra el panel o vuelve al listado.
// Sin permiso responden con un error, no redirigen.
export type ProductFormState = FormActionState<ProductFormValues, { id_producto: string }>;

/** Lo que el formulario de categoria envio, tal cual, para volver a mostrarlo. */
export type ProductCategoryFormValues = {
  nombre: string;
  descripcion: string;
};

// Entrega 9: el alta y la edicion de categorias se usan desde una ventana
// modal y devuelven el resultado en lugar del estado de error suelto; sin
// permiso responden con un error, no redirigen.
export type ProductCategoryFormState = FormActionState<
  ProductCategoryFormValues,
  { id_categoria_producto: string }
>;

const PRODUCTS_PATH = "/dashboard/commercial/products";
const PRODUCT_CATEGORIES_PATH = "/dashboard/commercial/product-categories";

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

function slugify(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCategoryFormValues(formData: FormData): ProductCategoryFormValues {
  return {
    nombre: formData.get("nombre")?.toString() ?? "",
    descripcion: formData.get("descripcion")?.toString() ?? "",
  };
}

function categoryError(
  values: ProductCategoryFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): ProductCategoryFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function categorySaved(values: ProductCategoryFormValues, idCategoriaProducto: string): ProductCategoryFormState {
  return {
    status: "success",
    data: { id_categoria_producto: idCategoriaProducto },
    values,
    operationId: newOperationId(),
  };
}

function getProductFormValues(formData: FormData): ProductFormValues {
  const text = (name: keyof ProductFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombre_producto: text("nombre_producto"),
    categoria: text("categoria"),
    unidad_medida: text("unidad_medida"),
    precio_referencial: text("precio_referencial"),
    descripcion: text("descripcion"),
  };
}

function productError(values: ProductFormValues, error: string, fieldErrors?: FieldErrors): ProductFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function productSaved(values: ProductFormValues, idProducto: string): ProductFormState {
  return { status: "success", data: { id_producto: idProducto }, values, operationId: newOperationId() };
}

function getProductFormData(formData: FormData) {
  const price = formData.get("precio_referencial")?.toString().trim();

  return {
    nombre_producto: formData.get("nombre_producto")?.toString().trim(),
    categoria: formData.get("categoria")?.toString().trim(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
    unidad_medida: formData.get("unidad_medida")?.toString().trim(),
    precio_referencial: price ? price : undefined,
  };
}

async function validateDuplicateProductName(
  productName: string,
  currentProductId?: string,
) {
  const existingProduct = await prisma.producto.findUnique({
    where: {
      nombre_producto: productName,
    },
    select: {
      id_producto: true,
    },
  });

  if (!existingProduct) {
    return false;
  }

  return existingProduct.id_producto !== currentProductId;
}

// La categoria debe existir y estar activa. Al editar (currentSlug), la que el
// producto ya tiene se acepta aunque este inactiva mientras no se cambie: la
// consulta de edicion la ofrece, como las asociaciones proveedor-material.
async function validateActiveCategory(slug: string, currentSlug?: string) {
  const category = await prisma.categoria_producto.findUnique({
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

  return slug === currentSlug || category.estado;
}

function getPrismaUniqueErrorMessage(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return message;
  }

  return "No se pudo guardar el registro. Intenta nuevamente.";
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const values = getProductFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return productError(values, "No tienes permisos para registrar productos.");
  }

  const rawData = getProductFormData(formData);
  const parsed = productSchema.safeParse(rawData);

  if (!parsed.success) {
    return productError(values, "Revisa los datos del producto.", parsed.error.flatten().fieldErrors);
  }

  const categoryIsActive = await validateActiveCategory(parsed.data.categoria);

  if (!categoryIsActive) {
    return productError(values, "Selecciona una categoría activa.", {
      categoria: ["Selecciona una categoría activa."],
    });
  }

  const hasDuplicateName = await validateDuplicateProductName(
    parsed.data.nombre_producto,
  );

  if (hasDuplicateName) {
    return productError(values, "Ya existe un producto con ese nombre.", {
      nombre_producto: ["Ya existe un producto con ese nombre."],
    });
  }

  let idProducto = "";

  try {
    await prisma.$transaction(async (tx) => {
      idProducto = await getNextCorrelativeId(tx, {
        codigoEntidad: "producto",
        prefijo: "PRO",
      });

      await tx.producto.create({
        data: {
          id_producto: idProducto,
          nombre_producto: parsed.data.nombre_producto,
          categoria: parsed.data.categoria,
          descripcion: emptyToNull(formData.get("descripcion")),
          unidad_medida: parsed.data.unidad_medida,
          precio_referencial: parsed.data.precio_referencial ?? null,
          estado: true,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "producto",
        id_registro_afectado: idProducto,
        accion: "crear",
        detalle: `Producto creado: ${parsed.data.nombre_producto}`,
        tx,
      });
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe un producto con ese nombre.",
    );

    return productError(
      values,
      errorMessage,
      errorMessage === "Ya existe un producto con ese nombre."
        ? { nombre_producto: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(PRODUCTS_PATH);

  return productSaved(values, idProducto);
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const values = getProductFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return productError(values, "No tienes permisos para actualizar productos.");
  }

  const idProducto = formData.get("id_producto")?.toString();

  if (!idProducto) {
    return productError(values, "El producto no existe.");
  }

  const product = await prisma.producto.findUnique({
    where: {
      id_producto: idProducto,
    },
    select: {
      id_producto: true,
      categoria: true,
    },
  });

  if (!product) {
    return productError(values, "El producto no existe.");
  }

  const rawData = getProductFormData(formData);
  const parsed = productSchema.safeParse(rawData);

  if (!parsed.success) {
    return productError(values, "Revisa los datos del producto.", parsed.error.flatten().fieldErrors);
  }

  const categoryIsActive = await validateActiveCategory(
    parsed.data.categoria,
    product.categoria,
  );

  if (!categoryIsActive) {
    return productError(values, "Selecciona una categoría activa.", {
      categoria: ["Selecciona una categoría activa."],
    });
  }

  const hasDuplicateName = await validateDuplicateProductName(
    parsed.data.nombre_producto,
    idProducto,
  );

  if (hasDuplicateName) {
    return productError(values, "Ya existe otro producto con ese nombre.", {
      nombre_producto: ["Ya existe otro producto con ese nombre."],
    });
  }

  try {
    await prisma.producto.update({
      where: {
        id_producto: idProducto,
      },
      data: {
        nombre_producto: parsed.data.nombre_producto,
        categoria: parsed.data.categoria,
        descripcion: emptyToNull(formData.get("descripcion")),
        unidad_medida: parsed.data.unidad_medida,
        precio_referencial: parsed.data.precio_referencial ?? null,
      },
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe otro producto con ese nombre.",
    );

    return productError(
      values,
      errorMessage,
      errorMessage === "Ya existe otro producto con ese nombre."
        ? { nombre_producto: [errorMessage] }
        : undefined,
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "producto",
    id_registro_afectado: idProducto,
    accion: "actualizar",
    detalle: `Producto actualizado: ${parsed.data.nombre_producto}`,
  });

  revalidatePath(PRODUCTS_PATH);

  return productSaved(values, idProducto);
}

// Activar o inactivar desde la fila (ConfirmActionButton, entrega 10.4a):
// devuelve el resultado en lugar de redirigir, y un error (sin permiso, ya
// tenia ese estado o no existe) queda en la confirmacion.
export async function toggleProductStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const idProducto = formData.get("id_producto")?.toString().trim() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return statusToggleError(idProducto, "No tienes permisos para activar o inactivar productos.");
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idProducto) {
    return statusToggleError(idProducto, "El producto no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(idProducto, "Estado no válido.");
  }

  // Fija el estado pedido solo si el producto tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton.
  const { count } = await prisma.producto.updateMany({
    where: {
      id_producto: idProducto,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  const product = await prisma.producto.findUnique({
    where: {
      id_producto: idProducto,
    },
    select: {
      nombre_producto: true,
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      idProducto,
      product ? `El producto ya estaba ${nextStatus ? "activo" : "inactivo"}.` : "El producto no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "producto",
    id_registro_afectado: idProducto,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Producto ${nextStatus ? "activado" : "inactivado"}: ${
      product?.nombre_producto ?? idProducto
    }`,
  });

  revalidatePath(PRODUCTS_PATH);

  return statusToggleDone(idProducto, nextStatus);
}

export async function createProductCategoryAction(
  _prevState: ProductCategoryFormState,
  formData: FormData,
): Promise<ProductCategoryFormState> {
  const values = getCategoryFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return categoryError(values, "No tienes permisos para gestionar categorías de producto.");
  }

  const parsed = productCategorySchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return categoryError(values, "Revisa los datos de la categoría.", parsed.error.flatten().fieldErrors);
  }

  const categoryName = parsed.data.nombre;
  const slug = slugify(categoryName);

  if (!slug) {
    return categoryError(values, "El nombre de la categoría debe incluir letras o números.", {
      nombre: ["El nombre de la categoría debe incluir letras o números."],
    });
  }

  const existingCategory = await prisma.categoria_producto.findFirst({
    where: {
      OR: [{ nombre: categoryName }, { slug }],
    },
    select: {
      id_categoria_producto: true,
    },
  });

  if (existingCategory) {
    return categoryError(values, "Ya existe una categoría de producto con ese nombre.", {
      nombre: ["Ya existe una categoría de producto con ese nombre."],
    });
  }

  let idCategoriaProducto = "";

  try {
    await prisma.$transaction(async (tx) => {
      idCategoriaProducto = await getNextCorrelativeId(tx, {
        codigoEntidad: "categoria_producto",
        prefijo: "CPR",
      });

      await tx.categoria_producto.create({
        data: {
          id_categoria_producto: idCategoriaProducto,
          nombre: categoryName,
          slug,
          descripcion: emptyToNull(formData.get("descripcion")),
          estado: true,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "categoria_producto",
        id_registro_afectado: idCategoriaProducto,
        accion: "crear",
        detalle: `Categoría creada: ${categoryName}`,
        tx,
      });
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe una categoría de producto con ese nombre.",
    );

    return categoryError(
      values,
      errorMessage,
      errorMessage === "Ya existe una categoría de producto con ese nombre."
        ? { nombre: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(PRODUCT_CATEGORIES_PATH);
  revalidatePath(PRODUCTS_PATH);

  return categorySaved(values, idCategoriaProducto);
}

export async function updateProductCategoryAction(
  _prevState: ProductCategoryFormState,
  formData: FormData,
): Promise<ProductCategoryFormState> {
  const values = getCategoryFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return categoryError(values, "No tienes permisos para gestionar categorías de producto.");
  }

  const idCategoriaProducto = formData
    .get("id_categoria_producto")
    ?.toString();

  if (!idCategoriaProducto) {
    return categoryError(values, "La categoría no existe.");
  }

  const category = await prisma.categoria_producto.findUnique({
    where: {
      id_categoria_producto: idCategoriaProducto,
    },
    select: {
      id_categoria_producto: true,
    },
  });

  if (!category) {
    return categoryError(values, "La categoría no existe.");
  }

  const parsed = productCategorySchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return categoryError(values, "Revisa los datos de la categoría.", parsed.error.flatten().fieldErrors);
  }

  const categoryName = parsed.data.nombre;
  const slug = slugify(categoryName);

  if (!slug) {
    return categoryError(values, "El nombre de la categoría debe incluir letras o números.", {
      nombre: ["El nombre de la categoría debe incluir letras o números."],
    });
  }

  const existingCategory = await prisma.categoria_producto.findFirst({
    where: {
      OR: [{ nombre: categoryName }, { slug }],
    },
    select: {
      id_categoria_producto: true,
    },
  });

  if (
    existingCategory &&
    existingCategory.id_categoria_producto !== idCategoriaProducto
  ) {
    return categoryError(values, "Ya existe otra categoría de producto con ese nombre.", {
      nombre: ["Ya existe otra categoría de producto con ese nombre."],
    });
  }

  try {
    await prisma.categoria_producto.update({
      where: {
        id_categoria_producto: idCategoriaProducto,
      },
      data: {
        nombre: categoryName,
        slug,
        descripcion: emptyToNull(formData.get("descripcion")),
      },
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe otra categoría de producto con ese nombre.",
    );

    return categoryError(
      values,
      errorMessage,
      errorMessage === "Ya existe otra categoría de producto con ese nombre."
        ? { nombre: [errorMessage] }
        : undefined,
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_producto",
    id_registro_afectado: idCategoriaProducto,
    accion: "actualizar",
    detalle: `Categoría actualizada: ${categoryName}`,
  });

  revalidatePath(PRODUCT_CATEGORIES_PATH);
  revalidatePath(PRODUCTS_PATH);

  return categorySaved(values, idCategoriaProducto);
}

// Activar o inactivar una categoria desde su fila, como el producto: devuelve
// el resultado y un error queda en la confirmacion.
export async function toggleProductCategoryStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const idCategoriaProducto = formData.get("id_categoria_producto")?.toString().trim() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return statusToggleError(idCategoriaProducto, "No tienes permisos para activar o inactivar categorías de producto.");
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idCategoriaProducto) {
    return statusToggleError(idCategoriaProducto, "La categoría no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(idCategoriaProducto, "Estado no válido.");
  }

  // Mismo compare-and-set que el producto.
  const { count } = await prisma.categoria_producto.updateMany({
    where: {
      id_categoria_producto: idCategoriaProducto,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  const category = await prisma.categoria_producto.findUnique({
    where: {
      id_categoria_producto: idCategoriaProducto,
    },
    select: {
      nombre: true,
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      idCategoriaProducto,
      category ? `La categoría ya estaba ${nextStatus ? "activa" : "inactiva"}.` : "La categoría no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_producto",
    id_registro_afectado: idCategoriaProducto,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Categoría ${nextStatus ? "activada" : "inactivada"}: ${
      category?.nombre ?? idCategoriaProducto
    }`,
  });

  revalidatePath(PRODUCT_CATEGORIES_PATH);
  revalidatePath(PRODUCTS_PATH);

  return statusToggleDone(idCategoriaProducto, nextStatus);
}
