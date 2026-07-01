import "dotenv/config";

import bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const roles = [
  {
    id_rol: "ROL00000001",
    nombre_rol: "ADMIN",
    descripcion: "Usuario con acceso total al sistema.",
    estado: true,
  },
  {
    id_rol: "ROL00000002",
    nombre_rol: "SELLER",
    descripcion: "Usuario responsable del módulo comercial: clientes, pedidos, proformas, pagos y comprobantes.",
    estado: true,
  },
  {
    id_rol: "ROL00000003",
    nombre_rol: "WORKSHOP_MASTER",
    descripcion: "Usuario responsable de producción, órdenes de trabajo, avances e inventario operativo.",
    estado: true,
  },
];

const users = [
  {
    id_usuario: "USU00000001",
    id_rol: "ROL00000001",
    nombres: "Administrador",
    apellidos: "General",
    usuario: "admin",
    correo: "admin@acerosperu.com",
    password: "Admin123*",
    estado: "activo",
  },
  {
    id_usuario: "USU00000002",
    id_rol: "ROL00000002",
    nombres: "Vendedor",
    apellidos: "Comercial",
    usuario: "vendedor",
    correo: "vendedor@acerosperu.com",
    password: "Vendedor123*",
    estado: "activo",
  },
  {
    id_usuario: "USU00000003",
    id_rol: "ROL00000003",
    nombres: "Maestro",
    apellidos: "Taller",
    usuario: "maestro",
    correo: "maestro@acerosperu.com",
    password: "Maestro123*",
    estado: "activo",
  },
];

const productCategories = [
  {
    id_categoria_producto: "CPR00000001",
    nombre: "Lampa",
    slug: "lampa",
    descripcion: "Categoria base para productos tipo lampa.",
    estado: true,
  },
  {
    id_categoria_producto: "CPR00000002",
    nombre: "Rastrillo",
    slug: "rastrillo",
    descripcion: "Categoria base para productos tipo rastrillo.",
    estado: true,
  },
  {
    id_categoria_producto: "CPR00000003",
    nombre: "Tripode",
    slug: "tripode",
    descripcion: "Categoria base para productos tipo tripode.",
    estado: true,
  },
  {
    id_categoria_producto: "CPR00000004",
    nombre: "Otro",
    slug: "otro",
    descripcion: "Categoria base para productos generales.",
    estado: true,
  },
];

const materialCategories = [
  {
    id_categoria_material: "CMA00000001",
    nombre: "Materia prima",
    slug: "materia_prima",
    descripcion: "Categoria base para materias primas.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000002",
    nombre: "Consumible",
    slug: "consumible",
    descripcion: "Categoria base para consumibles.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000003",
    nombre: "Repuesto",
    slug: "repuesto",
    descripcion: "Categoria base para repuestos.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000004",
    nombre: "Herramienta",
    slug: "herramienta",
    descripcion: "Categoria base para herramientas.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000005",
    nombre: "Otro",
    slug: "otro",
    descripcion: "Categoria base para otros materiales.",
    estado: true,
  },
];

const supplierTypes = [
  {
    id_tipo_proveedor: "TPR00000001",
    nombre: "Materia prima",
    slug: "materia_prima",
    descripcion: "Tipo base para proveedores de materia prima.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000002",
    nombre: "Consumibles",
    slug: "consumibles",
    descripcion: "Tipo base para proveedores de consumibles.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000003",
    nombre: "Repuestos",
    slug: "repuestos",
    descripcion: "Tipo base para proveedores de repuestos.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000004",
    nombre: "Servicios",
    slug: "servicios",
    descripcion: "Tipo base para proveedores de servicios.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000005",
    nombre: "Otros",
    slug: "otros",
    descripcion: "Tipo base para otros proveedores.",
    estado: true,
  },
];

async function main() {
  console.log("Iniciando seed oficial de Aceros Perú...");

  console.log("Creando roles...");

  for (const role of roles) {
    await prisma.rol.upsert({
      where: {
        id_rol: role.id_rol,
      },
      update: {
        nombre_rol: role.nombre_rol,
        descripcion: role.descripcion,
        estado: role.estado,
      },
      create: role,
    });

    console.log(`Rol creado/actualizado: ${role.nombre_rol}`);
  }

  console.log("Creando usuarios...");

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await prisma.usuario.upsert({
      where: {
        id_usuario: user.id_usuario,
      },
      update: {
        id_rol: user.id_rol,
        nombres: user.nombres,
        apellidos: user.apellidos,
        usuario: user.usuario,
        correo: user.correo,
        clave_hash: passwordHash,
        estado: user.estado,
      },
      create: {
        id_usuario: user.id_usuario,
        id_rol: user.id_rol,
        nombres: user.nombres,
        apellidos: user.apellidos,
        usuario: user.usuario,
        correo: user.correo,
        clave_hash: passwordHash,
        estado: user.estado,
      },
    });

    console.log(`Usuario creado/actualizado: ${user.correo}`);
  }

  console.log("Creando categorias base de productos...");

  for (const category of productCategories) {
    await prisma.categoria_producto.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        nombre: category.nombre,
        descripcion: category.descripcion,
        estado: category.estado,
      },
      create: category,
    });

    console.log(`Categoria de producto creada/actualizada: ${category.nombre}`);
  }

  console.log("Creando categorias base de materiales...");

  for (const category of materialCategories) {
    await prisma.categoria_material.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        nombre: category.nombre,
        descripcion: category.descripcion,
        estado: category.estado,
      },
      create: category,
    });

    console.log(`Categoria de material creada/actualizada: ${category.nombre}`);
  }

  console.log("Creando tipos base de proveedor...");

  for (const supplierType of supplierTypes) {
    await prisma.tipo_proveedor_catalogo.upsert({
      where: {
        slug: supplierType.slug,
      },
      update: {
        nombre: supplierType.nombre,
        descripcion: supplierType.descripcion,
        estado: supplierType.estado,
      },
      create: supplierType,
    });

    console.log(`Tipo de proveedor creado/actualizado: ${supplierType.nombre}`);
  }

  console.log("Seed oficial completado correctamente.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
