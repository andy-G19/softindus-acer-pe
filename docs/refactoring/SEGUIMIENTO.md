# Seguimiento de refactorización

Este registro acompaña al [plan integral](../../PLAN_REFACTORIZACION_INTEGRAL.md).
Cada entrega debe dejar el proyecto comprobable antes de comenzar la siguiente.

## Entrega 0 — Base técnica de validación

Fecha: 2026-09-25. Estado: cerrada el 2026-09-28. Commits f8ab42b y 3dfe11c en staging; CI #19 en verde (2m 11s) y despliegue de staging de 3dfe11c en estado Ready, con login y navegación verificados.

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

## Entrega 1 — Stock atómico en compras y anulación

Fecha: 2026-09-29. Estado: cerrada el 2026-09-29. Commits 6057852, 4d73750,
93b1d4e, 2967564 y 817db53 en staging; CI #21 en verde (1m 54s) sobre 817db53 y
despliegue de staging en estado Ready, con el guion de verificación completo.

| Commit | Tipo | Cambio |
|---|---|---|
| 6057852 | test | Pruebas de caracterización de `createPurchaseAction` y `annulPurchaseAction` antes de modificarlas. |
| 4d73750 | fix | La compra suma el stock con `increment` dentro de la transacción. |
| 93b1d4e | fix | La anulación pasa la compra a `anulada` con `updateMany` condicionado al estado. |
| 2967564 | fix | La anulación resta el stock con `updateManyAndReturn` condicionado a `stock_actual >= cantidad`. |

Defectos corregidos:

- Actualización perdida en la compra: el stock se leía fuera de la transacción y
  se escribía el total calculado en JavaScript. Dos compras simultáneas del mismo
  material podían perder una suma.
- Validación no atómica en la anulación: el stock suficiente se comprobaba sobre
  una lectura previa y la resta se calculaba sobre ese mismo valor.
- Doble anulación: el estado de la compra se revisaba fuera de la transacción y
  dos anulaciones simultáneas podían revertir el stock dos veces. Se detectó en
  la auditoría y las pruebas de caracterización confirmaron el defecto.

Decisiones:

- El stock anterior y resultante del kárdex se obtiene del valor que devuelve la
  sentencia de actualización. La fila queda bloqueada hasta el commit, por lo que
  ese valor no puede cambiar entre la escritura y el registro del movimiento.
- La anulación usa una actualización condicional y no `SELECT ... FOR UPDATE`:
  la regla cabe en un `WHERE`, es una sola sentencia tipada sin SQL manual y
  devuelve el valor nuevo. Es el criterio de `work-orders/material-delivery.ts`.
  Si un material no alcanza, se revierte la anulación completa.
- Las cantidades usan `Prisma.Decimal`. En la compra se redondean a dos decimales
  con la regla de PostgreSQL (mitad lejos del cero): el stock guardado no cambia y
  el kárdex cumple que el stock anterior más la cantidad da el resultante.
- Se conserva el orden de bloqueos del inventario: correlativo de movimientos,
  compra, materiales y bitácora. Un orden único evita interbloqueos.
- Sin cambios en textos, toasts, redirecciones ni permisos. La anulación sigue
  sin generar alertas de stock, como antes.

Comprobaciones: `npm run check` terminó con código 0 después de cada commit, en
Windows, con 213, 215, 216 y 219 pruebas aprobadas respectivamente. Cada guarda
nueva pasó una prueba de mutación: al retirar el redondeo, la condición de estado
o la condición `gte`, fallaron solo las pruebas que la protegen.

Las pruebas usan una base en memoria que redondea como `Decimal(10, 2)` y descarta
las escrituras cuando la transacción falla. Demuestran que el código usa las
operaciones atómicas y cómo responde a intercalados concurrentes simulados, pero
no la atomicidad real de PostgreSQL. Esa comprobación requiere pruebas de
integración contra una base desechable (entrega 11).

Verificación en staging (2026-09-29). Pasos 1 a 6 con usuario ADMIN sobre
`PRUEBA E1 PLANCHA` (MAT00000010) y `PRUEBA E1 TUBO` (MAT00000011); paso 7 con
usuarios SELLER y WORKSHOP_MASTER:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Material con stock 5 y mínimo 7 | Alerta activa (stock 5.00, mínimo 7.00). |
| 2 | Compra COM00000007 de 10 a S/ 12.47 | MVI00000026 de 5.00 a 15.00, alerta atendida y costo actual 12.47. |
| 3 | Salida de 8 (MVI00000027, de 15.00 a 7.00) y anulación de COM00000007 | Vuelve al detalle sin toast; compra confirmada, stock 7.00 y sin reversión. |
| 4 | Compra COM00000008 (plancha 5, tubo 4), salida de 3 de tubo y anulación | Vuelve al detalle; compra confirmada, plancha 12.00 y tubo 1.00 sin cambios, sin reversiones. |
| 5 | Anulación de COM00000007 con stock 12 | Toast "Compra anulada"; MVI00000031 de 12.00 a 2.00; compra anulada. |
| 6 | Anulación simultánea de COM00000009 desde dos pestañas | Una sola reversión (MVI00000033, de 3.00 a 1.00) y un solo registro de anulación en la bitácora. |
| 7 | Acceso de SELLER y WORKSHOP_MASTER al listado y al detalle de compras | Acceso denegado en ambos roles. |

Observaciones:

- En los pasos 3 y 4 la transacción marca primero la compra como anulada y luego
  falla la guarda de stock. Que la compra siga confirmada, sin reversiones ni
  registro en la bitácora, confirma el rollback en PostgreSQL y el funcionamiento
  de `updateManyAndReturn` con el adaptador `pg`. Los correlativos de movimientos
  no presentan huecos.
- En el paso 6 las dos solicitudes empezaron con 28 ms de diferencia y estuvieron
  en curso a la vez durante unos 1,2 s, según los tiempos del navegador. Ambas
  leyeron la compra antes de que la otra confirmara, por lo que la segunda se
  detuvo en la guarda de estado dentro de la transacción. Es una inferencia por
  los tiempos: la interfaz no distingue ese camino del de la lectura previa.
- Los pasos 1 y 2 se ejecutaron con mínimo 7 y costo 12.47 en lugar de 8 y 12.50.

Pendientes fuera de alcance:

- El kárdex de entregas y devoluciones de `work-orders/material-delivery.ts` usa
  un stock leído antes de la transacción, aunque el stock se escribe de forma
  atómica.
- La anulación no considera `stock_reservado`. Si la base conserva la restricción
  `stock_actual >= stock_reservado` del DDL original, una anulación que la viole
  termina en error en lugar de volver al detalle. Falta confirmar las
  restricciones vigentes en staging.
- Un pago al proveedor puede registrarse mientras se anula la misma compra.
- Un doble envío del formulario crea dos compras (idempotencia, entrega 11).
- La validación de proveedor y materiales activos sigue fuera de la transacción.
- Los montos de la compra se calculan con `number` (entrega 3) y las acciones
  lanzan errores en lugar de devolver un resultado tipado (entrega 2).
- Al rechazar una anulación, por pagos o por stock insuficiente, la acción vuelve
  al detalle sin mensaje y el usuario no conoce el motivo. Es el comportamiento
  previo, conservado a propósito; candidato para la pista B.
- Datos de prueba en staging: COM00000008 queda confirmada con pago pendiente y
  suma en el indicador de compras pendientes del dashboard.

## Secuencia de próximas entregas

Orden vigente desde el 2026-09-28 (detalle y motivos en la sección 16 del plan).
Pista A: estructura sin cambios de comportamiento. Pista B: experiencia de usuario.

| # | Pista | Entrega | Estado |
|---|---|---|---|
| 0 | Base | Validación, inventario, CI y configuración de Claude Code | Cerrada (CI #19 verde, staging Ready) |
| 1 | Fix | Stock atómico en compras y anulación | Cerrada (CI #21 verde, staging verificado) |
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
| Archivos de prueba / pruebas aprobadas | 18 / 203 | 19 / 219 | todas |
| Escrituras de stock no atómicas en compras | 2 | 0 | 1 |

Actualizado en la entrega 1 (2026-09-29). Solo cambian las dos últimas filas: entre
`cebe48f` y `2967564` únicamente se modificaron `inventory/purchases/actions.ts` y su
prueba, por lo que las demás métricas conservan su valor.

Las reglas de negocio permanecen en su implementación actual en la entrega 0.
La diferencia entre tarifa diaria y horaria sigue siendo una decisión pendiente
antes de unificar los cálculos de Personal y Costos.
