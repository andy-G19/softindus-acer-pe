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

npm test               # vitest run (unit tests, no DB, no real .env)
npm run test:watch     # vitest in watch mode
npm run typecheck      # next typegen + tsc --noEmit
npm run check          # FULL gate: db:generate → db:validate → lint → typecheck → test → build
                       # uses dummy env vars; never runs seed/migrate/bootstrap
npm run refactor:inventory  # regenerates docs/refactoring/INVENTARIO.md
```

Tests use **Vitest** (`vitest.config.ts`): files `*.test.ts` next to the code they test (`src/**`, `scripts/**`). Tests are pure unit tests: they must not read a real `.env` nor connect to Supabase. `postinstall` runs `prisma generate` automatically.

**`npm run check` must pass before any commit.** If it fails, fix the cause; never skip, disable or weaken a check to make it pass.

## Critical, non-obvious conventions

- **Prisma client is generated into the repo**, not `node_modules`. Import types/values from `@/generated/prisma/client` — **never** `@prisma/client`. After any `schema.prisma` change run `npm run db:generate`. Connection goes through the `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`); Postgres schema is `aceros`.
- **Middleware lives in `src/proxy.ts`**, exported as `proxy` (this Next.js version renamed `middleware`). It is the route-level auth gate. See AGENTS.md — this Next.js has breaking changes; check `node_modules/next/dist/docs/` before assuming an API.
- **IDs are application-generated strings**, not DB sequences: a 3-char prefix + 8-digit zero-padded counter (e.g. `CLI00000001`), stored as `Char(11)`. Generate them with `getNextCorrelativeId(tx, { codigoEntidad, prefijo })` / `getNextCorrelativeIds` from [src/lib/correlatives.ts](src/lib/correlatives.ts), **always inside a `prisma.$transaction`**: the counter lives in the `correlativo_sistema` table and is reserved with `SELECT ... FOR UPDATE`, so concurrent requests cannot collide. **Never** derive the next id by reading the current max (`findFirst({ orderBy: { id_...: "desc" } })`) — that races under concurrency and was removed for exactly that reason. Scripts that run outside Next.js (`tsx`) import the same implementation from `@/lib/correlatives-core`, which has no `server-only` dependency.
- Always import `prisma` from `@/lib/db` (singleton; avoids dev hot-reload connection leaks). Path alias `@/*` → `src/*`.
- **Number conversion and formatting live in one place**: `toNumber` / `toNonNegativeNumber` from [src/lib/numbers.ts](src/lib/numbers.ts), `formatMoney` / `formatDate` from [src/lib/formatters.ts](src/lib/formatters.ts). An ESLint `no-restricted-syntax` rule forbids local copies. `formatMoney(x)` only accepts a present amount: when it can be missing, decide at the call site — `formatMoney(x ?? 0)` if missing means zero, or `formatMoney(x, { emptyText: "-" })`. `formatDate` formats civil dates (`@db.Date`) in UTC (`format: "d/m/yyyy" | "dd/mm/yyyy" | "d mmm yyyy"`); for instants (`Timestamptz`) use `formatDateTime`. TypeScript treats `arr[0]` as always present (no `noUncheckedIndexedAccess`): a value reached through `?.` on an array element can be missing even if its type says otherwise.

## Authorization — two layers, both required

Roles are `ADMIN`, `SELLER`, `WORKSHOP_MASTER` (constants in [src/lib/permissions.ts](src/lib/permissions.ts); the DB role name is copied onto the JWT/session in [src/auth.ts](src/auth.ts)).

1. **Route guard** — `proxy.ts` calls `canAccessDashboardRoute(role, pathname)`, matched against the `dashboardRoutes` table in `lib/permissions.ts`. **Adding a dashboard route requires adding an entry there**, or it 302s to `/dashboard/access-denied`. `showInMenu: false` hides a route from the sidebar while still granting access.
2. **In-code checks** — the middleware guard is not enough. Every page (RSC), server action and API route re-checks, always through the helpers in [src/lib/authz.ts](src/lib/authz.ts):
   - **Pages (RSC):** `await requireRole([...])` — redirects to `/login` or `/dashboard/access-denied`.
   - **Server actions that receive only `formData` and redirect:** `const session = await requireRole([...])`, usually through a local wrapper named after the requirement (`requireAdmin`, `requireStaffManager`, …). Reference: [src/modules/costs/margins/actions.ts](src/modules/costs/margins/actions.ts).
   - **Server actions used with `useActionState`:** `const session = await getAuthorizedSession([...])`; if it returns `null`, return an error `FormState` (do not throw, do not redirect). Reference: [src/modules/commercial/clients/actions.ts](src/modules/commercial/clients/actions.ts).
   - **API routes:** `requireApiRole([...])` → returns `{ ok, session | response }` (401/403).
   - **Only `src/lib/authz.ts` and `src/proxy.ts` import `auth` from `@/auth`** — an ESLint `no-restricted-imports` rule enforces it (`signIn`, `signOut` and `handlers` stay allowed). Never read the session with `auth()` and compare `session.user.role` by hand: that skips the explicit active-user check and the rejection log.
   - ⚠️ **Known deviation — do not "fix" it inside a refactor:** many `useActionState` actions (inventory catalogs, materials, suppliers, products, orders, users, production stages, machines, spare parts, expense categories, operators) still call `requireRole` and redirect on denial instead of returning an error `FormState`. Switching them changes what the user sees, so it belongs to track B.

## Feature anatomy

A feature is split across three trees, by area (`commercial`, `inventory`, `production`, `costs`, `petty-cash`, `maintenance`, `staff`, `reports`, …):

- `src/app/(dashboard)/dashboard/<area>/<feature>/` — **RSC pages** that read `searchParams` (a `Promise` — must be awaited), enforce auth, load data through the feature's `queries.ts`, and render. `new/`, `[id]/`, `[id]/edit/` subroutes follow. Only the pages in `pagesStillWithPrisma` (costs) still query Prisma directly.
- `src/modules/<area>/<feature>/actions.ts` — `"use server"` **server actions** + the feature's form components (`*-form.tsx`).
- `src/modules/<area>/<feature>/queries.ts` — **read queries for the pages**, with `import "server-only"`. Reference: [src/modules/commercial/clients/queries.ts](src/modules/commercial/clients/queries.ts).
- `src/schemas/<area>/*.schema.ts` — Zod validation shared by action + form.

### Page query pattern (reads)

- **The page authorizes, the query does not.** The page calls `requireRole` first, as before. `requireRole` revalidates the user against the DB on every call, and each entry point rejects differently (redirect, `FormState`, 401/403), so a query that authorized would double the DB work and give the wrong response to non-page callers. When data depends on the role, the query receives the already verified session or role (like `getDashboardData(role)`).
- **The page keeps** parsing `searchParams`/`params`, `notFound()`/`redirect()`, presentation derivations and the JSX. **The query owns** everything Prisma: `where` construction (`Prisma.*WhereInput`), `select`/`include`, ordering, pagination arguments and `Promise.all`. It receives parsed values (strings, dates, `{ skip, take }`) and returns Prisma results with the field names unchanged; no DTO mapping, no React, no redirects.
- Prefer an explicit `select` with the columns the view uses: TypeScript then rejects any access to a column that is not loaded. **Never load full `usuario` rows** (they include `clave_hash`): select only what the view shows. Rows passed to a client component are serialized to the browser, so limit them to the component's prop type.
- Naming: `get*` returns the data of a page (`getOrderListData`, `getQuoteDetail`); an edit query that depends on the main record returns `null` when it does not exist and the page calls `notFound()`. `find*` returns the Prisma promise unawaited so another module can compose it in its own `Promise.all` without changing the call order: shared options live in the module that owns the entity (`findClientFilterOptions` in `clients/queries.ts`).
- Pages cannot import `@/lib/db`: an ESLint `no-restricted-imports` rule covers every `src/app/**/page.tsx`, new pages included, except the ones listed in `pagesStillWithPrisma` (`eslint.config.mjs`: costs, migrated in delivery 6). That list may only shrink. In flat config the last block that configures a rule replaces the earlier options for that file, so that block repeats the `@/auth` restriction.
- Before moving a page's queries, characterize it with the harness in [src/testing/page-characterization.ts](src/testing/page-characterization.ts): it runs the real page with Prisma, session and navigation mocked, and snapshots the Prisma calls and the normalized HTML. The same snapshots must pass unchanged after the move.

### Server action pattern (mutations)

Follow the shape in [src/modules/commercial/clients/actions.ts](src/modules/commercial/clients/actions.ts):

1. Auth/role check → return `{ error }` state if unauthorized (do not throw).
2. `schema.safeParse(rawData)` → on failure return `{ error, fieldErrors: parsed.error.flatten().fieldErrors }`.
3. Business validation (e.g. duplicate document), then open a `prisma.$transaction`, generate the id with `getNextCorrelativeId(tx, ...)`, and `tx.<model>.create/update` inside that same transaction.
4. `registerAuditLog({ userId, entidad_afectada, id_registro_afectado, accion, detalle })` — from [src/lib/audit.ts](src/lib/audit.ts); writes to `bitacora_operacion`, swallows its own errors, and accepts a `tx` client to run inside a transaction.
5. `revalidatePath(...)` then `redirect(\`${path}?toast=<key></key>\`)`. Toasts are surfaced via the `?toast=` search param and rendered client-side.

Actions used with `useActionState` take `(prevState, formData)` and return a typed `FormState`.

## Stack notes

- UI: shadcn (style `radix-nova`, base color neutral) in `src/components/ui`, `radix-ui`, `lucide-react`, Tailwind v4 (config-less, via `@tailwindcss/postcss`; theme in `src/app/globals.css`).
- Notifications: `sweetalert2` (confirm dialogs) + `react-toastify` (toasts) wrapped in [src/lib/notifications.ts](src/lib/notifications.ts) — a `"use client"` module.
- Exports: `exceljs`, `pdfkit`, and CSV helpers under `src/lib/*-export.ts`. `pdfkit` is in `serverExternalPackages` (next.config.ts) — keep PDF generation server-side.
- Report exports: `api/reports/export/[report]/route.ts` only does the HTTP part (session, report key, role with `assertRole`, format, date range, limit, export log, file). Each report has an exporter in `src/modules/reports/<report>/exporter.ts` (audit: `src/modules/audit/exporter.ts`) registered in `REPORT_EXPORTERS` (`src/modules/reports/exporters.ts`, typed `Record<ReportKey, ReportExporter>`). The page and the export build their Prisma filter with the same function in the report's `queries.ts`; where they still differ (maintenance search, staff, profitability, audit) the difference is documented next to both — unifying it is a `fix`.
- Env: `DATABASE_URL` (required), `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL` — see `.env.example`. DB is Supabase Postgres.

## Active refactor — rules (read before changing code)

The project is under a planned refactor. Master plan: [PLAN_REFACTORIZACION_INTEGRAL.md](PLAN_REFACTORIZACION_INTEGRAL.md) (section 16 has the current order). Progress, baseline metrics and next deliveries: [docs/refactoring/SEGUIMIENTO.md](docs/refactoring/SEGUIMIENTO.md).

1. **Refactor = change structure, never behavior.** Same inputs → same outputs, same UI copy, same toasts, same redirects, same permissions. If a behavior change is needed (bug fix, business rule), it goes in a **separate commit** with a `fix:`/`feat:` prefix and is explicitly called out.
2. **One delivery at a time, small steps.** Only touch the files the current delivery needs. Do not "improve" unrelated code on the way; list it as a follow-up instead.
3. **Plan first.** For any change beyond a trivial edit, present a plan (files to touch, risks, how it will be verified) and wait for approval before editing.
4. **Reuse before creating.** Check `src/lib` (`formatters.ts`, `authz.ts`, `errors.ts`, `logger.ts`, `notifications.ts`, `search-params.ts`, `pagination.ts`) and `src/components` before writing a new helper or component. Never create a parallel system next to an existing one.
5. **Stock, money and correlatives are critical.** Stock changes must be atomic at SQL level (`{ increment }` / `{ decrement }` or `SELECT ... FOR UPDATE` inside the transaction, as in `inventory/movements/actions.ts` and `production/work-orders/material-delivery.ts`). Never read a quantity, compute in JS and write it back.
6. **Tests protect the move.** Before moving logic, make sure a test covers it (add a characterization test if missing). Never delete or weaken an existing test to make a refactor pass.
7. **Verify and report.** Finish every delivery with `npm run check` and report: files changed, result of each check step, and the metrics listed in SEGUIMIENTO.md that the delivery affects.
8. **Never** run `db:migrate`, `db:seed`, `bootstrap:admin`, or anything against a real database, and never read or print `.env`, unless the user explicitly asks in that turn.

## Git workflow

- Work happens directly on the **`staging`** branch (decision of 2026-09-28). `main` is production.
- One logical change per commit, Conventional Commits in Spanish without accents in the subject, e.g. `refactor(auth): usar getAuthorizedSession en caja chica`, `fix(inventario): actualizar stock de compras de forma atomica`.
- Never commit, push, rebase or reset unless the user asks. Never use `git add -A` / `git add .` blindly: stage explicit paths and show `git status` first.
- Push to `staging` → CI + Vercel staging deploy → functional verification → PR `staging` → `main`.
