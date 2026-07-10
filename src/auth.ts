import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/modules/auth/auth.schema";
import {
  assertLoginAllowed,
  getLoginClientContext,
  normalizeLoginEmail,
  recordLoginAttempt,
  runDummyPasswordCompare,
} from "@/lib/auth/login-rate-limit";

// AUTH_SECRET/AUTH_URL/AUTH_TRUST_HOST se validan y documentan en
// src/lib/env.ts (importado transitivamente via @/lib/db), pero
// deliberadamente no se pasan aqui de forma explicita: Auth.js v5 ya las
// lee directamente de process.env por convencion propia, y fijarlas a mano
// podria alterar como resuelve el host de confianza en produccion (Vercel).

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
        const correoNormalizado = normalizeLoginEmail(email);
        const { ipHash, userAgentHash } = await getLoginClientContext();

        // Rate limit por correo/IP antes de tocar la base de usuarios: un
        // correo o IP con demasiados fallos recientes no debe ni siquiera
        // llegar a comparar contraseña.
        const allowedResult = await assertLoginAllowed(
          correoNormalizado,
          ipHash,
        );

        if (!allowedResult.allowed) {
          // Se ejecuta un bcrypt.compare dummy para que el bloqueo por rate
          // limit tarde lo mismo que un intento normal.
          await runDummyPasswordCompare(password);
          await recordLoginAttempt({
            correoNormalizado,
            ipHash,
            userAgentHash,
            resultado: "bloqueado",
            motivo: allowedResult.motivo,
          });

          return null;
        }

        const user = await prisma.usuario.findUnique({
          where: {
            correo: correoNormalizado,
          },
          include: {
            rol: true,
          },
        });

        if (!user) {
          // Usuario inexistente: se compara contra un hash dummy para que el
          // tiempo de respuesta sea equivalente al de una contraseña
          // incorrecta y no permita enumerar correos por timing.
          await runDummyPasswordCompare(password);
          await recordLoginAttempt({
            correoNormalizado,
            ipHash,
            userAgentHash,
            resultado: "fallido",
            motivo: "usuario_inexistente",
          });

          return null;
        }

        // La comparacion siempre corre contra el hash real, sin importar si
        // el usuario esta activo: el estado se evalua recien despues, para
        // no filtrar por timing si una cuenta esta inactiva.
        const passwordIsValid = await bcrypt.compare(
          password,
          user.clave_hash,
        );

        if (!passwordIsValid) {
          await recordLoginAttempt({
            correoNormalizado,
            ipHash,
            userAgentHash,
            resultado: "fallido",
            motivo: "contrasena_incorrecta",
          });

          return null;
        }

        if (user.estado !== "activo") {
          await recordLoginAttempt({
            correoNormalizado,
            ipHash,
            userAgentHash,
            resultado: "fallido",
            motivo: "usuario_inactivo",
          });

          return null;
        }

        await recordLoginAttempt({
          correoNormalizado,
          ipHash,
          userAgentHash,
          resultado: "exitoso",
        });

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
        logger.error(
          "No se pudo revalidar la sesion del usuario contra la base de datos.",
          { error },
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
