---
description: Inicia una entrega del refactor siguiendo el ciclo plan → aprobación → implementación → verificación
argument-hint: <numero o nombre de la entrega, p. ej. "2 - fix stock compras">
---

Vamos a trabajar la entrega del refactor: **$ARGUMENTS**

Sigue este ciclo sin saltarte pasos:

1. **Contexto.** Lee `CLAUDE.md` (sección "Active refactor — rules"), la sección 16 de `PLAN_REFACTORIZACION_INTEGRAL.md` y `docs/refactoring/SEGUIMIENTO.md`. Localiza la fila de esta entrega y su criterio de cierre.
2. **Estado de git.** Ejecuta `git status` y `git branch --show-current`. Debemos estar en `staging`. Si hay cambios sin commitear que no pertenecen a esta entrega, detente y avísame.
3. **Auditoría.** Lee el código real que afecta la entrega (no asumas contenidos). Cuantifica el punto de partida con las métricas de SEGUIMIENTO.md que apliquen.
4. **Plan.** Presenta un plan con: archivos a tocar, cambios en cada uno, riesgos, tests existentes que protegen el cambio y tests que agregarás, y cómo verificaremos que el comportamiento no cambió. Divide en commits pequeños y dame el mensaje de cada commit.
5. **Espera mi aprobación.** No edites ningún archivo hasta que responda "aprobado" (o ajuste el plan).
6. **Implementa** commit por commit. Después de cada bloque de cambios ejecuta `npm run check`. Si falla, corrige la causa; nunca desactives reglas ni debilites tests.
7. **Reporte final.** Resume: archivos modificados, resultado de cada paso de `npm run check`, métricas antes → después, y qué debo verificar manualmente en el despliegue de staging (pantallas, roles, datos de prueba). No hagas commit ni push: yo los ejecuto después de revisar el diff.

Explícame el porqué de cada decisión técnica: estoy aprendiendo ingeniería de software.
