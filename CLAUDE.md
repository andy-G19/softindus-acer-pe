# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Spanish-language internal ERP for **Aceros Perú** (a steel fabrication workshop): commercial (clients/quotes/orders/payments), inventory, production, costing, petty cash, maintenance, staff, and reporting. Domain code — Prisma models, columns, enums, UI copy, toast keys — is in **Spanish** (`cliente`, `bitacora_operacion`, `estado`). Keep new domain code Spanish to match; framework/glue code is English.

## Commands

```bash
npm run dev            # next dev
npm run build          # next build
npm run lint           # eslint (flat config, eslint.config.mjs)

npm run db:migrate     # prisma migrate dev  (creates + applies a migration)
npm run db:generate    # prisma generate  (regenerate client after schema edits)
npm run db:seed        # tsx prisma/seed.ts
npm run db:studio      # prisma studio
npm run db:validate    # prisma validate
```

There is no test runner configured. `postinstall` runs `prisma generate` automatically.

## Critical, non-obvious conventions

- **Prisma client is generated into the repo**, not `node_modules`. Import types/values from `@/generated/prisma/client` — **never** `@prisma/client`. After any `schema.prisma` change run `npm run db:generate`. Connection goes through the `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`); Postgres schema is `aceros`.
- **Middleware lives in `src/proxy.ts`**, exported as `proxy` (this Next.js version renamed `middleware`). It is the route-level auth gate. See AGENTS.md — this Next.js has breaking changes; check `node_modules/next/dist/docs/` before assuming an API.
- **IDs are application-generated strings**, not DB sequences. Use `buildNextId(prefix, lastId)` / `buildNextIds` from [src/lib/ids.ts](src/lib/ids.ts): a 3-char prefix + 8-digit zero-padded counter (e.g. `CLI00000001`), stored as `Char(11)`. Fetch the current max id with `findFirst({ orderBy: { id_...: "desc" } })` before inserting.
- Always import `prisma` from `@/lib/db` (singleton; avoids dev hot-reload connection leaks). Path alias `@/*` → `src/*`.

## Authorization — two layers, both required

Roles are `ADMIN`, `SELLER`, `WORKSHOP_MASTER` (constants in [src/lib/permissions.ts](src/lib/permissions.ts); the DB role name is copied onto the JWT/session in [src/auth.ts](src/auth.ts)).

1. **Route guard** — `proxy.ts` calls `canAccessDashboardRoute(role, pathname)`, matched against the `dashboardRoutes` table in `lib/permissions.ts`. **Adding a dashboard route requires adding an entry there**, or it 302s to `/dashboard/access-denied`. `showInMenu: false` hides a route from the sidebar while still granting access.
2. **In-code checks** — the middleware guard is not enough. Every page (RSC) and server action re-checks: pages call `auth()` then redirect on missing session / wrong role; helpers `requireAuth()` / `requireRole([...])` live in [src/lib/authz.ts](src/lib/authz.ts). Server actions do their own role check and return an error state instead of redirecting.

## Feature anatomy

A feature is split across three trees, by area (`commercial`, `inventory`, `production`, `costs`, `petty-cash`, `maintenance`, `staff`, `reports`, …):

- `src/app/(dashboard)/dashboard/<area>/<feature>/` — **RSC pages** that read `searchParams` (a `Promise` — must be awaited), enforce auth, query Prisma directly, and render. `new/`, `[id]/`, `[id]/edit/` subroutes follow.
- `src/modules/<area>/<feature>/actions.ts` — `"use server"` **server actions** + the feature's form components (`*-form.tsx`).
- `src/schemas/<area>/*.schema.ts` — Zod validation shared by action + form.

### Server action pattern (mutations)

Follow the shape in [src/modules/commercial/clients/actions.ts](src/modules/commercial/clients/actions.ts):

1. Auth/role check → return `{ error }` state if unauthorized (do not throw).
2. `schema.safeParse(rawData)` → on failure return `{ error, fieldErrors: parsed.error.flatten().fieldErrors }`.
3. Business validation (e.g. duplicate document), then generate id with `buildNextId`, then `prisma.<model>.create/update`.
4. `registerAuditLog({ userId, entidad_afectada, id_registro_afectado, accion, detalle })` — from [src/lib/audit.ts](src/lib/audit.ts); writes to `bitacora_operacion`, swallows its own errors, and accepts a `tx` client to run inside a transaction.
5. `revalidatePath(...)` then `redirect(\`${path}?toast=<key>\`)`. Toasts are surfaced via the `?toast=` search param and rendered client-side.

Actions used with `useActionState` take `(prevState, formData)` and return a typed `FormState`.

## Stack notes

- UI: shadcn (style `radix-nova`, base color neutral) in `src/components/ui`, `radix-ui`, `lucide-react`, Tailwind v4 (config-less, via `@tailwindcss/postcss`; theme in `src/app/globals.css`).
- Notifications: `sweetalert2` (confirm dialogs) + `react-toastify` (toasts) wrapped in [src/lib/notifications.ts](src/lib/notifications.ts) — a `"use client"` module.
- Exports: `exceljs`, `pdfkit`, and CSV helpers under `src/lib/*-export.ts`. `pdfkit` is in `serverExternalPackages` (next.config.ts) — keep PDF generation server-side.
- Env: `DATABASE_URL` (required), `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL` — see `.env.example`. DB is Supabase Postgres.
