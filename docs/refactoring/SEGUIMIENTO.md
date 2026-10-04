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

## Entrega 2 — Contratos: resultado de acciones y autorización centralizada

Fecha: 2026-09-30. Estado: cerrada el 2026-10-01. Commits 5c96d94 a 5de9193 y
35b1ae8 en staging; CI #25 en verde (2m 0s) sobre 35b1ae8 y despliegue de staging
en estado Ready, con el guion de verificación completo.

| Commit | Tipo | Cambio |
|---|---|---|
| 5c96d94 | test | 28 pruebas de caracterización de `lib/authz.ts`: destinos de `requireAuth` y `requireRole`, `null` de `getAuthorizedSession`, 401/403 de las rutas API y exigencia explícita de usuario activo. |
| 2be83e5 | test | Tabla de acceso de las 41 acciones legacy (228 pruebas): sin sesión, rol no permitido, sesión invalidada y rol permitido. En verde sobre el código anterior a la migración. |
| ed81156 | refactor | Costos: 4 archivos, 7 acciones. |
| cba1ca2 | refactor | Mantenimiento: 5 archivos, 14 acciones. |
| 09ad2cc | refactor | Caja chica: 5 archivos, 7 acciones. |
| 47840da | refactor | Personal: 5 archivos, 9 acciones. |
| bcd8a5c | refactor | Mermas y chatarra: 4 archivos, 4 acciones. |
| 59a741e | chore | Regla de ESLint, tabla de acceso endurecida y CLAUDE.md actualizado. |
| 5de9193 | refactor | Forma del estado de formulario unificada en `ActionErrorState`. |

Autorización centralizada:

- Las 41 Server Actions de costos, mantenimiento, caja chica, personal y mermas
  dejan de llamar a `auth()` y de comparar el rol a mano. Cada archivo conserva un
  helper local con el nombre del requisito (`requireAdmin`, `requireStaffManager`,
  `requireMaintenanceRole`, `requireWasteScrapAccess`) que delega en `requireRole`
  y devuelve la sesión validada.
- Había dos patrones. 19 archivos leían la sesión en cada acción y validaban el
  rol con un helper síncrono. Máquinas, repuestos, categorías de gasto y operarios
  ya encapsulaban todo en un helper asíncrono: en ellos solo cambió su cuerpo.
- La regla `no-restricted-imports` de `eslint.config.mjs` impide importar `auth`
  de `@/auth` en `src`, salvo en `src/auth.ts`, `src/lib/authz.ts` y
  `src/proxy.ts`. `signIn`, `signOut` y `handlers` siguen permitidos. Se comprobó
  por entrada estándar con un import nombrado, un import de espacio de nombres y
  una página de `src/app`. No detecta importaciones dinámicas ni rutas relativas;
  el proyecto usa el alias `@/`.

Cambio observable, declarado en cada commit de migración: una sesión invalidada
que llegue a una de estas acciones redirige a `/login?reason=session-invalid`.
Antes redirigía a `/dashboard/access-denied` en el patrón de 19 archivos y a
`/login` en el de 4. En todos los casos se deniega sin tocar datos. Al navegar no
cambia nada, porque el proxy ya aplicaba ese destino antes de llegar a la acción:
solo es alcanzable con una petición directa o en una carrera entre el proxy y la
acción.

Resultado de acciones:

- `ActionErrorState` (`lib/errors.ts`) incorpora `fieldErrors` opcional y el tipo
  `FieldErrors`. Los 18 tipos de estado de formulario que repetían esa forma en 17
  archivos son ahora alias suyos y conservan su nombre; los formularios no
  cambiaron. Una aserción con `expectTypeOf` fija la forma.
- Contrato objetivo para la pista B, no implementado: resultado discriminado por
  `ok`. El éxito lleva los datos mínimos que necesita la vista y la clave del
  mensaje en el catálogo de notificaciones. El fallo lleva `error` y `fieldErrors`
  con los nombres actuales, un `AppErrorCode` y, en fallos inesperados, una
  referencia de diagnóstico registrada por el logger. Se implementará con su
  primer consumidor (ventanas de Clientes, entrega 9), para no diseñarlo sin uso.
- Los 271 `throw new Error` de las acciones no se convierten en la pista A. Hoy un
  error lanzado muestra la página de error genérica (solo producción tiene
  `error.tsx`); convertirlo mostraría un mensaje en el formulario. Cada formulario
  se convierte al migrarlo en la pista B, como `feat` y con prueba del mensaje.

Decisiones:

- `requireRole` y no `getAuthorizedSession`: las acciones migradas redirigen al
  denegar y `requireRole` reproduce esas redirecciones. Es también lo que usaban
  los 24 archivos migrados antes de esta entrega.
- La tabla de acceso simula `@/auth` y no `@/lib/authz`, para que las mismas
  pruebas validaran el código antes y después de migrar. Durante la migración
  exigió solo el invariante de la sesión invalidada (denegar sin efectos); al
  terminar se endureció al destino exacto.
- Las 14 acciones de máquinas, repuestos, categorías de gasto y operarios siguen
  redirigiendo al denegar, como antes, aunque CLAUDE.md pide devolver un error de
  formulario en las acciones de `useActionState`. Se conserva el comportamiento.
- Los tipos se unificaron con alias y no reemplazando nombres: diff mínimo y un
  punto de evolución por funcionalidad.

Comprobaciones: `npm run check` terminó con código 0 después de cada commit, en
Windows, con 247, 475, 475, 475, 475, 475, 475, 475 y 476 pruebas. En el primer
commit, una de tres ejecuciones falló en el build al resolver la fuente de Google
Fonts (`next/font/google`) sin cambios de código entre ejecuciones; se trató como
un fallo transitorio de red. Pruebas de mutación:

| Mutación | Resultado |
|---|---|
| `assertRole` sin la condición de estado activo | Falla solo la prueba que la protege. |
| Asistencia solo para ADMIN | Falla solo el caso de WORKSHOP_MASTER permitido. |
| Caja chica sin el chequeo de rol | Fallan SELLER, WORKSHOP_MASTER y la sesión invalidada: en el patrón legacy, la protección ante usuarios desactivados dependía del chequeo de rol. |
| Versión legacy de cajas y operarios con la tabla endurecida | Fallan solo los 4 casos de sesión invalidada: es la única diferencia de comportamiento de la migración. |
| `error` opcional en `ActionErrorState` | Falla solo la aserción de tipos; ninguno de los 18 consumidores lo detecta. |

`npm run refactor:inventory` no cambia páginas, formularios ni acciones: actualiza
el total de archivos analizados (357, por las pruebas nuevas desde la entrega 0)
y tres números de línea de `inventory-catalog-manager.tsx`.

Verificación en staging, informada el 2026-10-01, con datos de prueba `PRUEBA E2`
y un usuario de cada rol en sesiones separadas:

| # | Rol | Prueba | Esperado | Resultado |
|---|---|---|---|---|
| 1 | ADMIN | Registrar un costo indirecto en un costeo y recalcularlo | Mismos toasts que antes | Conforme |
| 2 | ADMIN | Crear una máquina y registrar una falla sobre ella | Mismos toasts que antes | Conforme |
| 3 | ADMIN | Abrir una caja chica y registrar un egreso | Mismos toasts que antes | Conforme |
| 4 | ADMIN | Crear un operario y registrar su asistencia | Mismos toasts que antes | Conforme |
| 5 | ADMIN | Registrar chatarra y venderla en la caja de prueba | Mismos toasts que antes | Conforme |
| 6 | WORKSHOP_MASTER | Registrar falla, asistencia, tarea, chatarra y retazo, y cambiar el estado del retazo | Funciona como antes | Conforme |
| 7 | WORKSHOP_MASTER | Abrir por URL caja chica y costos | Acceso denegado | Conforme |
| 8 | SELLER | Abrir por URL mantenimiento, personal y mermas | Acceso denegado | Conforme |
| 9 | ADMIN | Guardar una categoría de material y un cliente con datos inválidos | Mismos mensajes de error en el formulario | Conforme |

Los registros `PRUEBA E2` creados por el guion quedan en staging como datos de
prueba.

Pendientes fuera de alcance:

- 271 `throw new Error` en acciones: resultado tipado por formulario en la pista B.
- 15 archivos con acciones de `useActionState` que redirigen con `requireRole` al
  denegar en lugar de devolver un error de formulario: orders, products,
  material-categories, materials, movements, supplier-materials, supplier-types,
  suppliers (mixto), machines, spare-parts, petty-cash/categories, recipe-details,
  stages, operators y users. Solo `clients` sigue la convención de CLAUDE.md.
- Operaciones sin registro en la bitácora: apertura de caja chica
  (`createPettyCashBoxAction`) y cambio de estado de retazos
  (`updateReusableScrapStatusAction`). Agregarlo es un `feat`.
- `api/reports/export/[report]/route.ts` compara el rol a mano después de
  `requireApiAuth` (entrega 5).
- Solo `production` tiene `error.tsx`.

## Entrega 3 — Conversión y formatos compartidos

Fecha: 2026-10-01. Estado: cerrada el 2026-10-01. Commits `ee1cea5` a `e5a1652`
y `7996f98` en staging; CI #29 en verde (1m 59s) sobre `7996f98` y despliegue de
staging en estado Ready. Verificación en staging hecha con usuario ADMIN; las
pruebas con SELLER y WORKSHOP_MASTER se omitieron por decisión del responsable.

| Commit | Tipo | Cambio |
|---|---|---|
| ee1cea5 | test | Caracterización de `formatMoney` y `formatDate` de `lib/formatters` (16 pruebas), con el proceso en America/Lima y en UTC. |
| d3e8f2c | fix | Las 38 copias locales de `formatDate` del servidor fijan `timeZone: "UTC"`. |
| 1fb27d7 | fix | `quote-form.tsx` formatea en UTC la fecha del pedido y la entrega estimada. |
| 6069c5a | refactor | `lib/numbers.ts` (`toNumber`, `toNonNegativeNumber`, `NumericInput`); `formatMoney` con sobrecarga y `emptyText`; `formatDate` con `format` y `emptyText`. 47 pruebas. |
| 18d508e | refactor | Las tres copias privadas de `toNonNegativeNumber` en lib usan la compartida. |
| c806041 | refactor | Dashboard: se elimina `modules/dashboard/utils.ts`. |
| 403eb57 a 1452e1d | refactor | Migración por área: mermas (5 archivos), comercial (11), inventario (8), mantenimiento (8), caja chica (9), personal (11), costos (8), producción (12) y reportes (10). |
| e5a1652 | chore | Regla de ESLint contra copias locales y convención en CLAUDE.md. |

Punto de partida: 153 definiciones locales en 84 archivos, con comportamientos
distintos bajo el mismo nombre:

- `toNumber`: 48 copias devolvían `NaN` con valores no numéricos, 2 los
  convertían en cero (dashboard y órdenes de trabajo) y 2 anulaban además los
  negativos (costeo).
- `formatMoney`: ante un monto ausente, 31 copias mostraban `S/ 0.00`, 15 un
  guion, la de pedidos `Sin precio` y la de lib un guion. La de mermas usaba
  separador de miles.
- `formatDate`: tres formatos (`d/m/aaaa`, `dd/mm/aaaa` y medio) y dos zonas.
  38 copias del servidor y la de `quote-form.tsx` usaban la zona del proceso.

Defectos corregidos:

- Zona horaria en el servidor (`d3e8f2c`): las columnas `@db.Date` llegan como
  medianoche UTC y, con la zona del proceso, una máquina en America/Lima mostraba
  el día anterior. Vercel ejecuta las funciones en UTC y reserva la variable `TZ`,
  así que producción, staging y CI no cambian: el cambio alinea el desarrollo
  local.
- Proforma nueva (`1fb27d7`): `QuoteForm` es un componente cliente. En el
  navegador la fecha del pedido y la entrega estimada se mostraban un día antes, y
  con el pedido preseleccionado el HTML del servidor no coincidía con el del
  navegador. Visible en producción.

Diseño:

- `toNumber` es la copia literal de las 48 mayoritarias: `null` y `undefined`
  valen 0 y no oculta `NaN`. `toNonNegativeNumber` es la versión que ya existía en
  lib: `null`, negativo o no finito valen 0.
- `formatMoney(valor)` solo acepta un valor presente. Si puede faltar, la llamada
  decide: `x ?? 0` cuando falta significa cero, o `{ emptyText }`. En ejecución,
  un valor ausente muestra `emptyText` (por defecto `-`) y uno no numérico `-`.
- `formatDate(valor, { format, emptyText })` formatea siempre en UTC; el formato
  por defecto es `d/m/yyyy`.
- Los valores por defecto de lib no cambiaron: las 16 pruebas de caracterización
  pasan sin modificarse.
- Las dos llamadas de mermas con separador de miles pasan a anteponer `S/` a su
  `formatNumber` local, que era la definición de su copia.
- `formatSignedMoney` (caja chica) tipa su monto como `Prisma.Decimal` en lugar
  de `unknown`: es lo que recibe de su único llamador.

Migración y evidencia de equivalencia:

- Codemod sobre el AST y el verificador de tipos de TypeScript, fuera del
  repositorio. Identifica cada copia por su cuerpo y resuelve las llamadas por
  símbolo. Aborta ante usos como valor o variantes desconocidas, conserva BOM y
  saltos de línea, y registra la decisión de cada llamada.
- Pruebas de oráculo: 14 copias literales de las variantes se comparan con la
  llamada que las sustituye. El dominio es lo que reciben las pantallas (Decimal,
  number, texto de `Decimal.toString()`, `null` y `undefined`), en America/Lima y
  en UTC.
- Las diferencias fuera de ese dominio quedan fijadas en pruebas: `NaN` se
  muestra como guion y no como `S/ NaN`, y la cadena vacía es un monto ausente.
  `toNumber` devuelve `NaN` donde dos copias devolvían cero, y
  `toNonNegativeNumber` anula el infinito y conserva el cero negativo. Ninguna
  llamada migrada recibe esas entradas.

Hallazgo durante la migración: el codemod decidía por el tipo si un valor podía
faltar. Sin `noUncheckedIndexedAccess`, TypeScript considera `arr[0]` siempre
presente, y en `const quote = order.proforma[0] ?? null` tipa `quote` como
presente.

- Cinco llamadas de reportes (exportación y rentabilidad) accedían con `?.` a la
  proforma, el margen o la rentabilidad más recientes. Habrían cambiado
  `S/ 0.00` o la celda vacía por un guion. Se detectó al revisar el diff, antes
  del commit.
- Dos escáneres revisaron todas las llamadas migradas en busca de encadenamiento
  opcional, acceso por índice, `as`, `!`, `?? null` y variables o parámetros que
  los contienen. Las 5 eran las únicas con riesgo. Otras 13 marcas estaban
  protegidas por una condición o eran valores calculados.

Comprobaciones: `npm run check` terminó con código 0 después de cada commit, en
Windows, con 492 pruebas en los commits 1 a 3 y 539 desde el commit 4. Pruebas de
mutación:

| Mutación | Resultado |
|---|---|
| `formatDate` de lib sin `timeZone: "UTC"` (antes del commit 4) | Fallan solo las 3 pruebas de la variante America/Lima. |
| `formatMoney` de lib sin la guarda de `NaN` | Falla solo su prueba. |
| `formatDate` compartido sin UTC | 11 fallos, todos en la variante America/Lima. |
| `toNonNegativeNumber` sin anular negativos | Fallan solo su contrato y el oráculo de costeo. |
| Texto por defecto de `formatMoney` a `S/ 0.00` | Fallan la caracterización y la prueba de la cadena vacía. |

La regla de ESLint se comprobó por entrada estándar:

- Detecta una función en una página, una función flecha en una acción y una
  copia de `toNonNegativeNumber` en `lib/costing.ts`.
- No marca las definiciones compartidas, su uso importado ni los oráculos
  `legacy*` de las pruebas.
- Aplicada a las versiones anteriores a la entrega de tres archivos, detecta sus
  1, 3 y 1 copias.
- Detecta por nombre: no ve una copia renombrada.

El código de producción pierde 1.103 líneas netas (+345 y −1.448 en 90
archivos); las pruebas suman 638. `npm run refactor:inventory` no cambia
páginas, formularios ni acciones: analiza 360 archivos (4 nuevos, 1 eliminado)
y desplaza números de línea.

Verificación en staging (2026-10-01), con usuario ADMIN y el navegador en
America/Lima. No hubo foto del "antes": el despliegue anterior, abierto por su
URL propia, redirige el inicio de sesión al dominio de producción y no se usó.
Cada resultado se comparó con la salida esperada según las pruebas de oráculo.

| # | Rol | Prueba | Esperado | Resultado |
|---|---|---|---|---|
| 1 | ADMIN | Nueva proforma con `PED00000006` preseleccionado | La fecha del pedido coincide con el detalle del pedido | Conforme: 31/7/2026 y entrega 1/8/2026, sin errores de hidratación. En ese navegador, el código anterior da 30/7/2026. |
| 2 | ADMIN | Exportar en Excel ventas y cobranzas, y producción | Celdas vacías en fechas ausentes y `S/ 0.00` en montos ausentes | Conforme: `PED00000006`, `05` y `02`, sin proforma, con fecha de proforma vacía y monto proformado `S/ 0.00`; fecha de entrega real vacía en las 4 órdenes. |
| 3 | ADMIN | Fechas, montos y textos opcionales vacíos | `-` | Conforme: entrega estimada de `PED00000005`, validez y vencimiento de proforma. Sin datos en staging para precio referencial, adelanto, IGV ni tarifa vacíos. |
| 4 | ADMIN | Nuevo pedido con un producto sin precio | `Sin precio` | No observable: los 5 productos tienen precio. |
| 5 | ADMIN | Indicadores con agregados vacíos | `S/ 0.00` | Conforme: costos de producción del mes (4), costo de mantenimiento del mes, total pagado, pagado del mes y por pagar. |
| 6 | ADMIN | Recalcular `COS00000001` | Total y unitario sin cambios | Conforme: total S/ 1514.20 y unitario S/ 126.18, iguales antes y después; toast "Costeo recalculado correctamente". |
| 7 | ADMIN | Panel de mermas | Montos con separador de miles | No observable: los montos son menores de 1.000. Fechas en `dd/mm/aaaa`. |
| 8 | WORKSHOP_MASTER | Pantallas del rol | Funciona como antes | Omitida. |
| 9 | SELLER | Pantallas del rol | Igual que antes | Omitida. |

Prueba de humo, con peticiones secuenciales: 102 pantallas (56 listados y
formularios, 30 detalles y 16 de recetas) responden 200, sin errores de render,
sin `NaN` y sin `Invalid Date`. Las fechas se muestran en el formato de cada
copia: `d/m/aaaa` en comercial e inventario, `dd/mm/aaaa` en costos,
mantenimiento y mermas, y medio en producción.

Observaciones de la verificación:

- Una primera prueba de humo con 56 peticiones simultáneas agotó las 200
  conexiones del pooler de Supabase de staging
  (`EMAXCONN max client connections reached`). Nueve páginas respondieron 500
  durante unos 8 minutos, hasta que las instancias liberaron sus conexiones.
  `lib/db.ts` crea `PrismaPg` solo con `connectionString`, así que cada instancia
  serverless usa el pool por defecto de `pg` (hasta 10 conexiones). Un pico real
  de tráfico en producción podría causar lo mismo.
- El despliegue de una rama, abierto por su URL propia de Vercel, redirige el
  inicio de sesión a `softindus-acer-pe.vercel.app`, el dominio de producción.
- El encabezado "Generado" de las exportaciones muestra la hora en UTC.
- Datos de prueba que deja la verificación: dos registros en `exportacion_datos`
  con su entrada en la bitácora y el registro de recálculo de `COS00000001`.

Pendientes fuera de alcance:

- Instantes formateados como fechas civiles en UTC:
  `movimiento_inventario.fecha_movimiento` (entradas y salidas), `fecha_falla`,
  `fecha_cierre_materiales` y los `fecha_registro` de tipo `Timestamptz`.
  Después de las 19:00 de Lima se muestran con el día siguiente. Es el
  comportamiento vigente en producción; corregirlo es un `fix` por campo. Lo
  mismo ocurre con la hora del encabezado "Generado" y la fecha del nombre de
  los archivos exportados.
- Pool de conexiones en serverless: limitar `max` por instancia, definir
  `idleTimeoutMillis` y confirmar que `DATABASE_URL` usa el pooler de Supabase en
  modo transacción. Es un cambio de infraestructura con su propia verificación.
- Los despliegues de rama, abiertos por su URL propia, redirigen el inicio de
  sesión a producción: revisar la URL de autenticación del entorno Preview.
- 46 definiciones locales de otros formateadores (`formatNumber`,
  `formatPercent`, `formatDateTime`, `formatQuantity`, `formatDateInput`,
  `formatHours` y otros) en 40 archivos.
- Formatos de monto distintos entre pantallas: `-` o `S/ 0.00` para un monto
  ausente, y separador de miles solo en mermas (pista B).
- El redondeo usa `toFixed` sobre `number`: `Decimal("2.675")` se muestra
  `S/ 2.67`. Revisarlo es una decisión aparte (plan, sección 8).
- Activar `noUncheckedIndexedAccess` para que `arr[0]` sea `T | undefined`.
- El proyecto no tiene formateador de código; la migración deja líneas de más
  de 80 columnas, como ya había.
- `toNumber` acepta `unknown`: estrecharlo a `NumericInput` al unificar los
  envoltorios locales que lo llaman.

## Entrega 4 — Consultas fuera de las páginas

Fecha: 2026-10-02. Estado: en curso. La entrega se divide por área para que la
métrica baje en cada sub-entrega. Commits en local sobre `staging`, sin publicar
hasta terminar la serie.

| Sub-entrega | Alcance | Páginas | Páginas con Prisma |
|---|---|---|---|
| 4.1 | Piloto Clientes, arnés de caracterización, convención y regla de ESLint | 2 | 117 → 115 |
| 4.2 | Resto de Comercial | 14 | 115 → 101 |
| 4.3 | Inventario | 20 | 101 → 81 |
| 4.4 | Mantenimiento | 13 | 81 → 68 |
| 4.5 | Personal, Usuarios y Auditoría | 15 | 68 → 53 |
| 4.6 | Caja chica y Mermas | 14 | 53 → 39 |
| 4.7 | Producción sin órdenes de trabajo | 20 | 39 → 19 |
| Entrega 5 | Reportes, junto con sus exportaciones | 10 | 19 → 9 |
| Entrega 6 | Órdenes de trabajo y Costos, junto con su división por caso de uso | 9 | 9 → 0 |

Los reportes esperan a la entrega 5 porque la pantalla y la exportación
consultan lo mismo: la consulta se extrae una vez y la comparten. Órdenes de
trabajo y costeo esperan a la entrega 6 para no mover dos veces páginas que se
van a reorganizar.

Decisiones:

- Las consultas viven en `src/modules/<área>/<funcionalidad>/queries.ts`, junto
  a `actions.ts`, con `import "server-only"`: si un componente cliente las
  importara, el build fallaría.
- La página autoriza y la consulta no. `requireRole` revalida el usuario contra
  la base en cada llamada (`auth.ts`), y cada punto de entrada rechaza de forma
  distinta: redirección, estado de formulario o 401/403. Autorizar también en la
  consulta duplicaría esa lectura y daría la respuesta equivocada a una acción o
  a una API. Si los datos dependen del rol, la consulta recibe la sesión ya
  verificada.
- La página conserva la lectura de parámetros, `notFound()`/`redirect()`, las
  derivaciones de presentación y el JSX. La consulta construye los filtros de
  Prisma y devuelve sus resultados con los nombres de campo sin cambios: sin
  DTO, sin React y sin redirecciones.
- Las páginas migradas no pueden importar `@/lib/db` (regla
  `no-restricted-imports` con la lista `pagesWithoutPrisma`). En flat config, el
  último bloque que configura una regla reemplaza las opciones del anterior: un
  bloque que solo prohibiera `@/lib/db` anulaba en silencio la restricción de
  `@/auth` de la entrega 2. Ambos bloques comparten esa restricción.
- Las consultas que varias funcionalidades repiten pasan a la interfaz pública
  del módulo dueño de la entidad (opciones de clientes, productos y pedidos).
  Las funciones `find*` devuelven la promesa de Prisma para componerse en el
  `Promise.all` del llamador sin cambiar el orden de las llamadas; las `get*`
  devuelven los datos de una página. Una consulta de edición que depende del
  registro principal devuelve `null` si este no existe, y la página decide el
  `notFound()`.
- Criterio para limitar columnas: nunca cargar filas completas de `usuario`,
  que incluyen `clave_hash` (si se usa, solo las columnas necesarias; si no se
  usa, no se carga), y pedir con `select` las columnas de los listados que
  traen filas completas sin `include`. Las filas que se pasan a un componente
  cliente se limitan a su tipo, porque se serializan en el navegador. Los
  detalles con `include` profundos quedan como pendiente.

Arnés de caracterización (`src/testing/page-characterization.ts`):

- Ejecuta la página real con Prisma, la sesión y la navegación simulados.
  Registra en orden las llamadas a Prisma y a la autorización, el resultado
  (render, notFound o redirect) y el HTML renderizado sin clases ni trazos de
  iconos, una etiqueta por línea.
- Los datos se generan a partir de `prisma/schema.prisma` según el `select`,
  `include` u `omit` de cada llamada; en las filas pares los opcionales valen
  `null`. Cada caso puede sustituir el resultado de una llamada; `projectRows`
  recorta las filas escritas a mano según el `select`. El reloj se fija en el
  15/07/2026 a las 10:00 de Lima, y la zona horaria en UTC, como en Vercel:
  `parseDateParam`, `buildDateRangeFilter` y el vencimiento de la proforma
  interpretan fechas en la zona del proceso.
- Cada página exige autorizar antes de consultar y que un acceso rechazado no
  toque Prisma. Los snapshots se escriben antes de mover y deben pasar sin
  cambios después.
- Se comprobó que el renderizado es determinista y que un `.snap` con CRLF,
  como queda tras el checkout en Windows, pasa sin reescribirse.

### Entrega 4.1 — Piloto Clientes

| Commit | Tipo | Cambio |
|---|---|---|
| ae1b636 | test | Arnés de caracterización y sus 15 pruebas. |
| 02a1140 | test | 20 pruebas de las páginas de listado y edición de Clientes. |
| dd6d6e7 | refactor | `modules/commercial/clients/queries.ts`; las páginas dejan de importar Prisma. |
| 37547b1 | refactor | La página de filas del listado pide las 6 columnas que muestra. |
| 0afb658 | chore | Regla de ESLint y convención en CLAUDE.md. |

Evidencia:

- Los snapshots no cambiaron en `dd6d6e7`, y el bloque JSX de las dos páginas
  es idéntico al anterior, comprobado contra `git show`.
- En `37547b1` solo cambió el snapshot de los argumentos de la consulta; el HTML
  de todos los casos, con las filas recortadas según el `select`, no cambió.
- Pruebas de mutación: quitar el filtro de estado inactivo, invertir el orden de
  las filas o consultar antes de autorizar hacen fallar solo las pruebas que lo
  protegen. Quitar `estado` del `select` hace fallar la prueba del HTML y da 3
  errores de TypeScript.
- La regla de ESLint se comprobó por entrada estándar: en las páginas de
  Clientes detecta `@/lib/db` y `auth` de `@/auth`; en una página sin migrar,
  solo `auth`; `queries.ts` puede importar Prisma.
- `npm run check` terminó con código 0 después de cada commit: 554 pruebas en el
  primero y 574, 574, 575 y 575 en los siguientes.
- `npm run refactor:inventory`: 364 archivos analizados y un número de línea
  desplazado en la página de Clientes.

### Entrega 4.2 — Resto de Comercial

| Commit | Tipo | Cambio |
|---|---|---|
| 346a90a | test | 45 pruebas de las 14 páginas; el arnés fija la zona horaria y expone el generador. |
| 7dd0866 | refactor | `queries.ts` en overview, orders, payments, products, quotes y receipts; opciones compartidas de clientes, productos y pedidos. |
| 3b4ac53 | refactor | Sin usuarios completos en el detalle del pedido, pagos y el detalle de la proforma; columnas del listado de productos y de las categorías que recibe un componente cliente. |
| 607c0b6 | chore | `pagesWithoutPrisma` cubre todo Comercial. |

Evidencia:

- Los casos cubren cada página con y sin filtros y los cambios de flujo:
  `notFound`, la edición de un pedido con proforma que redirige al detalle, un
  pedido editable, una proforma anulable, el vendedor sin permisos de gestión y
  el pedido preseleccionado en la proforma nueva.
- Con el proceso en America/Lima y sin fijar la zona en el arnés fallan 6
  casos (filtros de fecha y vencimiento de la proforma); con la zona fijada
  pasan en cualquier zona.
- En `7dd0866` los 65 snapshots no cambiaron y el bloque JSX de las 14 páginas
  es idéntico. Pruebas de mutación: invertir el orden de las opciones de
  cliente compartidas hace fallar los 7 casos de sus tres consumidores;
  intercambiar dos consultas del `Promise.all` de pedidos y consultar
  categorías de un producto inexistente hacen fallar solo los casos que lo
  protegen.
- En `3b4ac53` cambiaron 14 snapshots, todos de llamadas; ninguno de HTML, con
  datos generados que respetan el `select`. Ningún componente cliente recibía
  el hash del usuario: solo valores sueltos.
- `npm run check` terminó con código 0 después de cada commit, con 620
  pruebas.

### Entrega 4.3 — Inventario

| Commit | Tipo | Cambio |
|---|---|---|
| 7338882 | test | 59 pruebas de las 20 páginas. |
| dd7a4fc | refactor | `queries.ts` en overview, alerts, movements, material-categories, materials, purchases, supplier-materials, supplier-payments, supplier-types y suppliers; opciones compartidas de materiales, proveedores y compras. |
| 8b4a291 | refactor | Sin usuarios completos en salidas y pagos a proveedores; columnas de los listados de materiales, alertas, proveedores y catálogos. |
| d40dcc4 | chore | `pagesWithoutPrisma` cubre Inventario. |

Evidencia:

- Los casos cubren el filtro de stock crítico o suficiente que se resuelve y
  pagina en memoria, `notFound` en las ediciones, la compra inexistente que
  redirige al listado, el regreso al listado filtrado y las diferencias entre
  administrador y maestro de taller.
- En `dd7a4fc` los 59 snapshots no cambiaron y el bloque JSX de las 20 páginas
  es idéntico. Las consultas que dependen de una anterior (materiales de las
  alertas y del detalle de compra) conservan su secuencia. Pruebas de
  mutación: invertir el filtro de stock en memoria hace fallar sus 2 casos;
  invertir el orden de las opciones de proveedor compartidas, los 9 casos de
  sus 4 consumidores; consultar el detalle de una compra inexistente, solo su
  caso.
- En `8b4a291` cambiaron 17 snapshots, todos de llamadas; ninguno de HTML.
  Las categorías y tipos se mapeaban antes de llegar al componente cliente,
  así que no se enviaban filas completas al navegador.
- `npm run check` terminó con código 0 después de cada commit, con 679
  pruebas.

### Entrega 4.4 — Mantenimiento

| Commit | Tipo | Cambio |
|---|---|---|
| 10964ba | test | 36 pruebas de las 13 páginas. |
| 529b2bb | refactor | `queries.ts` en overview, failures, machines, preventive, recurrences, repairs y spare-parts; repuestos usa la interfaz pública de Proveedores. |
| e7bfea5 | refactor | Sin usuarios completos en preventivos; columnas de las máquinas y repuestos de los formularios. |
| 377e741 | chore | `pagesWithoutPrisma` cubre Mantenimiento. |

Evidencia:

- El panel conserva el instante actual y lo pasa a la consulta, que calcula
  los rangos del mes; reincidencias pasa el inicio del mes y de hoy porque la
  página también los usa. Los casos fijan el reloj y cubren `notFound`, el
  regreso al listado filtrado, un repuesto sin proveedor y las diferencias
  entre administrador y maestro de taller.
- En `529b2bb` los 36 snapshots no cambiaron y el bloque JSX de las 13
  páginas es idéntico. Pruebas de mutación: calcular el mes anterior en el
  panel hace fallar sus 2 casos; cambiar el orden de las opciones de máquina,
  los casos de sus 2 consumidores; agregar siempre el proveedor actual de un
  repuesto, solo el caso sin proveedor.
- En `e7bfea5` cambiaron 5 snapshots, todos de llamadas; ninguno de HTML.
- `npm run check` terminó con código 0 con 715 pruebas. `e7bfea5` y `377e741`
  comparten una ejecución, hecha con ambos cambios: la única diferencia del
  primero es no tener aún la regla de ESLint, que esas páginas ya cumplían.

### Entrega 4.5 — Personal, Usuarios y Auditoría

| Commit | Tipo | Cambio |
|---|---|---|
| dcefec9 | test | 45 pruebas de las 15 páginas. |
| 8d832e4 | refactor | `queries.ts` en overview, attendance, operators, payment-history, payrolls y tasks de Personal, y en `modules/users` y `modules/audit`. |
| 88779b0 | refactor | Sin usuarios completos en asistencia, historial de pagos, planillas, tareas y la bitácora; columnas de los operarios del panel y de los formularios. |
| 4872212 | chore | `pagesWithoutPrisma` cubre Personal, Usuarios y Auditoría. |

Evidencia:

- Los casos fijan el reloj y cubren los tres estados de asistencia, el periodo
  de planilla válido e inválido, `notFound` en las ediciones, la edición del
  propio usuario y las diferencias entre administrador y maestro de taller.
- En `8d832e4` los 45 snapshots no cambiaron y el bloque JSX de las 15
  páginas es idéntico. Pruebas de mutación: filtrar tardanzas sin excluir
  faltas, terminar el periodo de planilla un día después y cambiar el orden
  de los operarios activos hacen fallar solo los casos que lo protegen.
- En `88779b0` cambiaron 16 snapshots, todos de llamadas; ninguno de HTML.
  Las páginas de Usuarios ya usaban `select` sin `clave_hash`; la bitácora de
  auditoría cargaba el usuario completo de cada registro.
- `npm run check` terminó con código 0 después de cada commit, con 760
  pruebas.

### Entrega 4.6 — Caja chica y Mermas

| Commit | Tipo | Cambio |
|---|---|---|
| 12ec900 | test | 40 pruebas de las 14 páginas. |
| 149a8bf | refactor | `queries.ts` en overview, boxes, categories, expenses, income-adjustments, monthly-summary y movements de Caja chica, y en overview, scraps, reusable-scraps y scrap-sales de Mermas; opciones de cajas abiertas, materiales activos y órdenes de trabajo recientes en sus módulos dueños. |
| 774ea40 | refactor | Sin usuarios completos en movimientos, el panel, el resumen mensual y retazos; columnas de cajas y categorías. |
| 9e8b00b | chore | `pagesWithoutPrisma` cubre Caja chica y Mermas. |

Evidencia:

- Los casos fijan el reloj y cubren el mes actual, uno elegido y uno inválido
  del resumen, los filtros de fecha de movimientos por separado y juntos,
  `notFound` en la edición de categorías, la chatarra preseleccionada en la
  venta y las diferencias entre administrador y maestro de taller.
- En `149a8bf` los 40 snapshots no cambiaron y el bloque JSX de las 14
  páginas es idéntico. Pruebas de mutación: cerrar el filtro «hasta» al
  inicio del día hace fallar sus 2 casos; cambiar el orden de las cajas
  abiertas, los 5 casos de sus 3 consumidores; reducir las órdenes recientes,
  los de sus 2 consumidores.
- En `774ea40` cambiaron 15 snapshots, todos de llamadas; ninguno de HTML.
- `npm run check` terminó con código 0 después de cada commit, con 800
  pruebas.

## Secuencia de próximas entregas

Orden vigente desde el 2026-09-28 (detalle y motivos en la sección 16 del plan).
Pista A: estructura sin cambios de comportamiento. Pista B: experiencia de usuario.

| # | Pista | Entrega | Estado |
|---|---|---|---|
| 0 | Base | Validación, inventario, CI y configuración de Claude Code | Cerrada (CI #19 verde, staging Ready) |
| 1 | Fix | Stock atómico en compras y anulación | Cerrada (CI #21 verde, staging verificado) |
| 2 | A | Contratos: resultado de acciones y autorización centralizada | Cerrada (CI #25 verde, staging verificado) |
| 3 | A | Conversión y formatos compartidos | Cerrada (CI #29 verde, staging verificado con ADMIN) |
| 4 | A | Consultas fuera de las páginas, por área | En curso: 4.1 a 4.6 en local |
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
| Archivo más grande (`api/reports/export/[report]/route.ts`) | 1.499 líneas | 1.476 | 5 |
| `production/work-orders/actions.ts` | 1.055 líneas | 1.046 | 6 |
| `costs/costings/[id]/page.tsx` | 1.026 líneas | 1.004 | 6 |
| Páginas con Prisma directo | 117 | 39 | 4 |
| Archivos de `src/modules` con `auth()` directo | 23 | 0 | 2 |
| Acciones de `src/modules` que comparan el rol a mano | 41 | 0 | 2 |
| Definiciones de la forma de estado de formulario | 18 | 1 | 2 |
| Definiciones locales de `toNumber` | 52 | 1 | 3 |
| Definiciones locales de `formatMoney` | 49 | 1 | 3 |
| Definiciones locales de `formatDate` | 52 | 1 | 3 |
| Archivos que importan `sweetalert2` | 2 | 2 | 7 |
| Archivos de prueba / pruebas aprobadas | 18 / 203 | 70 / 800 | todas |
| Escrituras de stock no atómicas en compras | 2 | 0 | 1 |

Actualizado en la entrega 2 (2026-09-30) con `/verificar` sobre `5de9193`. Las dos
filas nuevas se midieron sobre `58edb6c`; entre `42f4308` y ese commit, en `src`
solo cambiaron `inventory/purchases/actions.ts` y su prueba, que no tienen ninguno
de esos patrones, por lo que son también su línea base.

Actualizado en la entrega 3 (2026-10-01) sobre `e5a1652`. Las demás filas no
cambian: páginas con Prisma directo 117, `auth()` directo 0 y `sweetalert2` 2,
medidos de nuevo; las otras no las toca esta entrega.

Método de medición, para que `/verificar` y la línea base cuenten lo mismo:

- Las definiciones de `toNumber`, `formatMoney` y `formatDate` cuentan
  `function <nombre>` con cuerpo en todo `src`, incluida la definición
  compartida de `src/lib`. Las dos firmas de sobrecarga de `formatMoney`, sin
  cuerpo, no cuentan. Desde la entrega 3 hay 0 fuera de `src/lib`, que es lo que
  mide `/verificar`, y una regla de ESLint lo mantiene.
- Contar con grep o ripgrep. En PowerShell, `Select-String -Path` interpreta
  `[id]` y `[report]` como comodines y omite esos archivos sin avisar.
- `sweetalert2` cuenta los archivos que lo mencionan. Uno es un comentario de
  `lib/security-headers.ts`: el único archivo que lo importa es
  `lib/notifications.ts`.

Las reglas de negocio permanecen en su implementación actual en la entrega 0.
La diferencia entre tarifa diaria y horaria sigue siendo una decisión pendiente
antes de unificar los cálculos de Personal y Costos.
