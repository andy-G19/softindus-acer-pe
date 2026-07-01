"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { productCategorySchema } from "@/schemas/commercial/product-category.schema";
import { productSchema } from "@/schemas/commercial/product.schema";

export type ProductFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

export type ProductCategoryFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const PRODUCTS_PATH = "/dashboard/commercial/products";
const PRODUCT_CATEGORIES_PATH = "/dashboard/commercial/product-categories";
const initialProductState: ProductFormState = { error: "" };
const initialCategoryState: ProductCategoryFormState = { error: "" };

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

async function requireAdminProductPermission() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  return session;
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

async function validateActiveCategory(slug: string) {
  const category = await prisma.categoria_producto.findUnique({
    where: {
      slug,
    },
    select: {
      estado: true,
    },
  });

  return Boolean(category?.estado);
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
  const session = await requireAdminProductPermission();
  const rawData = getProductFormData(formData);
  const parsed = productSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos del producto.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const categoryIsActive = await validateActiveCategory(parsed.data.categoria);

  if (!categoryIsActive) {
    return {
      error: "Selecciona una categoría activa.",
      fieldErrors: {
        categoria: ["Selecciona una categoría activa."],
      },
    };
  }

  const hasDuplicateName = await validateDuplicateProductName(
    parsed.data.nombre_producto,
  );

  if (hasDuplicateName) {
    return {
      error: "Ya existe un producto con ese nombre.",
      fieldErrors: {
        nombre_producto: ["Ya existe un producto con ese nombre."],
      },
    };
  }

  const lastProduct = await prisma.producto.findFirst({
    orderBy: {
      id_producto: "desc",
    },
    select: {
      id_producto: true,
    },
  });

  const idProducto = buildNextId("PRO", lastProduct?.id_producto);

  try {
    await prisma.producto.create({
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
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe un producto con ese nombre.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe un producto con ese nombre."
          ? { nombre_producto: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "producto",
    id_registro_afectado: idProducto,
    accion: "crear",
    detalle: `Producto creado: ${parsed.data.nombre_producto}`,
  });

  revalidatePath(PRODUCTS_PATH);
  redirect(PRODUCTS_PATH);

  return initialProductState;
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireAdminProductPermission();
  const idProducto = formData.get("id_producto")?.toString();

  if (!idProducto) {
    return {
      error: "El producto no existe.",
    };
  }

  const product = await prisma.producto.findUnique({
    where: {
      id_producto: idProducto,
    },
    select: {
      id_producto: true,
    },
  });

  if (!product) {
    return {
      error: "El producto no existe.",
    };
  }

  const rawData = getProductFormData(formData);
  const parsed = productSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos del producto.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const categoryIsActive = await validateActiveCategory(parsed.data.categoria);

  if (!categoryIsActive) {
    return {
      error: "Selecciona una categoría activa.",
      fieldErrors: {
        categoria: ["Selecciona una categoría activa."],
      },
    };
  }

  const hasDuplicateName = await validateDuplicateProductName(
    parsed.data.nombre_producto,
    idProducto,
  );

  if (hasDuplicateName) {
    return {
      error: "Ya existe otro producto con ese nombre.",
      fieldErrors: {
        nombre_producto: ["Ya existe otro producto con ese nombre."],
      },
    };
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

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe otro producto con ese nombre."
          ? { nombre_producto: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "producto",
    id_registro_afectado: idProducto,
    accion: "actualizar",
    detalle: `Producto actualizado: ${parsed.data.nombre_producto}`,
  });

  revalidatePath(PRODUCTS_PATH);
  redirect(PRODUCTS_PATH);

  return initialProductState;
}

export async function toggleProductStatusAction(formData: FormData) {
  const session = await requireAdminProductPermission();
  const idProducto = formData.get("id_producto")?.toString();

  if (!idProducto) {
    redirect(PRODUCTS_PATH);
  }

  const product = await prisma.producto.findUnique({
    where: {
      id_producto: idProducto,
    },
    select: {
      id_producto: true,
      nombre_producto: true,
      estado: true,
    },
  });

  if (!product) {
    redirect(PRODUCTS_PATH);
  }

  const nextStatus = !product.estado;

  await prisma.producto.update({
    where: {
      id_producto: product.id_producto,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "producto",
    id_registro_afectado: product.id_producto,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Producto ${nextStatus ? "activado" : "inactivado"}: ${
      product.nombre_producto
    }`,
  });

  revalidatePath(PRODUCTS_PATH);
  redirect(PRODUCTS_PATH);
}

export async function createProductCategoryAction(
  _prevState: ProductCategoryFormState,
  formData: FormData,
): Promise<ProductCategoryFormState> {
  const session = await requireAdminProductPermission();
  const parsed = productCategorySchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la categoría.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const categoryName = parsed.data.nombre;
  const slug = slugify(categoryName);

  if (!slug) {
    return {
      error: "El nombre de la categoría debe incluir letras o números.",
      fieldErrors: {
        nombre: ["El nombre de la categoría debe incluir letras o números."],
      },
    };
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
    return {
      error: "Ya existe una categoría de producto con ese nombre.",
      fieldErrors: {
        nombre: ["Ya existe una categoría de producto con ese nombre."],
      },
    };
  }

  const lastCategory = await prisma.categoria_producto.findFirst({
    orderBy: {
      id_categoria_producto: "desc",
    },
    select: {
      id_categoria_producto: true,
    },
  });

  const idCategoriaProducto = buildNextId(
    "CPR",
    lastCategory?.id_categoria_producto,
  );

  try {
    await prisma.categoria_producto.create({
      data: {
        id_categoria_producto: idCategoriaProducto,
        nombre: categoryName,
        slug,
        descripcion: emptyToNull(formData.get("descripcion")),
        estado: true,
      },
    });
  } catch (error) {
    const errorMessage = getPrismaUniqueErrorMessage(
      error,
      "Ya existe una categoría de producto con ese nombre.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe una categoría de producto con ese nombre."
          ? { nombre: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_producto",
    id_registro_afectado: idCategoriaProducto,
    accion: "crear",
    detalle: `Categoría creada: ${categoryName}`,
  });

  revalidatePath(PRODUCT_CATEGORIES_PATH);
  revalidatePath(PRODUCTS_PATH);

  return initialCategoryState;
}

export async function updateProductCategoryAction(
  _prevState: ProductCategoryFormState,
  formData: FormData,
): Promise<ProductCategoryFormState> {
  const session = await requireAdminProductPermission();
  const idCategoriaProducto = formData
    .get("id_categoria_producto")
    ?.toString();

  if (!idCategoriaProducto) {
    return {
      error: "La categoría no existe.",
    };
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
    return {
      error: "La categoría no existe.",
    };
  }

  const parsed = productCategorySchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la categoría.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const categoryName = parsed.data.nombre;
  const slug = slugify(categoryName);

  if (!slug) {
    return {
      error: "El nombre de la categoría debe incluir letras o números.",
      fieldErrors: {
        nombre: ["El nombre de la categoría debe incluir letras o números."],
      },
    };
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
    return {
      error: "Ya existe otra categoría de producto con ese nombre.",
      fieldErrors: {
        nombre: ["Ya existe otra categoría de producto con ese nombre."],
      },
    };
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

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe otra categoría de producto con ese nombre."
          ? { nombre: [errorMessage] }
          : undefined,
    };
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

  return initialCategoryState;
}

export async function toggleProductCategoryStatusAction(formData: FormData) {
  const session = await requireAdminProductPermission();
  const idCategoriaProducto = formData
    .get("id_categoria_producto")
    ?.toString();

  if (!idCategoriaProducto) {
    redirect(PRODUCT_CATEGORIES_PATH);
  }

  const category = await prisma.categoria_producto.findUnique({
    where: {
      id_categoria_producto: idCategoriaProducto,
    },
    select: {
      id_categoria_producto: true,
      nombre: true,
      estado: true,
    },
  });

  if (!category) {
    redirect(PRODUCT_CATEGORIES_PATH);
  }

  const nextStatus = !category.estado;

  await prisma.categoria_producto.update({
    where: {
      id_categoria_producto: category.id_categoria_producto,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_producto",
    id_registro_afectado: category.id_categoria_producto,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Categoría ${nextStatus ? "activada" : "inactivada"}: ${
      category.nombre
    }`,
  });

  revalidatePath(PRODUCT_CATEGORIES_PATH);
  revalidatePath(PRODUCTS_PATH);
  redirect(PRODUCT_CATEGORIES_PATH);
}
