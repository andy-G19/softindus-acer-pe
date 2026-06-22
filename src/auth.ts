import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/db";
import { loginSchema } from "@/modules/auth/auth.schema";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    status: string;
  }

  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      status: string;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  providers: [
    Credentials({
      name: "Credentials",

      credentials: {
        email: {
          label: "Correo electrónico",
          type: "email",
        },
        password: {
          label: "Contraseña",
          type: "password",
        },
      },

      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { email, password } = parsedCredentials.data;

        const user = await prisma.usuario.findUnique({
          where: {
            correo: email,
          },
          include: {
            rol: true,
          },
        });

        if (!user) {
          return null;
        }

        if (user.estado !== "activo") {
          return null;
        }

        const passwordIsValid = await bcrypt.compare(
          password,
          user.clave_hash,
        );

        if (!passwordIsValid) {
          return null;
        }

        await prisma.usuario.update({
          where: {
            id_usuario: user.id_usuario,
          },
          data: {
            ultimo_acceso: new Date(),
          },
        });

        return {
          id: user.id_usuario,
          name: `${user.nombres} ${user.apellidos}`,
          email: user.correo,
          role: user.rol.nombre_rol,
          status: user.estado,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
      }

      return session;
    },
  },
});