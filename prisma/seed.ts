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