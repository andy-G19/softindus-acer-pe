import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  UserRole,
  UserStatus,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const users = [
  {
    name: "Administrador",
    email: "admin@acerosperu.com",
    password: "Admin123*",
    role: UserRole.ADMIN,
  },
  {
    name: "Vendedor",
    email: "vendedor@acerosperu.com",
    password: "Vendedor123*",
    role: UserRole.SELLER,
  },
  {
    name: "Maestro de Taller",
    email: "maestro@acerosperu.com",
    password: "Maestro123*",
    role: UserRole.WORKSHOP_MASTER,
  },
];

async function main() {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    const savedUser = await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        status: UserStatus.ACTIVE,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        status: UserStatus.ACTIVE,
      },
    });

    console.log("Usuario creado o actualizado:");
    console.log({
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
      status: savedUser.status,
    });
  }
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });