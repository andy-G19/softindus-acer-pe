import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/db";
import { loginSchema } from "@/modules/auth/auth.schema";

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 5 * 60;

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
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
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
        // Inicio de sesion: el usuario ya viene fresco desde authorize().
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;

        return token;
      }

      if (!token.id) {
        return token;
      }

      // Revalidacion contra base de datos en cada obtencion de sesion:
      // un usuario desactivado, eliminado o con rol cambiado no debe
      // conservar los permisos que tenia al momento de iniciar sesion.
      try {
        const dbUser = await prisma.usuario.findUnique({
          where: {
            id_usuario: token.id as string,
          },
          select: {
            estado: true,
            rol: {
              select: {
                nombre_rol: true,
              },
            },
          },
        });

        if (!dbUser || dbUser.estado !== "activo") {
          token.id = undefined;
          token.role = undefined;
          token.status = "inactivo";

          return token;
        }

        token.role = dbUser.rol.nombre_rol;
        token.status = dbUser.estado;
      } catch (error) {
        console.error(
          "No se pudo revalidar la sesion del usuario contra la base de datos.",
          error,
        );

        // Ante un error de base de datos, no se conceden permisos: se
        // invalida la sesion en vez de conservar el estado antiguo del token.
        token.id = undefined;
        token.role = undefined;
        token.status = "inactivo";
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? "";
        session.user.role = (token.role as string | undefined) ?? "";
        session.user.status = (token.status as string | undefined) ?? "inactivo";
      }

      return session;
    },
  },
});
