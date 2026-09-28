# Seguimiento de refactorización

Este registro acompaña al [plan integral](../../PLAN_REFACTORIZACION_INTEGRAL.md).
Cada entrega debe dejar el proyecto comprobable antes de comenzar la siguiente.

## Entrega 0 — Base técnica de validación

Fecha: 2026-09-25. Estado: implementación y validación local terminadas.
La ejecución remota de CI queda pendiente de publicar los cambios.

Cambios de esta entrega:

- `npm run check` ejecuta, en orden, generación de Prisma, validación del schema,
  lint, tipos de rutas y TypeScript, pruebas unitarias y build. Se detiene ante
  el primer fallo.
- El comando sustituye las variables de conexión y autenticación en sus procesos
  hijos por valores ficticios. La conexión apunta al puerto 1 de la máquina local;
  no requiere un servicio de base de datos. No ejecuta seed, migraciones ni bootstrap.
- `npm run typecheck` genera los tipos de Next.js antes de comprobar TypeScript,
  para no depender de haber levantado el servidor de desarrollo previamente.
- ESLint y TypeScript excluyen temporales, salidas de documentos y carpetas de
  herramientas locales. ESLint también excluye el cliente generado de Prisma.
- `.github/workflows/ci.yml` queda disponible para versionarse, con el mismo
  comando de validación local. Su ejecución remota requiere publicar los cambios.
- Se habilita el versionado de esta carpeta de seguimiento; los demás documentos
  locales y artefactos conservan sus reglas de exclusión.
- `npm run refactor:inventory` genera un inventario reproducible de las rutas,
  declaraciones JSX de formularios y funciones de acciones del servidor.

## Inventario inicial y alcance de la medición

El [inventario estructural](INVENTARIO.md) registra 127 páginas, 136 declaraciones
JSX de formularios y 48 archivos con `use server`, con 114 funciones exportadas.
Las 136 declaraciones incluyen filtros y formularios de acciones por fila:
no representan 136 pantallas que deban convertirse en ventanas.

Los candidatos importados como `ClientForm` o `ProductCategoryManager` quedan
relacionados con sus rutas. La clasificación funcional de cada ventana se
refinará al migrar su módulo. Regenerar este archivo después de mover código.

| Mecanismo existente | Ubicación principal | Tratamiento previsto |
|---|---|---|
| Primitivas visuales | `src/components/ui` | Completar contratos y estados; reutilizar variantes. |
| Notificaciones y confirmaciones | `src/lib/notifications.ts` | Mantener fachada; separar catálogo y adaptadores. |
| Mensajes tras redirección | `src/components/notifications/notification-query-bridge.tsx` | Compatibilidad temporal con las páginas actuales. |
| Formularios | `src/components/forms` y componentes de módulos | Unificar errores, envíos y presentación. |
| Progreso de navegación | `src/lib/nav-progress.ts` | Revisar suscripciones y el parche global de fetch. |
| Estilos | `src/app/globals.css` | Consolidar tokens y retirar sobrescrituras gradualmente. |
| Navegación y parámetros | `src/lib/navigation.ts`, `search-params.ts` | Reutilizar regreso, filtros y breadcrumbs. |
| Permisos, errores y logger | `src/lib/authz.ts`, `errors.ts`, `logger.ts` | Conservar garantías al separar servicios. |
| Reportes | `src/lib/reports` y ruta de exportación | Extraer proveedores por reporte. |

## Comprobaciones de esta entrega

`npm run check` terminó con código 0 en Windows el 2026-09-25:

| Comprobación | Resultado |
|---|---|
| Generación de Prisma | Cliente 7.8.0 generado correctamente. |
| Validación Prisma | Schema válido. |
| ESLint | Sin errores ni advertencias. |
| Tipos | Generación de rutas y TypeScript correctos. |
| Pruebas | 18 archivos, 203 pruebas aprobadas. |
| Build | Next.js 16.2.9 compiló y terminó la generación y optimización de páginas. |
| Inventario | Generado y revisado; incluye ruta raíz y dashboard. |
| Sintaxis de scripts | `node --check` correcto para los dos scripts nuevos. |

El primer intento se detuvo en Prisma por un permiso del aislamiento sobre la
carpeta temporal de Windows. La ejecución autorizada fuera de ese aislamiento
completó todos los pasos con el entorno ficticio del script.

No se ejecutó GitHub Actions ni se reinstalaron dependencias en una copia limpia.
El workflow queda preparado para comprobar ese escenario mediante `npm ci` y
`npm run check` al publicar esta entrega. No hay cambios en archivos de `src`
versionados ni en el esquema o las migraciones.

El alcance de este comando es estático, unitario y de compilación. No comprueba
operaciones reales en PostgreSQL ni interacción de navegador. Las pruebas de
integración y recorridos completos se incorporarán antes de migrar los flujos
correspondientes. Nunca usar datos productivos para esas pruebas.

## Secuencia de próximas entregas

Orden vigente desde el 2026-09-28 (detalle y motivos en la sección 16 del plan).
Pista A: estructura sin cambios de comportamiento. Pista B: experiencia de usuario.

| # | Pista | Entrega | Estado |
|---|---|---|---|
| 0 | Base | Validación, inventario, CI y configuración de Claude Code | Validada localmente; commit y CI remoto pendientes |
| 1 | Fix | Stock atómico en compras y anulación | Pendiente |
| 2 | A | Contratos: resultado de acciones y autorización centralizada | Pendiente |
| 3 | A | Conversión y formatos compartidos | Pendiente |
| 4 | A | Consultas fuera de las páginas, por área | Pendiente |
| 5 | A | Exportaciones por reporte | Pendiente |
| 6 | A | Órdenes de trabajo y costeo por caso de uso | Pendiente |
| 7 | A | Fachada de notificaciones | Pendiente |
| 8 | B | Base visual y galería | Pendiente |
| 9 | B | Piloto Clientes y categoría en ventanas | Pendiente |
| 10 | B | Catálogos, listados y resto de dominios | Pendiente |
| 11 | — | Operaciones críticas con integración e idempotencia; consolidación | Pendiente |

## Línea base de métricas (rama `staging`, commit `42f4308`)

Medido el 2026-09-28 sobre el código versionado, excluyendo `src/generated`.
Actualizar la columna "Actual" al cerrar cada entrega (comando `/verificar`).

| Métrica | Línea base | Actual | Entrega que la mueve |
|---|---|---|---|
| Archivo más grande (`api/reports/export/[report]/route.ts`) | 1.499 líneas | 1.499 | 5 |
| `production/work-orders/actions.ts` | 1.055 líneas | 1.055 | 6 |
| `costs/costings/[id]/page.tsx` | 1.026 líneas | 1.026 | 6 |
| Páginas con Prisma directo | 117 | 117 | 4 |
| Archivos de `src/modules` con `auth()` directo | 23 | 23 | 2 |
| Definiciones locales de `toNumber` | 52 | 52 | 3 |
| Definiciones locales de `formatMoney` | 49 | 49 | 3 |
| Definiciones locales de `formatDate` | 52 | 52 | 3 |
| Archivos que importan `sweetalert2` | 2 | 2 | 7 |
| Archivos de prueba / pruebas aprobadas | 18 / 203 | 18 / 203 | todas |
| Escrituras de stock no atómicas en compras | 2 | 2 | 1 |

Las reglas de negocio permanecen en su implementación actual en la entrega 0.
La diferencia entre tarifa diaria y horaria sigue siendo una decisión pendiente
antes de unificar los cálculos de Personal y Costos.
