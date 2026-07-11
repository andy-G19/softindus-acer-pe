# Sistema de Gestión Integral — Industrias Aceros Perú

ERP web interno para taller metalúrgico. Cubre gestión comercial (clientes,
productos, pedidos, proformas, pagos, comprobantes), inventario, producción,
mermas y chatarra, costos y rentabilidad, caja chica, personal,
mantenimiento, reportes/exportaciones y auditoría de operaciones.

Es un sistema **interno**, no público: no está pensado para indexación en
buscadores ni para acceso anónimo (ver [Seguridad implementada](#seguridad-implementada)).

## Stack técnico

- [Next.js](https://nextjs.org) (App Router)
- TypeScript
- React
- Tailwind CSS
- [shadcn/ui](https://ui.shadcn.com)
- [Auth.js / NextAuth v5](https://authjs.dev)
- [Prisma](https://www.prisma.io)
- PostgreSQL / [Supabase](https://supabase.com)
- [Vercel](https://vercel.com) (hosting)
- [Vitest](https://vitest.dev) (tests)
- GitHub Actions (CI)

## Roles

- `ADMIN` — acceso total al sistema.
- `SELLER` — módulo comercial.
- `WORKSHOP_MASTER` — inventario, producción, mantenimiento y personal.

Los permisos por ruta se definen en `src/lib/permissions.ts` y se aplican en
dos capas: el guard de rutas (`src/proxy.ts`) y el chequeo en código de cada
página/Server Action (`src/lib/authz.ts`).

## Módulos principales

- Seguridad y usuarios
- Comercial (clientes, productos, pedidos, proformas, pagos, comprobantes)
- Inventario (materiales, proveedores, compras, movimientos, alertas de stock)
- Producción (recetas, rutas de fabricación, campañas, órdenes de trabajo, avances)
- Mermas y chatarra
- Costos y rentabilidad
- Caja chica
- Personal (operarios, asistencia, tareas, planillas)
- Mantenimiento (máquinas, fallas, reparaciones, mantenimiento preventivo)
- Dashboard y reportes (exportación a PDF/Excel)
- Auditoría (bitácora de operaciones)

## Variables de entorno

Ver [.env.example](.env.example) para la referencia completa (sin valores
reales). Validadas centralmente en `src/lib/env.ts`, que hace fallar el
arranque de la app si falta alguna obligatoria.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL (Supabase). La app no arranca sin ella. |
| `DIRECT_URL` | No | Conexión directa a Supabase, reservada para migraciones/mantenimiento. Hoy no la consume el código de la app. |
| `AUTH_SECRET` | Sí | Secreto de Auth.js v5. Generar con `npx auth secret`. |
| `AUTH_URL` | No | URL pública del sitio. En Vercel puede resolverse automáticamente. |
| `AUTH_TRUST_HOST` | No | `"true"` o `"1"` para que Auth.js confíe en el host del request (útil en Vercel). |
| `NODE_ENV` | No | La define Next.js automáticamente (`development` en `next dev`, `production` en build/start). |

No existen variables `NEXT_PUBLIC_*` en el proyecto: no hay secretos ni
configuración expuesta al cliente.

## Comandos

```bash
npm run dev            # Servidor de desarrollo
npm run build           # Build de producción
npm run start            # Servidor de producción (tras build)
npm run lint             # ESLint
npm run test              # Vitest (una sola corrida)
npm run db:validate       # Valida prisma/schema.prisma
npm run db:generate       # Regenera el cliente de Prisma (src/generated/prisma)
npm run db:migrate        # Crea y aplica una migración (prisma migrate dev)
npm run db:seed           # Ejecuta prisma/seed.ts
npm run db:studio         # Abre Prisma Studio
```

`postinstall` ejecuta `prisma generate` automáticamente. No hay un runner de
tests E2E configurado (ver [Riesgos pendientes](docs/fase-12-estabilizacion-tecnica.md)).

## Flujo de trabajo local

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env` y completar los valores reales (nunca
   commitear `.env`)
3. Generar el cliente de Prisma: `npm run db:generate`
4. Validar el schema: `npm run db:validate`
5. Ejecutar el seed inicial: `npm run db:seed`
6. Crear el primer administrador (ver [Bootstrap del primer administrador](#bootstrap-del-primer-administrador))
7. Levantar el servidor de desarrollo: `npm run dev`

## Bootstrap del primer administrador

`prisma/seed.ts` **no crea usuarios**: solo siembra roles y catálogos
estructurales. La creación del primer usuario `ADMIN` es un paso manual y
excepcional, separado a propósito para no dejar contraseñas conocidas en el
repositorio ni reiniciarlas accidentalmente en cada `npm run db:seed`.

1. Verifique primero cuál es la `DATABASE_URL` activa en su entorno (sin
   imprimirla) para confirmar que apunta a la base correcta antes de
   continuar.
2. Configure temporalmente las variables `BOOTSTRAP_ADMIN_*` (ver
   `.env.example`), incluyendo `BOOTSTRAP_ADMIN_CONFIRM="CREATE_INITIAL_ADMIN"`
   como confirmación explícita.
3. Ejecute:

   ```bash
   npm run bootstrap:admin
   ```

4. El script aborta sin modificar nada si ya existe cualquier usuario con rol
   `ADMIN` (activo, inactivo o bloqueado), o si el correo/usuario solicitado
   ya está en uso.
5. Al terminar, elimine las variables `BOOTSTRAP_ADMIN_*` del entorno: no
   deben quedar configuradas de forma permanente.
6. Los usuarios `SELLER` y `WORKSHOP_MASTER` (y cualquier `ADMIN` adicional)
   se crean después desde el módulo administrativo **Usuarios** de la propia
   aplicación, ya autenticado como `ADMIN`.

Este comando es exclusivamente manual: nunca debe integrarse en el build de
Vercel, en `postinstall` ni en ningún pipeline de despliegue o CI.

## Flujo de despliegue (Vercel + Supabase)

1. Supabase actúa como base de datos PostgreSQL (schema `aceros`).
2. Vercel aloja la aplicación Next.js.
3. Configurar en Vercel las variables de entorno de producción
   (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`/`AUTH_TRUST_HOST` según
   corresponda).
4. Build: `npm run build`.
5. Migraciones en producción: `npx prisma migrate deploy` (no usar
   `migrate dev` contra una base de datos productiva).

Ver el checklist completo en
[docs/checklist-despliegue-vercel-supabase.md](docs/checklist-despliegue-vercel-supabase.md).

## Seguridad implementada

- Sesión revalidada contra la base de datos en cada request (usuario/rol
  actual, no solo el JWT).
- Usuarios inactivos bloqueados automáticamente, incluso con un JWT válido.
- Rate limit y bloqueo temporal de login, con protección anti timing-attack.
- IDs con correlativos transaccionales (`SELECT ... FOR UPDATE` sobre
  `correlativo_sistema`), sin colisiones bajo concurrencia.
- Guards centralizados para Server Actions y rutas API
  (`src/lib/authz.ts`).
- Logger centralizado que redacta claves sensibles (`src/lib/logger.ts`).
- Manejo de errores centralizado que nunca filtra detalles internos al
  cliente (`src/lib/errors.ts`).
- Security headers HTTP (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS en producción, CSP en modo
  Report-Only) — `src/lib/security-headers.ts` + `next.config.ts`.
- `robots.txt` con `Disallow: /` y metadata `noindex, nofollow`: sistema
  interno, no indexable.
- CI en GitHub Actions ejecuta lint, validación de schema, tests y build en
  cada push/PR a `main`.

## Pruebas

- Unitarias con Vitest (`npm run test`), incluidas en CI.
- CI en `.github/workflows/ci.yml`: `db:generate` → `db:validate` → `lint`
  → `test` → `build`.
- Checklists manuales en `docs/`:
  [pruebas de seguridad](docs/pruebas-seguridad.md),
  [pruebas integrales por rol](docs/checklist-pruebas-integrales.md).

## Estado actual

La **Fase 12 de estabilización técnica** fue completada: concurrencia de
inventario, IDs seguros, sesión revalidada, rate limit de login,
env/logger/errores centralizados, guards centralizados, tests + CI, gestión
de usuarios, paginación, reportes/exportaciones con límites seguros,
hardening HTTP para Vercel, y cierre técnico con auditoría y documentación
final. Detalle completo en
[docs/fase-12-estabilizacion-tecnica.md](docs/fase-12-estabilizacion-tecnica.md).
