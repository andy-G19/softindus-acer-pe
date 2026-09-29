---
description: Ejecuta la verificación completa y mide las métricas del refactor sin modificar archivos
---

Solo lectura: no edites ningún archivo.

1. Ejecuta `npm run check` y reporta el resultado de cada paso (db:generate, db:validate, lint, typecheck, test, build). Si alguno falla, muestra el error relevante y la causa probable, sin corregirlo.
2. Mide y muestra en una tabla estas métricas (usa búsqueda en archivos, excluyendo `src/generated`):
   - Líneas de los 3 archivos `.ts`/`.tsx` más grandes de `src`.
   - Páginas `page.tsx` bajo `src/app` que contienen `prisma.`.
   - Archivos en `src/modules` que contienen `await auth(`.
   - Definiciones locales de `function toNumber`, `function formatMoney` y `function formatDate` (fuera de `src/lib`).
   - Archivos en `src` que importan `sweetalert2`.
   - Cantidad de archivos `*.test.ts` y de tests aprobados.
3. Compara con la línea base de `docs/refactoring/SEGUIMIENTO.md` e indica qué mejoró, qué empeoró y qué se mantiene.
4. Ejecuta `git status` y lista los archivos modificados o nuevos.
