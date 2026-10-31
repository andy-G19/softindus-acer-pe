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

Fecha: 2026-10-02. Estado: cerrada el 2026-10-05. Sub-entregas 4.1 a 4.7 hechas
en local el 2026-10-03, publicadas en staging con `fbe2ec7` (CI #34 en verde) e
integradas en `main` con el PR #13 (merge commit `0843a21`, CI #36 en verde). La
entrega se divide por área para que la métrica baje en cada sub-entrega.

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

### Entrega 4.7 — Producción sin órdenes de trabajo

| Commit | Tipo | Cambio |
|---|---|---|
| f73dbc8 | test | 68 pruebas de las 20 páginas. |
| 2ec7228 | refactor | `queries.ts` en overview, bottlenecks, campaigns, recipes, recipe-versions, recipe-details, routes y stages; productos activos en la interfaz pública de Productos. |
| 7b2350b | refactor | Sin usuarios completos en recetas y versiones; columnas de productos y materiales de los formularios. |
| 95e7604 | chore | La regla de ESLint se invierte: cubre todas las páginas salvo las 19 pendientes. |

Evidencia:

- Los casos cubren `notFound` en cada detalle y edición, el detalle de otra
  receta, una campaña sin detalles, una etapa sin máquina asignada, la cantidad
  válida e inválida de requerimientos y los filtros por separado y juntos.
- En `2ec7228` los 68 snapshots no cambiaron y el bloque JSX de las 20 páginas
  es idéntico. Las consultas que dependen de otra (productos que la campaña aún
  no tiene, materiales que la versión aún no usa, máquina asignada a la etapa)
  conservan su secuencia y devuelven `null` cuando el registro principal no
  existe o no pertenece a su padre. Pruebas de mutación: no verificar que el
  detalle sea de la receta y excluir productos de una campaña sin detalles
  hacen fallar solo su caso; cambiar el orden de los productos activos
  compartidos, los 11 casos de sus 4 consumidores.
- En `7b2350b` cambiaron 11 snapshots, todos de llamadas; ninguno de HTML.
- La regla invertida se comprobó por entrada estándar: el login, la raíz, el
  inicio del dashboard y páginas de cada área detectan `@/lib/db` y `auth`;
  reportes, una orden de trabajo y un costeo solo detectan `auth`; `queries.ts`
  puede importar Prisma. `npx eslint src/app` no reporta errores.
- `npm run check` terminó con código 0 después de cada commit, con 868
  pruebas.

### Balance de las sub-entregas 4.1 a 4.7

- Páginas con Prisma directo: de 117 a 19, las de reportes (10), órdenes de
  trabajo (5) y costos (4), que se migran con las entregas 5 y 6.
- 52 archivos `queries.ts` con `server-only`. Las opciones repetidas viven en
  el módulo dueño de su entidad: clientes, productos, pedidos, materiales,
  proveedores, compras, operarios, máquinas, cajas abiertas y órdenes de
  trabajo recientes.
- 50 archivos de caracterización con 313 pruebas, además de las 17 del arnés.
  Las 98 páginas migradas conservan su JSX byte a byte y sus snapshots no
  cambiaron al mover las consultas.
- Criterio de columnas aplicado en cada área: 18 inclusiones de `usuario`
  completas, con `clave_hash`, pasan a pedir solo nombres y apellidos o el
  nombre de usuario (10), o dejan de cargarse porque no se mostraban (8). En
  los `queries.ts` ya no queda ninguna. En Comercial se comprobó que ningún
  componente cliente recibía el hash; en las demás áreas las páginas solo
  leían nombres y apellidos en el servidor o no usaban el usuario.

### Publicación, CI y verificación en staging

| Commit | Tipo | Cambio |
|---|---|---|
| fbe2ec7 | test | El arnés unifica los espacios que emite `Intl` según la versión de ICU. |

- CI #33, sobre `f191c66`, falló en 7 snapshots de HTML de fallas, usuarios y
  auditoría, las páginas que muestran fecha y hora con `formatDateTime`.
  `Intl.DateTimeFormat` separa «p. m.» con U+00A0 en Windows (Node 20.19.3,
  ICU 77.1), donde se escribieron los snapshots, y con U+0020 en el CI, que
  instala la última 20.x. No es un fallo de la aplicación: es el mismo tipo de
  no determinismo que la zona horaria de la 4.2.
- `fbe2ec7`: `normalizeHtml` convierte U+00A0, U+202F y U+2009 en un espacio
  normal, y una prueba nueva lo fija. Los 3 snapshots solo cambian ese
  carácter. Simulando en local el ICU del CI, el arnés anterior reproduce los
  7 fallos y el nuevo pasa tanto con U+0020 como con U+202F. Quitar la
  normalización hace fallar solo su prueba. `npm run check`: 869 pruebas; el
  primer intento falló en el build al descargar la fuente de Google Fonts,
  fallo transitorio conocido, y el segundo terminó con código 0.
- CI #34 en verde (2m 30s) sobre `fbe2ec7`. El primer intento del CI #35, el
  del PR #13, falló sin ejecutarse: GitHub respondió «Internal server error» y
  no asignó una máquina («The job was not acquired by Runner»). Al
  re-ejecutarlo pasó en verde (2m 6s). CI #36 en verde (2m 37s) en `main`
  sobre `0843a21`.

Verificación en staging, informada por el responsable el 2026-10-05:

| # | Rol | Prueba | Resultado |
|---|---|---|---|
| 1 | ADMIN | Prueba de humo con un guion en la consola, peticiones secuenciales con pausa de 1,5 s: las 98 páginas migradas (70 fijas y 28 con id tomado de los enlaces de las páginas visitadas) y 14 ids inexistentes | Todas OK: sin errores, sin `NaN` ni `Invalid Date`; 404 en los ids inexistentes y redirección al listado en la compra |
| 2 | ADMIN | Quién registró cada fila (asistencia, planillas, tareas, historial de pagos, auditoría, preventivos, movimientos de caja, versiones de receta, salidas y detalle de pedido), edición de una categoría de producto y filtro de stock crítico | Conforme |
| 3 | SELLER | Comercial funciona; Inventario muestra acceso denegado | Conforme |
| 4 | WORKSHOP_MASTER | Inventario, Producción, Mantenimiento, Personal y Mermas funcionan; Caja chica muestra acceso denegado | Conforme |
| 5 | — | Logs de Vercel durante las pruebas | Sin errores de Prisma ni respuestas 500 |

No hubo foto del «antes»: el navegador integrado no tenía sesión en el ERP de
staging antes de publicar. La equivalencia descansa en las pruebas de
caracterización, escritas antes de mover cada consulta, y en la prueba de humo.

Pendientes fuera de alcance:

- El CI usa `node-version: "20"` sin fijar la versión menor y `ubuntu-latest`,
  que pasa a Ubuntu 26 desde el 19/10/2026. Las pruebas ya fijan la zona
  horaria y normalizan los espacios de `Intl`. GitHub avisa además de que
  `actions/checkout@v4` y `actions/setup-node@v4` se ejecutan forzadas en
  Node 24.
- La URL propia de staging, abierta sin sesión, redirige al login de
  producción: el proxy usa `request.nextUrl` y next-auth sustituye su origen
  por `AUTH_URL`. Revisar `AUTH_URL` del entorno Preview en Vercel.
- 22 páginas conservan su `getSearchParam` local, que no recorta a 200
  caracteres como `parseStringParam`. Unificarlo cambia el comportamiento con
  textos largos: es un `fix`.
- `getStatusFilter` (`active`/`inactive` a booleano) se repite en 8
  `queries.ts`, como antes se repetía en las páginas.
- `modules/dashboard/data.ts` no tiene `server-only` ni sigue el nombre
  `queries.ts`.
- Los detalles con `include` profundos siguen cargando filas completas, según
  el criterio de columnas.
- `parseDateParam`, `setDate` y los rangos «del mes» usan la zona del proceso.
  En Vercel es UTC y el arnés la fija; en una máquina en America/Lima el
  resultado cambia. Es el mismo tema de fechas civiles e instantes pendiente
  de la entrega 3.
- Los snapshots de HTML dependen del marcado de los componentes compartidos:
  la entrega 8 tendrá que actualizarlos con `vitest -u` y revisar el diff.

## Entrega 5 — Exportaciones por reporte

Fecha: 2026-10-05. Estado: cerrada el 2026-10-07. 18 commits de `60e1830` a
`6fc7c11` y el registro `108ba00`, publicados en staging el 2026-10-06 (CI #37
en verde) e integrados en `main` con el PR #14 (merge commit `1613819`, CI #39
en verde); verificada en producción. Se divide en cuatro sub-entregas para que
cada paso deje el proyecto comprobable y se pueda revertir por reporte.

| Sub-entrega | Alcance | Resultado |
|---|---|---|
| 5.1 | Caracterización: arnés para route handlers, la exportación y las 10 páginas de reportes | 101 pruebas nuevas antes de mover código |
| 5.2 | Un exportador por reporte con la consulta compartida, registro tipado y `assertRole` | `route.ts` de 1.476 a 186 líneas; páginas con Prisma de 19 a 9 |
| 5.3 | Columnas | 15 cargas de `usuario` completo a 0 |
| 5.4 | Regla de ESLint y `CLAUDE.md` | Reportes fuera de `pagesStillWithPrisma` |

| Commit | Tipo | Cambio |
|---|---|---|
| 60e1830 | test | El arnés ejecuta route handlers: `characterizeHandler`, `$transaction` simulado que registra escrituras (solo si el archivo lo pide) y `normalizeIntlSpaces`. 6 pruebas. |
| 982832a | test | 47 pruebas de `GET /api/reports/export/[report]`. |
| bb09990 | test | 48 pruebas de las 10 páginas de reportes. |
| cadc40b | refactor | Base común: fechas de reporte en `lib/reports/report-filters`, contrato `ExportReport`/`ReportExporter` y `registerExportLog` en `modules/reports`. |
| c3929e2 | refactor | Piloto Producción: `queries.ts` y `exporter.ts`; pantalla y exportación comparten el filtro. |
| 4b4523e | refactor | Inventario. |
| a334ff4 | refactor | Proveedores y compras. |
| 522a1a4 | refactor | Ventas y cobranzas. |
| 3483a87 | refactor | Financiero: filtro de caja y significado de cada total. |
| f31ec5f | refactor | Mantenimiento, con la divergencia de búsqueda como opción explícita. |
| 5e658f3 | refactor | Personal, con los dos filtros documentados. |
| 4e161c8 | refactor | Costos y rentabilidad, con los dos filtros documentados. |
| 0fcbc60 | refactor | Exportación de la bitácora en `modules/audit`. |
| 9676287 | refactor | Panel de reportes e historial de exportaciones. |
| c03cc7b | refactor | `REPORT_EXPORTERS: Record<ReportKey, ReportExporter>` en lugar del `switch`. |
| 3a6d617 | refactor | La exportación valida el rol con `assertRole` (pendiente de la entrega 2). |
| e21cd62 | refactor | Sin usuarios completos; opciones de filtros desde los módulos dueños. |
| 6fc7c11 | chore | Reportes fuera de `pagesStillWithPrisma` y convención en `CLAUDE.md`. |

Punto de partida, medido sobre `e6c8c29`:

- `route.ts` tenía 1.476 líneas: ayudantes privados, nueve constructores
  (lectura de parámetros, consulta y mapeo de filas), un `switch`, el registro
  de la exportación y el `GET`.
- No existe exportación CSV. La ruta genera Excel (por defecto) y PDF, y
  `parseExportFormat` responde 400 a cualquier otro formato. `lib/csv-export.ts`
  no tiene consumidores; los nombres `build*Csv` y `csvExportHref` (la variable
  del botón Excel) son históricos.
- La pantalla y la exportación no consultaban exactamente lo mismo: comparten
  el significado de los filtros, pero difieren a propósito en el límite (100
  filas o el del formato), en el desempate del orden (la exportación agrega el
  id) y en las columnas. En producción, inventario, ventas, compras, financiero
  y los preventivos de mantenimiento el `where` era idéntico. En los demás
  difería (ver divergencias).
- 15 cargas de `usuario` completo (con `clave_hash`): 7 en la ruta, 6
  `include` en las páginas y 2 listas de opciones. 8 copias idénticas de
  `parseDateInput`/`parseDateInputAsNextDay` (7 páginas y la ruta, comparadas
  por hash del cuerpo). El rol se comparaba a mano tras `requireApiAuth`.

Decisiones:

- La ruta conserva solo la parte HTTP y su orden de validaciones: sesión (401)
  antes de revelar si el reporte existe (404), rol (403), formato, rango,
  límite, recorte, registro antes de generar el archivo y respuesta. Cada
  reporte tiene `modules/reports/<reporte>/exporter.ts`; la bitácora, en su
  módulo dueño (`modules/audit/exporter.ts`).
- El registro de exportadores es `Record<ReportKey, ReportExporter>`: el
  compilador exige un exportador por clave y la rama `default: return null`,
  inalcanzable tras `parseReportKey`, desaparece. Vive en
  `modules/reports/exporters.ts` y no en `lib/reports/report-registry.ts`, que
  son metadatos puros (nombre y roles) probados sin base: colgarle código con
  Prisma invertiría la dirección de las dependencias. Se creó al final porque
  un `route.ts` solo puede exportar handlers y configuración: los exportadores
  tenían que existir antes en `modules`.
- Se comparte el `where`, no la consulta completa. Cada `queries.ts` lo
  construye una vez y lo usan `get<Reporte>ReportData` (pantalla) y
  `get<Reporte>Export…` (archivo), cada uno con su límite, orden y columnas.
  Cada punto de entrada sigue leyendo sus parámetros como antes (la página sin
  recorte, la exportación con `trim` y 200 caracteres): el constructor es una
  función pura de esos valores y su resultado no cambia.
- Un commit por reporte (pantalla y exportación juntas), de lo simple a lo
  complejo: el piloto fue Producción (una consulta, `where` idéntico, usa el
  usuario y el reloj). Los reportes divergentes, al final.
- `buildReportDateRange` reemplaza las 8 copias de la regla de fechas, con 7
  pruebas propias (desborde de días y meses, espacios y valores inválidos).
- Columnas con el criterio de la entrega 4: usuario solo con nombres y
  apellidos (y correo en el historial), o sin cargar si no se muestra; las
  opciones de filtros desde `find*` de los módulos dueños, más
  `findActiveUserOptions` nueva en `modules/users`; los `include` profundos de
  los listados quedan como pendiente.

Divergencias entre pantalla y exportación, conservadas y documentadas junto a
ambas consultas (igualarlas cambia lo que se ve o se exporta: es un `fix`):

- D1, mantenimiento: la búsqueda de fallas de la pantalla incluye el código
  interno de la máquina y la de la exportación no. Queda como la opción
  `includeMachineCode` de un único constructor.
- D2, rentabilidad: con `lowMargin` y `negativeProfit` a la vez, la segunda
  condición de la exportación reemplaza la clave `rentabilidad` y se ignora el
  margen bajo. La pantalla aplica las dos. La caracterización fija el
  comportamiento actual.
- Personal, rentabilidad y auditoría: la pantalla combina condiciones con
  `AND`, lee las fechas con `parseDateParam` y cierra "hasta" al final del día
  (`lte`); la exportación usa un objeto plano, acepta alias de parámetros
  (`from`/`dateFrom`, `q`/`searchText`, `operario`/`operatorId`...) y cierra
  "hasta" antes del día siguiente (`lt`).

Evidencia de que los archivos exportados no cambian:

1. Generadores intactos: `git diff e6c8c29..6fc7c11` no toca
   `lib/excel-export.ts` ni `lib/pdf-export.ts`.
2. Caracterización de la ruta (47 pruebas): cada caso fija en orden la sesión,
   las lecturas de Prisma, el registro de la exportación (correlativo,
   `exportacion_datos` y bitácora), la entrada completa del generador (título,
   metadatos, encabezados y cada celda) y la respuesta (estado y cabeceras con
   el nombre del archivo). Cubre cada reporte en Excel y PDF, los alias,
   relaciones opcionales ausentes, los límites, los recortes de 80 filas en PDF
   y 5.000 en Excel, y los rechazos 401, 403, 404, 400 y 500. Ningún snapshot
   cambió en 5.2; en 5.3 cambiaron 23, solo en argumentos de Prisma.
3. Comparación byte a byte, fuera del repositorio (`tmp/`, ignorado, como el
   codemod de la entrega 3): la ruta original de `e6c8c29` y la actual se
   ejecutan en el mismo proceso, con los mismos datos y los generadores reales,
   y se compara el SHA-256 de cada respuesta, las escrituras y las lecturas.
   Mismo proceso implica misma ICU y mismo reloj. Antes de cada commit de 5.2 y
   5.3: 47 de 47 casos idénticos y 35 archivos .xlsx y .pdf iguales byte a
   byte. Las lecturas fueron idénticas hasta 5.2; en 5.3 difieren en 25 casos
   (columnas) con archivos y escrituras iguales. Control: la ruta original es
   determinista consigo misma.
4. Páginas: 48 pruebas; ningún snapshot cambió en 5.2 y el JSX de las 10
   páginas es idéntico al de `HEAD` antes de cada commit, con el BOM
   conservado. En 5.3 cambiaron 32 snapshots, todos de llamadas: cero líneas de
   HTML.

| Mutación | Resultado |
|---|---|
| Quitar el filtro de estado del `where` compartido de producción | Fallan solo el caso con filtros de la pantalla y el de la exportación. |
| Cambiar el campo de fecha de "cobrado a clientes" en financiero | Fallan solo el caso con filtros de la pantalla y el de la exportación. |
| `includeMachineCode: true` en la exportación de mantenimiento | Falla solo el caso de exportación con búsqueda. |
| Quitar una entrada de `REPORT_EXPORTERS` | Error TS2741 de TypeScript. |
| `assertRole` con todos los roles | Fallan solo los dos casos 403. |
| Quitar `apellidos` del `select` de usuario de producción | Error TS2339 en el exportador. |

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows, con 875, 922 y 970 pruebas en los commits de 5.1 y 977 desde
`cadc40b`. La regla de ESLint se comprobó por entrada estándar: una página de
reportes detecta `@/lib/db` y `auth`; una orden de trabajo, solo `auth`;
`queries.ts` puede importar Prisma. `npx eslint src/app` no reporta errores.

El código de producción cambia en 36 archivos (+2.947 y −2.669: 278 netas por
las firmas, tipos y comentarios de 22 archivos nuevos); las pruebas y el arnés
suman 1.678. `queries.ts` pasa de 52 a 62. `npm run refactor:inventory` no
cambia páginas, formularios ni acciones: analiza 497 archivos y desplaza los
números de línea de los formularios de 9 páginas de reportes.

### Publicación, CI y verificación en producción

- Push a staging de `108ba00` el 2026-10-06: CI #37 en verde (1m 43s). PR #14:
  CI #38 en verde (2m 5s); merge commit `1613819` en `main`: CI #39 en verde
  (1m 59s). Después se integró la entrega 6 (PR #15, merge commit `59124e9`).
- No hubo foto del «antes»: el push se hizo antes de verificar. La
  equivalencia de los archivos descansa en la caracterización y en la
  comparación byte a byte.
- La verificación se hizo en producción el 2026-10-07, por decisión del
  responsable: el último despliegue era el de `59124e9` (entregas 5 y 6), y la
  verificación de staging de la entrega 6 no recorrió los reportes.

Verificación en producción el 2026-10-07 con un usuario ADMIN, desde el
navegador integrado y con peticiones secuenciales con pausa de 1,5 a 2 s:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Prueba de humo de 21 peticiones: el panel de reportes, los 8 reportes sin filtros y con filtros (fechas, estados, búsqueda, margen bajo), el historial de exportaciones con y sin formato y la bitácora con y sin rango | Todas 200, sin redirecciones ni `digest` de error, sin `NaN`, `Invalid Date` ni `undefined`; 0,6 a 1,6 s por página (3,4 s el panel en la primera petición) |
| 2 | Enlaces de exportación de las páginas | Conservan los filtros de la pantalla, como fija la caracterización |
| 3 | Rechazos de la ruta, que se validan antes de escribir: reporte inexistente, formato `xml` y fecha inicial mayor que la final | 404 y dos 400, con el mismo JSON que fijan las pruebas |
| 4 | Contenido limitado por la sub-entrega 5.3 | El historial muestra nombre y correo de quien exportó; los filtros de usuario de inventario y del historial listan los 4 usuarios activos con nombre; el responsable de cada movimiento se muestra |
| 5 | Bitácora con rango del 1 al 7 de octubre | Sin filas: la última entrada de producción es del 8 de agosto |
| 6 | Exportar Producción sin filtros en Excel y en PDF (autorizado por el responsable) | 200, `no-store`, Excel con firma zip (7.592 bytes) y PDF con firma `%PDF-` (2.902 bytes); `EXP00000038` y `EXP00000039` en el historial y en la bitácora, con 2 registros cada uno |
| 7 | Logs de Vercel | No revisados: el navegador integrado no pudo abrir vercel.com |
| 8 | SELLER y WORKSHOP_MASTER | Omitida. La entrega no cambió `permissions.ts`, `proxy.ts`, `auth.ts`, `authz.ts` ni ningún `requireRole` de las páginas; en la ruta, la comparación de rol pasó a `assertRole` con la misma respuesta, que fijan las dos pruebas 403 y su mutación |

Observación: el nombre de los archivos lleva la fecha `2026-10-08` en una
exportación hecha el 7 de octubre a las 21:08 de Lima, porque el servidor
formatea en UTC. Es el pendiente de instantes en UTC de la entrega 3, no una
regresión. Datos que deja la verificación: `EXP00000038` y `EXP00000039`, con
su entrada en la bitácora de producción.

Pendientes fuera de alcance:

- Corregir D1, D2 y las diferencias de fechas, forma y alias de personal,
  rentabilidad y auditoría: un `fix` por reporte, con su caracterización.
- `lib/csv-export.ts` sin consumidores y los nombres `csvExportHref` de 6
  páginas.
- Métricas derivadas repetidas entre la página y su exportador: cobrado y
  estado de cobranza en ventas, saldo de compras en financiero y avance
  promedio en producción. Compartirlas completa el "significado compartido".
- El estado de cobranza se filtra después del límite (100 pedidos en pantalla,
  el límite del formato en el archivo): pueden faltar filas que cumplen el
  filtro. Es el comportamiento actual de ambos.
- La pantalla no desempata el orden por id y la exportación sí: con fechas
  iguales, el orden puede diferir entre pantalla y archivo.
- `formatQuantity` conserva copias locales en las páginas (pendiente de la
  entrega 3) además de la de `modules/reports/export-report.ts`.
- Los `include` profundos de los listados de reportes (producto, cliente,
  ruta, material...) siguen cargando filas completas.

## Entrega 6 — Órdenes de trabajo y costeo por caso de uso

Fecha: 2026-10-06. Estado: cerrada el 2026-10-07. 19 commits de `91ad966` a
`ffcc683` y el registro `9369bc1`, publicados después de fusionar el PR de la
entrega 5 (CI #40 en verde), verificados en staging (cierre `7c90ac2`, CI #41
en verde) e integrados en `main` con el PR #15 (CI #42 en verde; merge commit
`59124e9`, CI #43 en verde, 2m 37s). Se divide en cuatro sub-entregas para que
cada una deje el proyecto comprobable y baje una métrica.

| Sub-entrega | Alcance | Resultado |
|---|---|---|
| 6.1 | Acciones de órdenes de trabajo por caso de uso | `actions.ts` de 1.046 a 240 líneas |
| 6.2 | Las 5 páginas de órdenes de trabajo | Páginas con Prisma de 9 a 4 |
| 6.3 | Costos: caracterización, consultas, cálculo compartido y secciones | Páginas con Prisma de 4 a 0; detalle de costeo de 1.004 a 110 líneas |
| 6.4 | Registro | Este apartado e `INVENTARIO.md` |

| Commit | Tipo | Cambio |
|---|---|---|
| 91ad966 | test | El doble de la transacción registra `update`, `updateMany` y `createMany`; `recordTransactionEnd` (opcional) registra el commit o el rollback; `decimalSnapshotSerializer`. 4 pruebas. |
| 37664a8 | test | Las 8 acciones de órdenes de trabajo en la tabla de permisos, con roles por acción (reabrir: solo ADMIN). 41 pruebas. |
| 7c8e58c | test | 79 casos de las 8 acciones de órdenes de trabajo. |
| 2d8b3bc | refactor | Piloto: anular y finalizar en `work-order-status.ts`. |
| abe3821 | refactor | Cierre y reapertura de materiales en `material-closure.ts`. |
| 6eaace0 | refactor | Creación de la orden en `create-work-order.ts`; `WorkOrderInput` en el esquema. |
| 163ef50 | refactor | Entrega pendiente, adicional y devolución en `material-movements.ts`. |
| f2416fe | test | 34 pruebas de las 5 páginas de órdenes de trabajo. |
| ad860b5 | refactor | Consultas en `work-orders/queries.ts` y `work-order-progress/queries.ts`. |
| 1914ec6 | refactor | Sin usuarios completos; operarios y productos con `select`. |
| 514a66f | chore | Órdenes de trabajo fuera de `pagesStillWithPrisma`. |
| facaae1 | test | 42 casos de las 7 acciones de costos. |
| 7d35212 | test | 25 pruebas de las 4 páginas de costos. |
| 410a8e6 | refactor | Consultas en `costs/overview/queries.ts` y `costs/costings/queries.ts`. |
| 4979f5f | refactor | Cálculo del costeo en `lib/costing-calculations.ts`; el detalle lo usa. 10 pruebas. |
| 517f3ed | refactor | Las acciones de costeo, margen y rentabilidad usan el mismo cálculo. |
| d749759 | refactor | El detalle de costeo en 7 secciones, cada formulario junto a su acción. |
| 513b0f8 | refactor | El detalle de costeo sin el usuario completo. |
| ffcc683 | chore | `pagesStillWithPrisma` desaparece; `CLAUDE.md` documenta los casos de uso. |

Punto de partida, medido sobre `108ba00`:

- `production/work-orders/actions.ts` tenía 1.046 líneas: 8 acciones que
  mezclaban autorización, lectura del formulario, reglas, transacción,
  revalidación y redirección. Mueven stock (entrega pendiente, adicional y
  devolución, con `material-delivery.ts`) y reservan correlativos (OTR, ROM,
  MVI y ALE). Ninguna tenía pruebas ni estaba en la tabla de permisos.
- Las 7 acciones de costos solo tenían la tabla de permisos: ninguna prueba de
  lo que calculan ni de lo que escriben.
- El detalle de costeo tenía 1.004 líneas: la consulta, tres fórmulas copiadas
  de las acciones (desglose de materiales, precio sugerido y rentabilidad) y
  cinco formularios de cuatro casos de uso.
- 9 páginas consultaban Prisma; 5 cargaban `usuario` completo.

Decisiones:

- Caracterizar por registro de llamadas y no con una base en memoria. La
  entrega 1 cambiaba comportamiento y debía demostrar el estado final; esta
  mueve código y debe demostrar que la secuencia de operaciones no cambia. El
  registro detecta lo que una base en memoria aceptaría: una validación que
  entra o sale de la transacción, la bitácora fuera de ella o una revalidación
  adelantada. `material-delivery.ts` se ejecuta real dentro de las acciones.
- Acciones delgadas y casos de uso `server-only`, como recomienda la guía de
  Next.js instalada (`data-security.md`, mutaciones con una capa de acceso a
  datos). `actions.ts` sigue siendo la única superficie `"use server"`: cada
  función exportada es un endpoint público, y la tabla de permisos falla si
  alguien exporta un caso de uso. El caso de uso recibe los datos validados y
  el id del usuario verificado, abre la transacción, lanza los mismos errores y
  no redirige: finalizar una orden ya finalizada devuelve `"ya_finalizada"`.
- Los casos de uso se agrupan por la invariante que protegen: estado,
  declaraciones de cierre, creación con correlativos y movimientos de stock.
  Se movieron de lo simple a lo crítico; `material-delivery.ts` no cambió.
- Los bloques se extrajeron por programa (no a mano), comprobando cuántas
  sustituciones hacía cada uno, y se compararon contra `HEAD`.
- Consultas con la convención de la entrega 4. Se reutilizan
  `findActiveProductFilterOptions` y `findActiveProductsByCategory`; las
  opciones que no se repiten en otros módulos se quedan en su consulta. Las
  consultas dependientes conservan su secuencia y devuelven `null` (reasignar
  no consulta operarios si el avance no existe).
- Costeo en tres capas. Datos: `costs/costings/queries.ts`. Cálculo:
  funciones puras en `lib/costing-calculations.ts` que reciben números ya
  convertidos (el detalle usa `toNumber` y las acciones `toNonNegativeNumber`;
  no se usa `applyWaste`, que convierte negativos a cero) y cuyo orden de
  operaciones es parte del contrato, porque los montos se guardan tal como se
  calculan. Presentación: siete componentes de servidor; cada formulario vive
  junto a la acción que envía y recibe con `Pick` solo las columnas que usa.
  `formatDecimal` y `formatPercent` del detalle se comparten como
  `formatCostingDecimal` y `formatCostingPercent`: muestran `0.00` para un
  valor ausente y `formatDecimal` de `lib/formatters` muestra `-`.

Evidencia de que el comportamiento no cambió:

1. Caracterización escrita antes de mover: acciones de órdenes de trabajo (79
   casos, 158 snapshots), acciones de costos (42 casos, 84 snapshots), páginas
   de órdenes de trabajo (34 pruebas, 58 snapshots) y de costos (25 pruebas, 42
   snapshots). Cada caso se revisó: llega a la rama que su nombre promete. En
   los commits que mueven código no cambió ningún snapshot; en los de columnas
   cambiaron 23 y 9, todos de llamadas y ninguno de HTML.
2. El código movido es idéntico al de `HEAD` salvo las sustituciones previstas
   (`session.user.id` por `idUsuario`, `redirect` por un valor devuelto). El JSX
   de las 9 páginas, desde su último `return`, es idéntico; el de las 7
   secciones del detalle, sus 5 ayudantes, 2 formatos y 2 derivaciones también,
   según una verificación independiente del script que los cortó. Esa
   verificación detectó 4 espacios de sangría de más en el JSX generado, que se
   corrigieron antes del commit.
3. Los montos de las acciones de costos se recalcularon aparte con dobles IEEE
   754 y coinciden hasta el último decimal (por ejemplo, `175.42000000000007`).
4. Comparación diferencial fuera del repositorio (`tmp/e6-diff`, ignorado):
   las expresiones originales de `HEAD` y las funciones de
   `costing-calculations.ts` dan el mismo resultado según `Object.is` en
   1.544.144 comparaciones (cuadrícula con `0`, `-0`, negativos, `NaN` e
   infinito, y 200.000 montos aleatorios de dos decimales). Control: con la
   merma reordenada aparecen 131.267 diferencias.

| Mutación | Resultado |
|---|---|
| Reabrir con WORKSHOP_MASTER, anular solo con ADMIN | Falla un caso de permisos cada una. |
| Bitácora de la anulación fuera de la transacción | Fallan sus 2 casos. |
| Quitar la guarda `gte` del descuento de stock | Fallan los 3 casos que entregan material. |
| Escribir el stock con el cliente global fuera de la transacción | Falla la entrega adicional: el doble solo admite escrituras dentro de una transacción. |
| La acción ignora `"ya_finalizada"` | Falla su caso. |
| `actions.ts` re-exporta un caso de uso | Falla la tabla de permisos. |
| Reordenar la merma, el precio sugerido o el margen real | En la primera versión de la caracterización de costos sobrevivieron la merma y el límite `<`/`<=` de la alerta: se agregaron datos que los distinguen. Ahora falla un caso por fórmula, también cuando la fórmula vive en `lib`. |
| Reordenar la merma en el detalle de costeo | Sobrevive: la página muestra dos decimales. Lo que se guarda lo fijan las acciones. |
| Quitar una columna de un `select` o de un `Pick` | Error TS2339. |
| No pasar el último margen a la sección de rentabilidad | Fallan 7 casos del detalle. |

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 981, 1.022, 1.101, 1.135, 1.177, 1.202 y 1.212 pruebas según el
commit. `/verificar` sobre `ffcc683`: los seis pasos correctos, 91 archivos y
1.212 pruebas. La regla de ESLint se comprobó por entrada estándar: las páginas
de costos, de órdenes de trabajo y una página nueva detectan `@/lib/db` y
`auth`; `queries.ts` puede importar Prisma.

El código de producción cambia en 31 archivos de `src` y `eslint.config.mjs`
(+3.281 y −2.573: 708 netas por los encabezados, tipos y comentarios de 16
archivos nuevos); las pruebas y el arnés suman 2.586 líneas, y los snapshots,
24.215. `npm run refactor:inventory` analiza 518 archivos y mantiene 127
páginas, 136 formularios y 48 archivos de acciones: los casos de uso no
agregaron superficies `"use server"`. Los 6 formularios del detalle de costeo
aparecen ahora en sus secciones de `src/modules`.

### Publicación, CI y verificación en staging

- Push a staging de `9369bc1` después de fusionar el PR #14 de la entrega 5
  (merge commit `1613819`; CI #38 del PR y CI #39 en `main` en verde). CI #40 en
  verde (1m 38s) sobre `9369bc1`.
- No hubo foto del «antes»: el push se hizo antes de verificar. La equivalencia
  descansa en la caracterización, el código y JSX idénticos a `HEAD` y la
  comparación diferencial.

Verificación en staging el 2026-10-07 con ADMIN (`USU00000001`), desde el
navegador integrado y con peticiones secuenciales con pausa de 1,5 s:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Prueba de humo de 24 páginas: listado de órdenes con y sin filtros, nueva orden, los 5 detalles y los 5 avances existentes, 2 reasignaciones, panel de costos, costeos sin filtros y con los 3 estados, detalle de `COS00000001` y órdenes por costear | Todas 200, sin redirecciones ni `digest` de error, sin `NaN`, `Invalid Date` ni `undefined`; 0,5 a 1 s por página |
| 2 | 5 ids inexistentes o ajenos: detalle y avances de `OTR99999999`, reasignar un avance inexistente y uno de otra orden, `COS99999999` | Frontera 404 en todos. En Producción con estado HTTP 200 y en Costos con 404: la página de campañas, que la entrega no tocó, también responde 200 (Producción tiene `error.tsx` y `not-found.tsx` propios y responde por streaming) |
| 3 | Contenido del detalle de `COS00000001` | Total S/ 1514.20 y unitario S/ 126.18, como en la entrega 3; referencias de 15 y 20 % correctas |
| 4 | Crear `OTR00000006`: reposición de Rastrillo agrícola, cantidad 1 | Toast; requerimiento congelado de 204.00 de plancha (`MAT00000006`) a S/ 250.00 |
| 5 | Entregar lo pendiente, entrega adicional de 1 y devolución de 200 | Stock 299.79 → 95.79 → 94.79 → 294.79; kárdex `MVI00000034` a `MVI00000036` encadenado (stock anterior ± cantidad = resultante); toasts |
| 6 | Cerrar (consumo 4, merma 1), reabrir como ADMIN y cerrar otra vez (consumo 5, merma 0) | Al cerrar desaparecen la entrega y la devolución; reabrir conserva lo entregado y lo devuelto |
| 7 | Generar `COS00000002`, mano de obra 120, recalcular, costo indirecto `CIN00000004` de 25.50 y anularlo | Total S/ 51,000.00 → 51,120.00 → 51,145.50 → 51,120.00; el recálculo lee la mano de obra recién escrita |
| 8 | Margen de 17 % y rentabilidad | Sugerido S/ 59,810.40. Lo guardado coincide con la vista previa: utilidad S/ 8,690.40, 17.00 %, rentable (predicho antes con dobles IEEE 754: `17.000000000000004`) |
| 9 | Crear `OTR00000007` y anularla desde el listado | Toast; deja de ofrecer anular y finalizar |
| 10 | Bitácora del día | 13 entradas con el detalle esperado: requerimiento congelado, motivos, merma, producción declarada antes de reabrir |
| 11 | Logs de Vercel (solo se conserva la última media hora: 16:43 a 17:13) | Sin advertencias ni errores durante las pruebas. El único error es de 16:47: una entrega a `OTR00000005` que la regla de stock rechazó, con su mensaje |
| 12 | SELLER y WORKSHOP_MASTER | Omitida por decisión del responsable. La entrega no cambió `permissions.ts`, `proxy.ts`, `authz.ts` ni `auth.ts`, ni ningún `requireRole` de las 9 páginas y las 8 acciones (comparado con `108ba00`); los permisos los fijan la tabla de `action-access.test.ts`, con `requireRole` real, y la caracterización de páginas |

Hallazgos de la verificación, anteriores a la entrega (no son regresiones):

- H7: la alerta de bajo margen compara números en coma flotante. Las dos
  rentabilidades de `COS00000001`, con margen aplicado de 20 %, se guardaron como
  margen bajo: el margen real da `19.999999999999993`, y la pantalla muestra
  20.00 %. Se corrige en un solo lugar porque la vista previa y la acción
  comparten `calculateProfitability`.
- Un rechazo de negocio de una acción (por ejemplo, stock insuficiente) responde
  500 y muestra la frontera de error genérica, sin el motivo: las acciones lanzan
  en lugar de devolver un resultado (pista B).
- Tras la entrega, la tabla de requerimiento del detalle compara el stock que
  queda con lo ya entregado y marca «insuficiente» (faltante 128.21 en
  `OTR00000006`). El listado ofrece «Anular» en órdenes con movimientos, que el
  servidor rechaza. Ambos son de la pista B.
- La plancha quedó sobre su mínimo y no se abrió alerta de stock: esa rama la
  cubre la caracterización.

Datos de prueba que quedan en staging: `OTR00000006` (materiales cerrados,
pendiente), `OTR00000007` (anulada), `COS00000002` (rentable), `CIN00000004`
(anulado) y la plancha `MAT00000006` con 5 unidades menos (294.79).

Divergencias y defectos encontrados, conservados (cada uno es un `fix`):

- H1: las validaciones de las órdenes (estado, cierre, movimientos) ocurren
  fuera de la transacción. Una entrega simultánea con una anulación podría
  dejar una orden anulada con salidas.
- H2: el kárdex de entregas y devoluciones toma el stock anterior de una
  lectura previa a la transacción (pendiente de la entrega 1; los snapshots lo
  muestran).
- H3: `recalculateCostingTotals` lee, suma en JavaScript y escribe el total sin
  bloquear el costeo: dos costos indirectos simultáneos pueden dejarlo
  desactualizado.
- H4: generar un costeo comprueba fuera de la transacción si la orden ya tiene
  uno: un doble envío crea dos.
- H5: crear una orden por pedido lee el mismo detalle de pedido dos veces.
- H6: el detalle convierte con `toNumber` y las acciones con
  `toNonNegativeNumber` sobre la misma fórmula; solo difieren con negativos.
- La anulación no recorta el id del formulario y la entrega sí (fijado por la
  caracterización).
- H7: la alerta de bajo margen compara en coma flotante (ver la verificación en
  staging).

Pendientes fuera de alcance:

- Los `fix` H1 a H7.
- `production/work-orders/[id]/page.tsx` (643 líneas) y
  `work-order-progress/actions.ts` (427) no se dividieron.
- 17 copias locales de `formatDecimal` con dos comportamientos distintos para
  un valor ausente, además de `formatCostingDecimal`.
- El desglose y la generación del costeo usan la receta y el costo actual del
  material, no el requerimiento congelado de la orden (decisión de negocio).
- Los `include` profundos de los detalles siguen cargando filas completas.
- El arnés genera el mismo valor para todas las columnas decimales de una
  fila: confundir dos columnas solo se detecta en los casos que fijan montos
  a mano.
- El doble de Prisma no aplica las escrituras: una lectura posterior devuelve
  los datos del caso. La integración contra una base desechable sigue en la
  entrega 11.

## Entrega 7 — Fachada de notificaciones

Fecha: 2026-10-07. Estado: cerrada el 2026-10-08. 6 commits de `4ac6caa` a
`3bef5c9` y el registro `15d6339`, publicados sobre `27342e3` junto con los
cierres de las entregas 5 y 6 (CI #44 en verde, 2m 33s), verificados en staging
(cierre `a9eb6f8`, CI #45 en verde) e integrados en `main` con el PR #16 (CI #46
en verde; merge commit `e20c30a`, CI #47 en verde, 2m 5s). Pista A: no cambia lo
que ve el usuario (textos, severidades, toasts ni confirmaciones).

El criterio literal de la sección 16 («ningún módulo importa SweetAlert2 ni
Toastify») ya se cumplía al empezar, sin que nada lo impusiera: solo los
importaban `lib/notifications.ts` y el proveedor de toasts. Se reemplazó por
cinco criterios medibles tomados de la sección 7 del plan:

| # | Criterio | Al empezar | Al cerrar |
|---|---|---|---|
| C1 | Entradas del catálogo embebidas en el puente `?toast=` | 124, en 159 de sus 230 líneas | 0; el puente es un adaptador de 48 líneas |
| C2 | Catálogos de área tipados reunidos en un registro común | 0 | 10 |
| C3 | Claves caracterizadas (texto, severidad, clases y HTML) | 0 / 124 | 124 / 124, sin cambios de snapshot tras el movimiento |
| C4 | Desfase entre claves emitidas y registro detectado por una prueba | Sin control | Prueba activa: 0 claves sin entrada, 1 sin emisor declarada |
| C5 | Solo la fachada y el proveedor importan las librerías | Se cumplía sin control | Regla de ESLint |

| Sub-entrega | Alcance | Resultado |
|---|---|---|
| 7.1 | Caracterización antes de mover | 172 casos de la fachada, el botón de confirmación y el puente |
| 7.2 | `notify` en la fachada y catálogo por área | Puente de 230 a 48 líneas |
| 7.3 | Guardas | Prueba de desfase y regla de ESLint |
| 7.4 | Registro | Este apartado e `INVENTARIO.md` |

| Commit | Tipo | Cambio |
|---|---|---|
| 4ac6caa | test | Dobles de `react-toastify` y `sweetalert2` en `src/testing/notification-doubles.ts`; 19 casos de la fachada y 12 de `ConfirmDeleteButton`. |
| 358f15b | test | 141 casos del puente: las 124 claves de una lista fija y los casos de URL, repetición y montaje. |
| 2cf52df | refactor | Contrato del catálogo en `lib/notification-catalog.ts` (solo tipos); `notify(definition)` en la fachada con el mismo `switch` que tenía el puente. |
| 805caa7 | refactor | Las 124 entradas en 10 `src/modules/<área>/notifications.ts` con `satisfies NotificationCatalog`, reunidas en `src/modules/notification-registry.ts`; el puente queda como adaptador. |
| c00ecdd | test | Prueba de desfase que lee el código como árbol sintáctico de TypeScript; la lista fija del puente cubre todo el registro. 6 pruebas. |
| 3bef5c9 | chore | `no-restricted-imports` para `sweetalert2` y `react-toastify` fuera de la fachada y el proveedor; `CLAUDE.md` documenta la convención. |

Punto de partida, medido sobre `7c90ac2`:

- El código emitía 123 claves con 103 apariciones de `toast=` en 47 archivos:
  85 literales, 16 ternarios de activar y desactivar (32 claves),
  `campaign-status-${nextStatus}` (3, con `nextStatus` validado por
  `includes`) y `detailsPath(…, "recipe-detail-…")` (3). Un `grep` de
  `toast=[a-z-]+` encuentra 86 cadenas: las 85 literales y el prefijo
  `campaign-status-`.
- 0 claves emitidas sin entrada y 1 entrada sin emisor,
  `work-order-materials-consumed`, desde `5599788` (el consumo todo o nada se
  reemplazó por la entrega, la devolución y el cierre). Ninguna clave se emite
  desde un área distinta de su sección del catálogo, lo que permitió partirlo
  1:1.
- El catálogo tenía 94 éxitos, 29 advertencias, 1 error y ningún info; 3
  entradas con descripción.
- 20 archivos consumían `lib/notifications`: 14 formularios con el mismo error
  genérico (14 copias del título y 15 de la descripción), 4 con un error
  propio, el puente y `ConfirmDeleteButton`. Sus 15 usos pasan `title`, así que
  `entityName` y `showDeleteConfirm` no se usan en la práctica; `onConfirm`
  tiene 0 usos. `showLoading` y `closeModal` no tienen consumidores.
- Ninguna prueba cubría las notificaciones.

Diseño: el contrato (`NotificationSeverity`, `NotificationDefinition` y
`NotificationCatalog`) no depende de ninguna librería; los catálogos y la
fachada dependen de él. El registro sigue el patrón de `REPORT_EXPORTERS` de la
entrega 5: una sola lista de áreas (`notificationCatalogs`) de la que se
derivan `NotificationKey` y `notificationRegistry`, que es un objeto normal con
el mismo orden de claves para que el puente siga consultando por propiedad.

Evidencia de que el comportamiento no cambió:

1. Caracterización escrita antes de mover, en la frontera con las librerías:
   los dobles registran cada llamada a Toastify y SweetAlert2 y el HTML de cada
   toast. 172 casos y 159 snapshots; la lista de las 124 claves está escrita en
   la prueba para que una entrada borrada falle en lugar de dejar un snapshot
   obsoleto. Un script aparte cruzó los 124 snapshots con el catálogo: 0
   diferencias. En los commits 3 a 6 no cambió ningún snapshot.
2. Scripts de verificación distintos de los que transformaron: el `switch`, el
   catálogo y el componente del commit 3 son idénticos al original salvo las
   líneas previstas; en el commit 4 el registro se ejecutó con `tsx` y se
   comparó con el catálogo de `HEAD`: 124 entradas, mismo orden, misma área y 0
   diferencias.
3. Comparación diferencial fuera del repositorio (`tmp/e7-diff`, ignorado,
   `npx vitest run --config tmp/e7-diff/vitest.config.ts`): el puente de `HEAD`
   y el nuevo producen las mismas llamadas en 5.881 claves (las 124, los 12
   nombres de `Object.prototype`, 744 variantes cercanas, 5.000 al azar y la
   vacía) y en 20.000 secuencias aleatorias de navegación, repeticiones y
   montajes. Control: detecta un texto, una severidad, una entrada borrada y
   un registro sin prototipo. La primera versión tomaba las claves del
   registro nuevo y no detectaba la entrada borrada; ahora las toma del puente
   de `HEAD`.
4. TypeScript rechaza en un catálogo una severidad mal escrita (TS2820) y un
   `message` ausente (TS2741).
5. La regla de ESLint se comprobó por entrada estándar en 13 casos: módulos,
   componentes, pruebas, páginas existentes y nuevas, la fachada y el
   proveedor; `@/auth` sigue restringido en todos.

| Mutación | Resultado |
|---|---|
| Fachada y botón (17): clases, severidades, escape de HTML, opciones de SweetAlert2, rama de `title`, cancelar, deshabilitado, `onConfirm` | Todas fallan |
| Puente (14), incluidos los arreglos de F1, F2 y F3 | Todas fallan |
| `notify` en la fachada (4); reemplazar su `switch` por `showToast(definition.type, …)` | Fallan; la segunda rompe los casos de F2 |
| Catálogos y registro (7): texto, severidad, entrada borrada, descripción, clave repetida con otro texto, registro sin prototipo, área quitada | Todas fallan |
| Clave repetida con el mismo texto y entrada movida de área | Sobreviven a la caracterización (no cambian nada visible); las detecta la prueba de desfase |
| Prueba de desfase (12), incluida la propia prueba dejando de leer las plantillas | 11 fallan; un `?toast=` en un comentario sobrevive, como debe |
| ESLint: sin el bloque de excepción; excepción sin `@/auth` | 4 errores en la fachada y el proveedor; la restricción de `@/auth` se pierde en silencio |

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.243, 1.384, 1.384, 1.384, 1.390 y 1.390 pruebas según el commit;
95 archivos de prueba al final. El código de producción cambia en 14 archivos
de `src` (+312 y −194), además de `eslint.config.mjs` y `CLAUDE.md`; las
pruebas, los dobles y los snapshots suman 3.513 líneas. `npm run
refactor:inventory` analiza 535 archivos (17 nuevos) y mantiene 127 páginas, 136
formularios y 48 archivos de acciones: los catálogos no agregan superficies
`"use server"`.

Comportamientos actuales conservados y fijados por la caracterización (cada
uno es un `fix` o pista B):

- F1: el `useRef` del puente evita repetir una clave mientras siga montado.
  Una segunda operación igual (dos clientes creados seguidos) no muestra su
  toast y deja `?toast=` en la URL; al recargar aparece un toast viejo. La
  sección 7 prevé identificadores de operación.
- F2: `?toast=toString`, `constructor`, `__proto__` y los demás nombres del
  prototipo de `Object` muestran un toast info vacío. Lo corrige
  `Object.hasOwn` en un `fix`.
- F3: con `?toast=` vacío no se muestra nada y la URL no se limpia.
- `work-order-materials-consumed` no tiene emisor; se conserva en el catálogo
  de Producción y en `CLAVES_SIN_EMISOR`. Retirarla es un `fix`.

Pendientes fuera de alcance:

- Pista B: los 14 formularios muestran un toast genérico además de sus errores
  de campo; alertas persistentes dentro del formulario; mensajes de éxito
  locales fuera del catálogo (gestores de categorías y catálogos de
  inventario, proveedor rápido del repuesto); confirmaciones sobre Radix con
  entidad, consecuencia y verbo, y `ConfirmDeleteButton`, que también anula,
  cancela y desactiva; retirar SweetAlert2 y con él `showLoading` y
  `closeModal`.
- Pista B, sección 8: las acciones devolverán un código de mensaje con el tipo
  `NotificationKey` en lugar de redirigir con cadenas `?toast=`.
- Los `fix` F1, F2 y F3 y retirar la clave sin emisor.

`CLAUDE.md` decía que las claves de toast estaban en español: las 124 están en
inglés. Se corrigió en el commit de ESLint junto con la errata `<key></key>`.

### Publicación, CI y verificación en staging

- Foto del «antes» tomada el 2026-10-08 **antes del push**, con staging en
  `7c90ac2` (el código anterior a la entrega). Las entregas 3 a 6 no la
  tuvieron.
- Push a staging de 9 commits (`1799b3b`, `27342e3` y de `4ac6caa` a
  `15d6339`): CI #44 en verde (2m 33s). Antes de la foto del «después» se
  comprobó que staging servía el build nuevo: los fragmentos JavaScript de la
  página cambiaron (de 15 a 13, con nombres nuevos).

Verificación con ADMIN desde el navegador integrado, de solo lectura (ninguna
URL escribe en la base) y con peticiones secuenciales. En cada URL, navegación
completa, espera de 1,5 s y lectura del DOM: clase de Toastify, clase
industrial, HTML del contenido del toast y URL final. El «después» se guardó en
el navegador y se comparó con el «antes» por SHA-256 de cada observación (el
«antes» calculado aparte en Python): **14 de 14 idénticas**.

| # | URL | Toast (antes y después) | URL final |
|---|---|---|---|
| 1 | `/dashboard?toast=login-success` | success: «Inicio de sesión exitoso» y su descripción | `/dashboard` |
| 2 | `/dashboard/commercial/clients?toast=client-deactivated` | warning: «Cliente desactivado» | `/dashboard/commercial/clients` |
| 3 | `/dashboard/commercial/clients?page=1&toast=inventory-movement-created` | success: «Movimiento de inventario registrado» y su descripción | `/dashboard/commercial/clients?page=1` |
| 4 | `?toast=machine-status-updated` | success: «Estado de máquina actualizado» | `/dashboard` |
| 5 | `?toast=campaign-status-anulada` (clave construida) | warning: «Campaña anulada» | `/dashboard` |
| 6 | `?toast=costing-recalculated` | success: «Costeo recalculado correctamente» | `/dashboard` |
| 7 | `?toast=payroll-annulled` | warning: «Planilla anulada» | `/dashboard` |
| 8 | `?toast=user-self-deactivate-blocked` | error: «No puedes desactivar tu propio usuario» | `/dashboard` |
| 9 | `?toast=petty-cash-income-registered` | success: «Ingreso de caja registrado correctamente» | `/dashboard` |
| 10 | `?toast=reusable-scrap-created` | success: «Retazo reutilizable creado correctamente» | `/dashboard` |
| 11 | `?toast=work-order-materials-consumed` (sin emisor) | success: «Consumo de materiales registrado» | `/dashboard` |
| 12 | `?toast=no-existe` | Ninguno | `/dashboard` |
| 13 | `?toast=toString` (F2) | info vacío | `/dashboard` |
| 14 | `?toast=` (F3) | Ninguno | `/dashboard?toast=` (no se limpia) |

F2 y F3 se observan en el navegador real, antes y después, tal como los fija la
caracterización. No se probaron otros roles: la entrega no cambia permisos,
rutas ni acciones. Tampoco se ejecutaron acciones que escriben: sus claves no
cambiaron y la prueba de desfase comprueba que cada una tenga entrada.

## Grupo 1 de fixes — Reglas dentro de la transacción y bloqueo de fila

Fecha: 2026-10-09. Estado: cerrado el 2026-10-09. 12 commits de `d421805` a
`bab22eb` y el registro `381de8c`, publicados sobre `40de6b7` (CI #48 en verde,
2m 29s), con foto del «antes» tomada antes del push: las tres carreras se
reprodujeron en staging y ninguna se repitió después. Cierre `bd929bf` (CI #49
en verde), integrado en `main` con el PR #17 (CI #50 en verde; merge commit
`8325194`, CI #51 en verde, 2m 32s). Es el primero de los cuatro
grupos de fixes del bloque de estabilización (ver la secuencia): corrige H1, H3
y H4 de la entrega 6 y tres hallazgos nuevos de su auditoría, H8, H9 y H10.
Cada `fix` cambia el comportamiento solo bajo concurrencia, salvo H9, que
cambia lo que ve el usuario.

| Hallazgo | Defecto | Arreglo |
|---|---|---|
| H3 | `recalculateCostingTotals` leía el costeo y sus costos indirectos, sumaba en JavaScript y escribía el total sin bloquear el costeo. Corrige la descripción de la entrega 6: crear dos costos indirectos a la vez no chocaba, porque el correlativo `CIN` los ponía en fila por accidente; sí chocaban anular ‖ anular, crear ‖ anular, mano de obra ‖ costo indirecto y recalcular ‖ cualquiera. | Bloquea el costeo antes de leer sus montos. Los montos no cambian. |
| H4 | Generar un costeo comprobaba fuera de la transacción si la orden ya tenía uno: un doble envío creaba dos. | La generación entera en una transacción que empieza bloqueando la orden; el segundo envío encuentra el costeo del primero y redirige a él. |
| H1 | Los 7 casos de uso de órdenes de trabajo validaban antes de abrir la transacción: anular ‖ entregar dejaba una orden anulada con salidas, un doble envío de la devolución devolvía dos veces (stock fantasma), uno de la entrega pendiente entregaba dos veces y el cierre podía validar contra lo entregado antes de una entrega simultánea. | Cada caso de uso bloquea la orden y lee y valida dentro. |
| H10 | Dos anulaciones simultáneas del mismo costo indirecto pasaban las dos la comprobación de `[ANULADO]`: dos registros en la bitácora. | Bloquea el costo indirecto antes de leerlo. |
| H8 | Las acciones de avance validaban fuera de una transacción y actualizar escribía el avance, el estado de la orden y la bitácora por separado: doble juego de etapas, una orden anulada que volvía a «en_proceso» o «pendiente», dos etapas terminadas a la vez que no finalizaban la orden, doble reasignación y actualizaciones a medias. | Cada acción bloquea la orden; actualizar es atómica. |
| H9 | La salida de inventario solo comprobaba que la orden existiera: aceptaba órdenes anuladas, finalizadas o con los materiales cerrados, sin pasar por su conciliación. El desplegable excluía «cancelada», un estado que no existe, y ofrecía las anuladas. | Bloquea la orden y aplica la regla de la entrega desde la orden, con el error en el campo de la orden; el desplegable ofrece solo las órdenes que admiten material (decisión del responsable). |

| Commit | Tipo | Cambio |
|---|---|---|
| d421805 | test | El doble de Prisma admite `$queryRaw` solo dentro de una transacción y registra el SQL; `isRowLock` y `expectRowLockedBefore` fijan el protocolo. |
| 7d691c7 | fix | H3: `lockCostingRow` al inicio de `recalculateCostingTotals`. |
| b7e5554 | fix | H4: `createCostingInTransaction` con `lockWorkOrderRow`. |
| c9aa13d | test | El doble rechaza el cliente global mientras haya una transacción abierta. |
| e47b009 | fix | H1: anular y finalizar. |
| af71df7 | fix | H1: entregar lo pendiente, entrega adicional y devolver. |
| 905ae40 | fix | H1: cerrar y reabrir materiales. |
| 93f0fe7 | fix | H10: `lockIndirectCostRow` en la anulación. |
| fbcfd25 | test | 23 casos de las acciones de avance; opción `writesOutsideTransaction`, que solo activa ese archivo. |
| df67332 | fix | H8: generar, actualizar y reasignar avances. |
| 6d65c41 | test | 11 casos de la salida de inventario. |
| bab22eb | fix | H9: la salida a una orden y el desplegable. |

Diseño:

- Un solo patrón: dentro de la transacción, bloquear la fila padre con
  `SELECT … FOR NO KEY UPDATE` antes de leer lo que decide. En READ COMMITTED,
  después de esperar el candado, cada sentencia ve lo que la otra confirmó. Las
  ayudas viven en `src/lib/row-locks.ts`: orden, costeo y costo indirecto.
- `FOR NO KEY UPDATE` y no `FOR UPDATE`: insertar una fila hija toma `FOR KEY
  SHARE` sobre el padre para proteger la clave foránea, y `FOR UPDATE` choca con
  ese candado. Crear un costo indirecto contra actualizar la mano de obra, o una
  entrega contra una salida de inventario a la misma orden, podían bloquearse
  mutuamente. `FOR NO KEY UPDATE` choca consigo mismo y con cualquier `UPDATE`
  del padre, que son las operaciones que hay que poner en fila.
- Orden de candados: primero la orden o el costo indirecto; después el
  correlativo, el material y el costeo. Ningún camino los toma al revés.
- Actualizar y reasignar un avance reciben el avance: leen solo su
  `id_orden_trabajo`, que ningún código cambia, y después bloquean la orden.
- Descartadas: `UPDATE … SET costo_total = (SELECT SUM(…))`, porque en READ
  COMMITTED la subconsulta conserva la foto anterior al candado y la aritmética
  pasaría de doble a decimal; `{ increment }`, que sirve para diferencias y no
  para un total que se recalcula; SERIALIZABLE, que exige reintentar
  (entrega 11); y un índice único en `costeo.id_orden_trabajo` para H4, que
  exige una migración y revisar si producción ya tiene duplicados (pendiente).

Evidencia:

1. Prueba roja primero en cada `fix`, sobre los mismos casos de la
   caracterización: el protocolo con `expectRowLockedBefore` (6 casos de H3, 9
   de H4, 52 de H1, 5 de H10, 18 de H8 y 5 de H9), la atomicidad de actualizar
   un avance (4), los rechazos de H9 (3) y su desplegable (1). Todas fallaban
   antes del arreglo por la razón esperada: no había bloqueo, había escrituras
   fuera de la transacción o se registraba la salida.
2. Snapshots verificados con scripts distintos de los que editaron
   (`tmp/g1-diff`, ignorado): solo cambian snapshots de resultado en los 3
   rechazos de H9; cada snapshot de llamadas cambiado es idéntico a `HEAD` al
   quitar la transacción, el bloqueo y las marcas; los 52 de H1 caen
   exactamente en sus 7 suites; las escrituras marcadas `fueraDeTransaccion`
   pasan de 8 a 0; en la página de salidas solo cambia el filtro y el HTML no.
   Los verificadores se probaron alterando snapshots a propósito.
3. 86 mutaciones distintas: 85 detectadas al primer intento y una que
   sobrevivió en H4 (leer el costeo existente con el cliente global dentro de
   la transacción) hasta que la guarda de `c9aa13d` la detectó.

| Mutación | Resultado |
|---|---|
| Quitar un bloqueo, en cada caso de uso | Fallan su prueba de protocolo y sus snapshots |
| Bloquear después de leer | Ídem |
| `FOR UPDATE` en lugar de `FOR NO KEY UPDATE`, u otro id | Ídem |
| Leer con el cliente global dentro de la transacción | Falla desde `c9aa13d` |
| Bitácora o escritura de un avance fuera de la transacción | Falla la prueba de atomicidad |
| Aceptar en la salida una orden anulada, finalizada o cerrada, o el error en otro campo | Fallan las pruebas de H9 |
| Volver a «cancelada» o quitar el filtro de cierre en el desplegable | Falla la prueba de la consulta y la página |
| Arnés: SQL crudo fuera de la transacción, `return` sin `await`, contador sin reiniciar | Fallan sus pruebas |

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.396, 1.402, 1.412, 1.417, 1.431, 1.460, 1.476, 1.482, 1.507,
1.531, 1.542 y 1.552 pruebas según el commit; 98 archivos de prueba al final. El
código de producción cambia en 10 archivos de `src` (+733 y −517; +296 y −80
sin contar la sangría de los bloques que entraron a la transacción); las
pruebas y el arnés, +1.458 y −25, y los snapshots, +3.304 y −60. `npm run
refactor:inventory` analiza 539 archivos y mantiene 127 páginas, 136
formularios y 48 archivos de acciones: el grupo no agregó superficies
`"use server"`. `work-order-progress/actions.ts` (CRLF) pasa de 427 a 485
líneas.

### Publicación, CI y verificación en staging

- Foto del «antes» tomada el 2026-10-09 **antes del push**, con staging en
  `a9eb6f8` (el código anterior al grupo), con ADMIN desde el navegador
  integrado. Con autorización del responsable para escribir datos de prueba, las
  carreras se provocaron con dos peticiones simultáneas al mismo formulario (como
  dos pestañas o dos usuarios), nunca más de dos.
- Push de 14 commits (`40de6b7` a `381de8c`): CI #48 en verde (2m 29s). Antes del
  «después» se comprobó que staging servía el build nuevo: el desplegable de
  salidas ya no ofrecía la orden anulada `OTR00000007`.

| Hallazgo | Antes (`a9eb6f8`) | Después (`381de8c`) |
|---|---|---|
| H3 | Crear `CIN00000005` (1.00) y `CIN00000006` (2.00) y anularlos a la vez: los dos «Anulado», pero indirecto S/ 1.00 y total S/ 51,121.00 en lugar de 51,120.00. Reproducido al primer intento. | «Recalcular» deja `COS00000002` en 51,120.00. Tres repeticiones con `CIN00000007` a `CIN00000012`: indirecto 0.00 y total 51,120.00 en las dos observadas; la intermedia no se pudo leer y la siguiente la recalcula. |
| H1 | Con 5 por devolver en `OTR00000006`, dos devoluciones de 5 a la vez: entran las dos (`MVI00000040` y `MVI00000041`), devuelto 220 > entregado 215, stock 304.79 (+5 fantasma) y el cierre sugería consumido −5.00. Reproducido al primer intento. | Con 5 por devolver, una devolución entra (`MVI00000043`) y la otra responde 500 después de esperar el bloqueo: entregado 225, devuelto 225, sin stock fantasma. |
| H4 | Dos «Generar costeo» a la vez para `OTR00000008`, creada para la prueba: dos costeos, `COS00000003` y `COS00000004`. Reproducido al primer intento. | Para `OTR00000009`, creada para la prueba: un solo costeo, `COS00000005`; el segundo envío redirige a él y no consume correlativo. |
| H9 | El desplegable ofrecía `OTR00000007` (anulada) y órdenes con materiales cerrados. | El desplegable ya no las ofrece; una salida de 0.01 forzada a `OTR00000007` y a `OTR00000001` (materiales cerrados) se rechaza con su mensaje y no deja movimiento. |

H8 y H10 no se reprodujeron en staging: los cubren las pruebas de protocolo,
las mutaciones y la caracterización. No se probaron otros roles: el grupo no
cambia permisos, rutas ni `requireRole`. Los logs de Vercel no se revisaron.

Incidente durante el «antes», corregido: el primer intento de H1 registró dos
entregas adicionales de 5 (`MVI00000037` y `MVI00000038`) en lugar de dos
devoluciones. El formulario de movimientos pasa de entrega adicional a
devolución en el cliente, y el campo oculto `$ACTION_ID_…` que el servidor pinta
para el envío sin JavaScript sigue siendo el de la entrega adicional. Se repuso
con una devolución de 10 desde la pantalla (`MVI00000039`) y la carrera usó el
identificador de la acción de devolución leído del JavaScript de la página.
Esas dos entregas mostraron H2 en vivo: anotaron en el kárdex el mismo stock
anterior (294.79 → 289.79), y el stock real quedó bien en 284.79.

Datos de prueba que quedan en staging: `OTR00000006` con los materiales
reabiertos (entregado y devuelto 225); `MAT00000006` en 299.79, que incluye los
5 de stock fantasma del «antes» (sin ellos serían 294.79; se corrige con un
ajuste si hace falta); `CIN00000005` a `CIN00000012` anulados en
`COS00000002`; `OTR00000008` con dos costeos del «antes» y `OTR00000009` con uno.
La evidencia está en `tmp/g1-diff/staging-antes.json` y `staging-despues.json`
(ignorados).

Límites y pendientes:

- Las pruebas unitarias fijan el protocolo, no la carrera: la evidencia de la
  carrera es la de staging y la integración con una base desechable sigue en la
  entrega 11.
- Al grupo 2: H2 (el kárdex de entregas y devoluciones toma el stock anterior
  de una lectura sin bloqueo del material; el bloqueo de la orden no lo
  cubre), H5, H6 y H7.
- La segunda petición de una carrera recibe el error de negocio, que hoy se ve
  como la página de error genérica porque estas acciones lanzan (pista B).
- Generar avances no deja registro en la bitácora (visto al caracterizar).
- Índice único para un costeo por orden: migración, previa revisión de
  duplicados.
- Una salida de inventario a una orden sigue sin pasar por la conciliación de
  la orden; quitar esa asociación es de la pista B.

## Grupo 2 de fixes — Kárdex, lecturas y cálculo

Fecha: 2026-10-10. Estado: cerrado el 2026-10-10. 5 commits de `883d629` a
`a662913` y el registro `e33354a`, publicados sobre `bd929bf` junto con
`b9b896f` (CI #52 en verde, 2m 34s), con foto del «antes» tomada antes del
push: H7 y H2 se reprodujeron en staging y ninguno se repitió después. Cierre
`5607085` (CI #53 en verde), integrado en `main` con el PR #18 (CI #54 en
verde; merge commit `4cd66a2`, CI #55 en verde, 2m 31s). Es el segundo de
los cuatro grupos de fixes del bloque de estabilización: corrige H2, H5, H6 y
H7 de la entrega 6. Cada `fix` cambia el comportamiento solo en un caso
límite: H2 bajo concurrencia, H7 cuando el margen real queda a menos de medio
centésimo del esperado, H6 con datos negativos que la interfaz no deja
ingresar, y H5 no cambia lo que se ve, solo las lecturas.

| Hallazgo | Defecto | Arreglo |
|---|---|---|
| H7 | `calculateProfitability` comparaba el margen real en coma flotante, pero `rentabilidad.margen_real` es `Decimal(5,2)` y la pantalla lo muestra con dos decimales: `COS00000001` (margen de 20 % sobre S/ 1514.20, margen real `19.999999999999993`) quedó guardado con margen 20.00 y alerta de margen bajo a la vez. También lo provoca el precio sugerido redondeado al céntimo (1000.01 al 17 % se guarda como 1170.01: 16.9998 %). | La alerta compara el margen redondeado a dos decimales. El margen se sigue devolviendo y guardando sin redondear; la vista previa y la acción se corrigen en un solo lugar. |
| H2 | La entrega y la devolución de material anotaban en el kárdex, y usaban para la alerta de stock crítico, el stock que el caso de uso leyó antes de escribir. Precisión: desde el G1 el bloqueo de la orden pone en fila las operaciones de una misma orden, pero no las de otra orden, una compra o una salida sobre el mismo material. El correlativo `MVI` pone en fila a todos los que escriben el kárdex (otro mutex accidental, como `CIN` en H3), pero la lectura ocurría antes de reservarlo. | El descuento usa `updateManyAndReturn` con la misma guarda y la devolución `update` con `select`, como la compra: el kárdex y la alerta usan el stock y el mínimo que devuelve la escritura, y el anterior se calcula en `Decimal`. `DeliveryLine` y `ReturnParams` ya no reciben stock de quien llama. |
| H6 | El desglose referencial del costeo convertía la receta con `toNumber` y la generación del costeo con `toNonNegativeNumber`, sobre la misma fórmula: con un negativo (la interfaz no lo deja ingresar, pero la base no tiene `CHECK`) mostraba un costo que no se guarda. | El desglose convierte con `toNonNegativeNumber` (decisión del responsable: la vista previa adopta la conversión de lo que se guarda). |
| H5 | Crear una orden por pedido leía el mismo detalle de pedido tres veces, no dos como anotó la entrega 6: dos fuera de la transacción con la misma validación, la segunda con el pedido completo, y una dentro solo para obtener su pedido, que no podía volver vacía (la orden creada referencia el detalle con una clave foránea `Restrict` y ningún código cambia el pedido de un detalle). | Una sola lectura trae el producto, el pedido y su cliente. |

| Commit | Tipo | Cambio |
|---|---|---|
| 883d629 | fix | H7: la alerta de bajo margen compara el margen redondeado a dos decimales. |
| 9ad8d1b | test | El doble de Prisma admite `updateManyAndReturn` en el cliente de la transacción: por defecto afecta una fila generada según su `select`. |
| 7b56f2e | fix | H2: el kárdex y la alerta de stock usan lo que devuelve la escritura. |
| 9f7e08a | fix | H6: el desglose referencial convierte como la generación del costeo. |
| a662913 | fix | H5: una sola lectura del detalle de pedido. |

Diseño:

- H2 con `RETURNING` y no con un bloqueo: la guarda `gte` ya decide de forma
  atómica si el stock alcanza; faltaba anotar el antes y el después, y la base
  los devuelve en la misma sentencia. Es el patrón de compras desde la entrega
  1. Descartadas: bloquear el material con una ayuda de `row-locks.ts` y
  leerlo dentro (una consulta y un candado más por línea para un dato que la
  escritura ya devuelve) y mover la lectura después del correlativo `MVI`
  (dependería de un mutex accidental).
- H7 con el margen como se guarda y se muestra. Descartadas: un criterio en
  dinero (precio ≥ sugerido al céntimo), que podría mostrar «17.00 % · Margen
  bajo» y repetir la contradicción, y una tolerancia de `1e-9`, que corrige la
  coma flotante pero no el redondeo del precio. Límite: `toFixed` redondea el
  valor binario y Postgres el decimal; solo difieren en un empate exacto en el
  tercer decimal.
- H5 borra el caso de caracterización «si el detalle ya no existe dentro de la
  transacción, no actualiza el pedido» (decisión del responsable): su rama ya
  no existe y lo reemplaza la prueba de H5.
- H11, encontrado en la auditoría, se registra sin corregir (decisión del
  responsable): necesita una regla de negocio y toca el área comercial.

Evidencia:

1. Prueba roja primero en cada `fix`. H7: 4 casos de la función y 3 de la
   acción que leen lo que se escribe en `rentabilidad`; fallaban 5, y los dos
   de «sigue siendo margen bajo» pasaban, como deben. H2: 3 casos donde la
   base tiene otro stock al escribir (entrega pendiente, adicional y
   devolución); fallaban con el stock leído (100, 40 y 5 en lugar de 70, 12 y
   15) y fijan también la decisión de la alerta, que con la lectura habría
   atendido una alerta en un material crítico o dejado activa la de uno que
   salió de crítico. H6: 4 casos, uno por entrada negativa, en
   `recipe-cost-breakdown.test.ts`. H5: una lectura en lugar de 3. El arnés
   tuvo la suya: el doble rechazaba el método.
2. Snapshots verificados con scripts distintos de los que editaron
   (`tmp/g2-diff`, ignorado). H7, el arnés y H6 no cambian ninguno. H2 cambia
   5 de llamadas, idénticos a los anteriores al deshacer el método (7), el
   `select` (9) y `Decimal(x)` en el kárdex (16 = 8 movimientos × 2). H5 cambia
   3 de llamadas, idénticos salvo la lectura del detalle (15 llamadas iguales
   en el caso de éxito), y elimina los 2 del caso borrado. Ningún snapshot de
   resultado cambia. Cada verificador detectó alteraciones hechas a propósito.
3. 38 mutaciones, todas detectadas al primer intento: 8 de H7, 7 del arnés, 10
   de H2, 6 de H6 y 7 de H5.

| Mutación | Resultado |
|---|---|
| H7: volver al doble; redondear a 1 o 3 decimales o al entero; truncar; `<=`; tolerancia `1e-9`; devolver el margen redondeado | Todas fallan; el caso de 16.996 % separa dos de tres decimales |
| Arnés: quitar el método de las escrituras; devolver `[]`, `data`, la fila sin arreglo, la fila 2 o sin `select`; tratarlo como `updateMany` | Todas fallan |
| H2: signo del anterior en la entrega o la devolución; anterior igual al resultante; alerta con el stock anterior; `select` sin el mínimo; devolución sin `select`; sin la guarda `gte`; sin comprobar que la guarda encontró la fila; anterior y resultante intercambiados | Todas fallan; la devolución sin `select` solo por su snapshot, porque Prisma devuelve la fila completa |
| H6: revertir cada una de las cuatro conversiones; valor absoluto en la merma o el costo | Todas fallan, cada una en su propio caso |
| H5: actualizar el pedido con el id del detalle; orden sin cliente; no pasar el pedido a producción; `select` sin el pedido; volver a leer el detalle fuera o dentro de la transacción; no comprobar el producto | Todas fallan |

Datos de prueba de H2: el doble no aplica escrituras, así que los 5 casos que
llegan a escribir el material declaran con `stockInDb` el stock que tiene la
base (el mismo que leen). El caso «la guarda de stock falla» pasa de fijar
`material.updateMany` con `count: 0` a «la base tiene 5.00 de soldadura y se
piden 8.57», con el mismo rollback y el mismo mensaje.

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.559, 1.560, 1.563, 1.568 y 1.568 pruebas según el commit; 99
archivos de prueba al final. El código de producción cambia en 5 archivos de
`src` (+85 y −85); las pruebas y el arnés, +474 y −18, y los snapshots, +79 y
−252. `npm run refactor:inventory` analiza 540 archivos y mantiene 127
páginas, 136 formularios y 48 archivos de acciones.

### Publicación, CI y verificación en staging

- Foto del «antes» tomada el 2026-10-10 **antes del push**, con staging en
  `bd929bf` (el código del G1), con ADMIN desde el navegador integrado. Con
  autorización del responsable para escribir datos de prueba: un margen y una
  rentabilidad para H7, y carreras de exactamente dos peticiones simultáneas
  para H2, cada una seguida de dos devoluciones que reponen el stock.
- `COS00000001` ya no servía para H7: su costo subió de S/ 1414.20 a S/ 1514.20
  después del último margen, y la vista previa da 12.08 %, un margen bajo de
  verdad. El defecto sí está en sus dos rentabilidades guardadas («20.00 % ·
  margen bajo»). Se usó `COS00000002` con un margen de 18 %: sugerido
  S/ 60,321.60 sobre S/ 51,120.00, margen real `17.999999999999996`.
- Push de 7 commits (`b9b896f` y de `883d629` a `e33354a`): CI #52 en verde
  (2m 34s). **Vercel no creó ningún despliegue para ese push** (ni fila en
  Deployments ni estado en GitHub para `e33354a`); el responsable lo creó a
  mano con «Create Deployment» sobre la rama `staging` (Preview), y Vercel
  publicó el estado de `e33354a` (pendiente 02:46:59, completado 02:48:36 UTC).
  Antes del «después» se comprobó que la URL de rama servía el código nuevo: la
  vista previa de `COS00000002`, sin cambiar sus datos, pasó de «margen bajo»
  (02:39 UTC) a «rentable» (02:49 UTC). La huella de fragmentos JavaScript no
  sirve en este grupo: solo cambió código de servidor (1 de 14 fragmentos
  cambió).

| Hallazgo | Antes (`bd929bf`) | Después (`e33354a`) |
|---|---|---|
| H7 | `COS00000002` al 18 %: vista previa «18.00 % · margen bajo» y rentabilidad guardada igual (9:26 p. m.): el registro dice 18.00 % y margen bajo a la vez. | Con la misma entrada, vista previa y rentabilidad guardada «18.00 % · rentable» (9:49 p. m.); el historial muestra las dos filas juntas. |
| H2 | Dos entregas adicionales simultáneas de 1.00 de `MAT00000006`, a `OTR00000006` y `OTR00000008`. Primer intento encadenado (`MVI00000044/45`): la segunda leyó después de que la primera confirmó. Reintento con un GET previo a las dos órdenes: `MVI00000048` y `MVI00000049` anotan las dos 299.79 → 298.79 con el stock real en 297.79, y la fila siguiente (`MVI00000050`) parte de 297.79. Reproducido 1 de 2 veces. | La misma carrera, con el GET previo, 3 veces: 3 de 3 encadenadas (`MVI00000052` a `MVI00000063`), todas las peticiones 200 sin error. La cadena del kárdex de `MAT00000006` de `MVI00000043` a `MVI00000063`, verificada por programa: 0 filas incoherentes y solo las 2 rupturas del «antes». |

Con el código nuevo el kárdex encadena por construcción: estas carreras no
prueban que las transacciones se solaparon, sino que en las condiciones en que
el código anterior rompió el kárdex el nuevo no lo hizo. H5 y H6 no se
reproducen en staging (H6 necesitaría escribir un negativo directamente en la
base y H5 no es visible). No se probaron otros roles: el grupo no cambia
permisos, rutas ni `requireRole`. Los logs de Vercel no se revisaron.

Datos de prueba que quedan en staging: `COS00000002` con un margen de 18 % y
dos rentabilidades nuevas (margen bajo antes, rentable después);
`OTR00000006` y `OTR00000008` con 5 entregas adicionales y 5 devoluciones de
1.00 cada una (`MVI00000044` a `MVI00000063`); `MAT00000006` sigue en 299.79.
La evidencia está en `tmp/g2-diff/staging-antes.json` y `staging-despues.json`
(ignorados).

Hallazgo nuevo de la auditoría, registrado y no corregido:

- H11: crear una orden por pedido no comprueba el estado del pedido y lo pasa
  a «en_produccion» sin condición. El desplegable solo ofrece detalles de
  pedidos «registrado» o «aprobado», pero un formulario viejo o manipulado
  puede crear una orden para un pedido cancelado o entregado y devolverlo a
  «en producción». Además, `cancelOrderAction` valida fuera de una transacción:
  cancelar ‖ crear una orden puede dejar un pedido cancelado con orden.
  Necesita la regla de qué estados de pedido admiten una orden de trabajo.

Límites y pendientes:

- Las pruebas fijan la secuencia, no la carrera: la evidencia de H2 bajo
  concurrencia es la de staging, y es probabilística (la carrera depende de
  cuándo llega cada petición); la integración con una base desechable sigue en
  la entrega 11.
- Las rentabilidades ya guardadas conservan su alerta (las dos de
  `COS00000001` en staging): el reporte de rentabilidad mezclará los dos
  criterios hasta que se recalculen. Corregir esos datos es una decisión
  aparte.
- El servidor acepta cantidades de entrega y devolución con más de dos
  decimales (solo el navegador limita con `step="0.01"`): con ellas el kárdex
  no puede encadenar exacto, con cualquier arreglo.
- Las entregas comparan con `stock_actual` y la salida de inventario con
  `stock_actual − stock_reservado`.
- Un pedido con varios detalles pasa a «en producción» con la primera orden y
  el desplegable deja de ofrecer sus otros detalles (regla de negocio, junto
  con H11).

## Grupo 3 de fixes — Puente de notificaciones

Fecha: 2026-10-10. Estado: cerrado el 2026-10-10. 4 commits de `039b65f` a
`7453c57` y el registro `803f32e`, publicados sobre `5607085` junto con
`a564ed7` (CI #56 en verde, 2m 32s), con foto del «antes» tomada antes del
push y de solo lectura: F1, F2, F3 y la clave sin emisor se reprodujeron en
staging y ninguno se repitió después. Cierre `bc5afb1` (CI #57 en verde),
integrado en `main` con el PR #19 (CI #58 en verde; merge commit `b65d8c9`,
CI #59 en verde, 2m 30s). Es el tercero
de los cuatro grupos de fixes del bloque de estabilización: corrige F1, F2 y
F3 del puente `?toast=` y retira la entrada sin emisor, los cuatro
comportamientos que la entrega 7 conservó y fijó con su caracterización. Los
cuatro cambian lo que ve el usuario; solo F1 se nota en el uso normal.

| Hallazgo | Defecto | Arreglo |
|---|---|---|
| F2 | El puente consultaba el registro por propiedad: `?toast=toString`, `constructor`, `__proto__` y los demás nombres de `Object.prototype` encontraban algo heredado, y `notify` lo mostraba como un toast info vacío. | Solo cuentan las claves propias del registro (`Object.hasOwn`): esas claves son claves sin entrada, no muestran nada y limpian la URL. |
| F3 | El puente salía con `!toastKey`, que mezcla un parámetro ausente (`null`) con uno vacío (`""`): con `?toast=` vacío no mostraba nada y tampoco limpiaba la URL. | Sale solo con `toastKey === null`; el vacío se limpia conservando los demás parámetros. Con `toast` repetido sigue contando el primero. |
| F1 | El ref guardaba la última clave mostrada y nunca se reiniciaba, y como el puente vive en el layout del dashboard esa memoria duraba toda la sesión. Una segunda operación igual (dos clientes creados seguidos) no mostraba su toast y dejaba `?toast=` en la URL; al recargar aparecía un toast viejo. | El ref se reinicia cuando la URL llega sin `?toast=`: solo evita repetir la misma URL, como en el efecto doble del modo estricto. |
| Clave sin emisor | Ningún archivo emitía `work-order-materials-consumed` desde `5599788` (2026-08-03): una URL antigua mostraba «Consumo de materiales registrado» sin que ocurriera. | Se retira del catálogo de Producción; `CLAVES_SIN_EMISOR` queda vacío y se conserva. |

| Commit | Tipo | Cambio |
|---|---|---|
| 039b65f | fix | F2: solo cuentan las claves propias del registro; `notify` gana una prueba directa de su caso por defecto. |
| b7a1970 | fix | F3: un `?toast=` vacío se limpia. |
| a727581 | fix | F1: el ref se reinicia cuando la URL llega sin `?toast=`. |
| 7453c57 | fix | Retira `work-order-materials-consumed`; la lista fija del puente pasa de 124 a 123 claves. |

Diseño:

- Orden F2 → F3 → F1 → clave: de lo más aislado a lo más visible. F1
  reinicia el ref dentro de la rama `toastKey === null` que F3 deja exacta.
- F1 sin identificadores de operación en la URL. La sección 7 del plan los
  prevé, pero ponerlos ahora en los 47 archivos emisores se descartaría en la
  pista B: la sección 8 lleva el identificador en el resultado tipado de la
  acción, sin pasar por la URL, y el puente queda como adaptador hasta la
  entrega 11. El arreglo no cambia el contrato `?toast=<clave>` ni los
  emisores. La URL limpia marca el límite entre dos operaciones: cada una
  termina en una navegación nueva (en Next 16 el `redirect` de una Server
  Action hace `push`) y el puente limpia la URL antes de la siguiente. Límite:
  dos operaciones iguales que llegaran antes de que termine el
  `router.replace` de la primera mostrarían un solo toast; lo resuelven los
  identificadores de la pista B.
- F3 deja su marca en el ref: `?toast=a`, `?toast=` y otra vez `?toast=a` en
  el mismo montaje muestran las dos `a`. Es coherente con F1: la URL perdió
  la clave.
- F2 en el puente y no en el registro: un registro sin prototipo también lo
  corrige, pero `Object.hasOwn` deja la regla junto a la consulta con el texto
  libre de la URL; un consumidor tipado con `NotificationKey` no la necesita.
  `notify` conserva su caso por defecto (info) y gana una prueba directa:
  hasta F2 solo lo cubrían los casos F2 del puente.
- Antes de retirar la clave se confirmó que nada la emite ni la guarda: solo
  aparecía en el catálogo, las pruebas, su snapshot y este documento. La
  acción que la emitía registraba en la bitácora `consumir_materiales` con un
  detalle sin URL (ningún archivo usa hoy esa acción) y ninguna columna del
  esquema guarda URLs.

Evidencia:

1. Prueba roja primero en cada `fix`. F2: 12 de 12, los 12 nombres propios de
   `Object.prototype` (antes se probaban 5). F3: 4 de 4, `toast=`, `toast` sin
   `=`, el vacío entre otros parámetros y el vacío seguido de otra clave. F1:
   2 de 2, dos operaciones iguales seguidas desde el listado filtrado y
   pasando por el formulario; cada caso exige que la segunda produzca las
   mismas llamadas que la primera. La clave: 2 de 2, en los casos de clave sin
   entrada y con `CLAVES_SIN_EMISOR` vacío. Al retirar la entrada, la lista
   fija hizo fallar su caso, como diseñó la entrega 7.
2. Snapshots: F2 borra los 5 que fijaban el toast vacío (80 líneas) y la clave
   el suyo (16). Ninguno más cambia; el del modo estricto sigue igual en F1.
3. Comparación diferencial fuera del repositorio (`tmp/g3-diff`, ignorado,
   `npx vitest run --config tmp/g3-diff/vitest.config.ts`): el puente de
   `a564ed7`, con el registro de ese commit congelado en JSON, y el puente
   nuevo se comparan paso a paso, y cada paso distinto debe caer en
   exactamente una categoría (F1, F2, F3 o la clave retirada). Resultado
   final: 5.881 claves solas (12 F2, 1 F3, 1 retirada y 5.867 idénticas); una
   batería de dos operaciones iguales seguidas para 138 claves (1.242 pasos:
   274 F1, 24 F2, 4 F3, 2 retirada y 938 idénticos, entre ellos todos los
   renders dobles), y 20.000 secuencias al azar (89.647 pasos: 2.369 F2, 178
   F3, 594 retirada, 37 F1 y 86.469 idénticos). Cada commit agregó solo su
   categoría; tras F3 apareció un caso de F1 por un `?toast=` vacío y ninguno
   por una URL sin toast, como se predijo. Control: detecta un texto, una
   severidad, el `scroll` y una entrada con emisor borrada.
4. 22 mutaciones, todas detectadas: 7 de F2, 4 de F3, 6 de F1 y 5 de la clave.

| Mutación | Resultado |
|---|---|
| F2: consulta por propiedad; `in`; `Boolean(…)`; condición negada; `notify` con `showToast(definition.type, …)`, por defecto success o sin descripción | Todas fallan |
| F3: `!toastKey`; comparar con `undefined`; salir también con `""`; limpiar de más | Todas fallan; `undefined` por el snapshot de dos claves distintas seguidas (un `router.replace` de más en cada URL sin toast) |
| F1: no reiniciar el ref; reiniciarlo en cada render; sin deduplicación; reiniciarlo solo si la URL queda sin parámetros o solo al cambiar de ruta; no guardar la clave mostrada | Todas fallan; la de «sin parámetros» obligó a llevar `q=acero` en un caso |
| Clave: devolverla a Producción, a Costos o con otro texto; declararla sin entrada; volver a meterla en la lista fija | Todas fallan |

La última mutación agregaba un caso con `toMatchSnapshot` y Vitest escribió su
snapshot, pero `mutate.py` solo restauraba el archivo mutado. Se vio en el
diff del snapshot antes del commit (8 líneas en lugar de 16); se limpió y
`mutate.py` ahora guarda y restaura también el `.snap` de cada prueba.

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.576, 1.579, 1.580 y 1.580 pruebas según el commit; 99 archivos
de prueba al final. El código de producción cambia en 3 archivos de `src` (+17
y −13); las pruebas, +78 y −28, y los snapshots, −96. `npm run
refactor:inventory` analiza 540 archivos y mantiene 127 páginas, 136
formularios y 48 archivos de acciones.

| Caso | Antes | Después |
|---|---|---|
| Dos operaciones iguales seguidas (crear dos clientes) | La segunda no muestra toast y deja `?toast=` en la URL; al recargar aparece un toast viejo | Cada una muestra su toast y la URL queda limpia |
| `?toast=toString` y los otros 11 nombres de `Object.prototype` | Toast info vacío | Nada; la URL se limpia |
| `?toast=` vacío | Nada; la URL no se limpia | Nada; la URL se limpia |
| `?toast=work-order-materials-consumed` | success: «Consumo de materiales registrado» | Nada; la URL se limpia |
| Las 123 claves, el modo estricto y el remontaje | — | Sin cambios |

### Publicación, CI y verificación en staging

- Foto del «antes» tomada el 2026-10-10 **antes del push**, con staging en
  `5607085` (el puente de la entrega 7), con ADMIN desde el navegador integrado
  y de solo lectura: ninguna URL escribe en la base, y F1 se reprodujo sin
  escribir datos con `history.pushState`, que Next 16 integra con
  `useSearchParams` (la misma clave llega dos veces al puente montado, como
  tras dos operaciones iguales). 23 observaciones secuenciales: las 14 URLs de
  la entrega 7, cuatro variantes de F2 y F3, la secuencia de F1 (dos
  `pushState` iguales y una recarga) y un control con dos claves distintas.
  Método de la entrega 7 (navegación completa, espera de 1,5 s y lectura del
  DOM); tras cada `pushState`, espera a que la URL se limpie (máximo 6 s) y
  solo cuenta los toasts nuevos. Cada observación se guardó con su SHA-256 en
  `sessionStorage`.
- El «antes» es fiel y comparable: Python recalculó los 23 hashes y el sello
  del navegador sobre la lista de hashes; las 14 URLs de la entrega 7 dieron
  los mismos hashes que su foto (`tmp/e7-diff/staging-antes.json`), y la
  huella de fragmentos JavaScript era la del «después» de la entrega 7. Antes
  del push, `verify_antes.py` aplicó al «antes» las cuatro reglas del grupo y
  calculó el hash y el sello esperados del «después»: cambian 9 observaciones
  y 14 no.
- Push de 6 commits (`a564ed7` y de `039b65f` a `803f32e`): CI #56 en verde
  (2m 32s). Esta vez Vercel desplegó solo (estado de `803f32e` pendiente
  04:17:24 y completado 04:18:40 UTC). Antes del «después» se comprobó que la
  URL de rama servía el build nuevo: cambiaron el `buildId` y exactamente un
  fragmento JavaScript de `/dashboard` (`2abf04v5qqx7g.js` →
  `10w79wvka5nbj.js`), el del puente. El viejo contiene
  `if(!t||o.current===t)return` y el texto «Consumo de materiales registrado»;
  el nuevo, `if(null===t){o.current=null;return}` y `Object.hasOwn(s,t)`, sin
  ese texto.
- «Después» con el mismo procedimiento: **23 de 23 hashes iguales a los
  esperados y el mismo sello**; 9 distintas del «antes», exactamente las
  previstas.

| # | Caso | Antes (`5607085`) | Después (`803f32e`) |
|---|---|---|---|
| 11 | `?toast=work-order-materials-consumed` | success: «Consumo de materiales registrado» | Nada; `/dashboard` |
| 13, 15, 16 | `toString`, `constructor` y `__proto__` (F2) | Toast info vacío | Nada; `/dashboard` |
| 14, 17 | `?toast=` y `?toast` (F3) | Nada; la URL no se limpia | Nada; `/dashboard` |
| 18 | `/dashboard/commercial/clients?page=1&toast=` (F3) | Nada; la URL no se limpia | Nada; `?page=1` |
| 19a | `pushState` a `/dashboard?toast=client-created` | «Cliente guardado correctamente»; URL limpia en 102 ms | Igual (105 ms) |
| 19b | El mismo `pushState` otra vez (F1) | Ningún toast; la URL se queda en `?toast=client-created` (6 s) | «Cliente guardado correctamente»; URL limpia en 103 ms |
| 19c | Recargar la página (F1) | Reaparece «Cliente guardado correctamente» | Nada |
| 1–10, 12, 20a y 20b | Diez claves de la entrega 7, `no-existe` y el control con dos claves distintas | — | Idénticas |

No se probaron otros roles: el grupo no cambia permisos, rutas ni acciones.
No se escribieron datos, así que no quedan datos de prueba nuevos en staging.
La evidencia está en `tmp/g3-diff/staging-antes.json`,
`despues-esperado.json` y `staging-despues.json` (ignorados); el «después» se
copió por programa de `despues-esperado.json`, porque el navegador confirmó
sus 23 hashes y su sello.

Límites:

- El modo estricto solo se prueba con el doble de React: staging sirve el
  build de producción, sin modo estricto, y `npm run dev` necesita la base.

## Grupo 4 de fixes — Divergencias entre pantalla y exportación

Fecha: 2026-10-12. Estado: cerrado el 2026-10-12. 9 commits de `b03ed6d` a
`7e7a1d9`, el registro `3de09c5`, el fix `4b5fbd3` (hallazgo de la foto del
«antes») y su registro `5879d91`, publicados sobre `bc5afb1` junto con
`6414798` (CI #60 en verde, 2m 38s), con foto del «antes» tomada antes del
push: D1 y las fechas mal escritas se reprodujeron en staging y ninguno se
repitió después, y la foto descubrió el prefetch de las exportaciones. Cierre
`3d10c09` (CI #61 en verde), integrado en `main` con el PR #20 (CI #62 en
verde; merge commit `19a0bf4`, CI #63 en verde, 2m 27s). Es el último de los
cuatro grupos de fixes del
bloque de estabilización: corrige las divergencias entre pantalla y exportación
que la entrega 5 conservó y documentó junto a ambas consultas (D1, D2 y las
diferencias de fechas, forma y alias de personal, rentabilidad y auditoría).
Desde este grupo, en los cuatro reportes la pantalla y su exportación
construyen el filtro con la misma función y leen los mismos parámetros: los que
genera el enlace de la pantalla.

| Hallazgo | Defecto | Arreglo |
|---|---|---|
| D1 | La búsqueda de fallas de mantenimiento incluía el código interno de la máquina en la pantalla y no en el archivo (opción `includeMachineCode`). | El constructor compartido busca siempre en `codigo_interno`; la opción desaparece. |
| D2 | Con margen bajo y utilidad negativa a la vez, el objeto plano de la exportación de rentabilidad usaba dos veces la clave `rentabilidad` y la segunda pisaba a la primera: el archivo ignoraba el margen bajo. | Pantalla y exportación usan el mismo constructor, que combina las condiciones con `AND`. |
| Fechas | Las pantallas de personal, rentabilidad y auditoría leían las fechas con `parseDateParam` y cerraban «hasta» con `lte` a las 23:59:59.999; su exportación y las otras 6 pantallas usan `buildReportDateRange`, que cierra con `lt` el día siguiente. | Las tres pantallas pasan las fechas de la URL y usan `buildReportDateRange`. |
| Forma | Personal y auditoría exportaban con un objeto plano y la pantalla combinaba con `AND`: el mismo SQL, pero en rentabilidad era la causa de D2. | Un solo constructor por reporte: `buildCostingWhere`, `buildPayrollWhere` y `buildAuditLogWhere`. |
| Alias | Los exportadores de personal, rentabilidad y auditoría leían primero 15 nombres que ninguna versión de sus páginas generó (`dateFrom`, `searchText`, `operatorId`...) y solo después los de la pantalla, y la ruta validaba el rango con `dateFrom` o `from` en los 9 reportes. Con los dos nombres, el archivo filtraba por el alias y la pantalla por el suyo. | Cada exportador lee solo los nombres de su pantalla; cada reporte declara sus nombres de fecha (`dateParams`) en `lib/reports/report-registry.ts` y la ruta valida solo con ellos. |

| Commit | Tipo | Cambio |
|---|---|---|
| b03ed6d | fix | D1: mantenimiento exporta buscando también por código interno. Prueba nueva de paridad. |
| 80ee9aa | fix | D2: rentabilidad comparte el constructor con `AND`; cada lado conserva aún su rango. |
| 009e24b | fix | Fechas de la pantalla de rentabilidad. |
| 5c1a01d | fix | Fechas de la pantalla de personal: planillas y conteos de asistencias. |
| 57a8514 | fix | Fechas de la pantalla de auditoría. |
| 629a47a | fix | Rentabilidad exporta solo con los parámetros de la pantalla. |
| d81b746 | fix | Personal exporta con el filtro y los parámetros de la pantalla. |
| 2d91741 | fix | Auditoría exporta con el filtro y los parámetros de la pantalla. |
| 7e7a1d9 | fix | La ruta valida el rango con los parámetros de fecha de cada reporte. |
| 4b5fbd3 | fix | Los botones de exportación de personal, rentabilidad y auditoría pasan de `<Link>` a `<a>`: el prefetch de Next registraba exportaciones (hallazgo de la verificación). |

Diseño:

- El lado correcto de cada divergencia se decidió con el responsable: en D1 y
  D2, la pantalla (muestra el código interno; marcar dos filtros pide su
  intersección); en las fechas, la exportación (`lt`, ver la demostración);
  en la forma, `AND` (una condición no puede pisar a otra), y en los
  parámetros, los de la pantalla.
- Demostración antes de decidir las fechas, fuera del repositorio
  (`tmp/g4-diff/pglite`, ignorado): PGlite (Postgres 17 en WASM, que ya trae
  `prisma dev`, en memoria y sin red), las 20 migraciones, el cliente generado
  con `adapter-pg` y las funciones reales de pantalla y exportación de los
  tres reportes, con filas en los bordes del rango. Antes, en UTC (Vercel), la
  pantalla de auditoría perdía las entradas de 23:59:59.999400 y
  23:59:59.999999 (`fecha_hora` es `timestamptz(6)` y guarda microsegundos),
  y personal y rentabilidad (columnas `date`) daban las mismas filas; en la
  zona de Lima (`npm run dev`), las pantallas de personal y rentabilidad
  incluían el día siguiente a «hasta», porque Postgres convierte a `date` el
  parámetro `2026-08-01T04:59:59.999Z`. Después, pantalla y exportación
  devuelven las mismas filas en los tres reportes y en las dos zonas. El
  intervalo semiabierto `[desde, día siguiente)` no depende de la precisión
  del reloj ni del tipo de columna.
- Alias retirados y no conservados con precedencia de la pantalla: `git log
  -S` muestra que ninguna versión de las tres páginas generó esos nombres
  desde que se crearon (`87ccb97`, 2026-07-02), y ningún otro código genera
  enlaces de exportación (`exportacion_datos.parametros` solo se muestra). El
  enlace de la pantalla es el contrato de la exportación.
- Los nombres de fecha viven en el registro y no en cada exportador: la ruta
  valida antes de llamar al exportador (un 400 no consulta ni escribe), así
  que necesita conocerlos sin ejecutarlo, y `report-registry` ya guarda los
  metadatos de cada reporte sin depender de Prisma. Una prueba por reporte
  exige que su exportador filtre con los nombres que valida la ruta.
- Orden D1 → D2 → fechas → parámetros → ruta. D2 compartió el constructor
  antes de igualar las fechas, recibiendo de cada lado su rango, para que
  cada commit cambiara un solo comportamiento.
- Cada pantalla y su exportación conservan su límite, su orden y sus columnas:
  siguen siendo distintos a propósito (la exportación desempata por id).

Evidencia:

1. Prueba roja primero en cada `fix`. La prueba nueva de paridad
   (`api/reports/export/[report]/screen-parity.test.ts`) ejecuta la página
   real, toma su enlace «Exportar Excel», lo pasa por la ruta y exige el mismo
   `where` en la consulta principal; mientras la exportación de personal y
   auditoría armaba otro filtro, comparó solo la condición de fecha. Fallaban
   antes de su arreglo: D1 en 2 de 3 casos, D2 en 2 de 3, las fechas en 3, 4
   y 4, y los parámetros en 2, 6 y 6 (con los dos nombres, el archivo filtraba
   otro mes, otro operario u otro usuario). La ruta gana 36 pruebas, 4 por
   reporte; las 18 del registro y de los nombres ajenos fallaban antes.
2. Snapshots, todos a propósito y clasificados por el diferencial. Ruta: D1
   (+8 líneas), D2 (uno de forma y uno de D2), alias de rentabilidad (−48),
   personal y auditoría (uno de forma y uno de alias cada uno) y el caso de la
   entrega 5 que fijaba el rechazo por el alias, que pasa a los casos de
   producción con un nombre que describe lo que hace ahora (de 400 a 200).
   Páginas: una línea en rentabilidad y 4 en personal y en auditoría, de `lte`
   a `lt`. Ningún HTML cambia.
3. Comparación diferencial fuera del repositorio (`tmp/g4-diff`, ignorado,
   `G4_STAGE=<fixes> npx vitest run --config tmp/g4-diff/vitest.config.ts`): la
   ruta, el registro, los exportadores, las consultas y las cuatro páginas de
   `6414798` se ejecutan en el mismo proceso que el código nuevo, con los
   generadores reales de Excel y PDF. Para cada caso se predice la salida
   nueva aplicando a la línea base las reglas de los fixes activos, y la
   salida real debe coincidir con la predicción; una diferencia sin explicar
   hace fallar la prueba. Batería: 613 exportaciones de los 9 reportes (con los
   nombres de la pantalla, los retirados, mezclados, fechas mal escritas e
   invertidas, y las consultas exactas de `route.test.ts`) y 134 pantallas.
   Resultado final: exportaciones, 384 idénticas y 229 explicadas (alias 134,
   forma 130, ruta 58, D1 12 y D2 2, contando cada combinación en cada una de
   sus categorías); pantallas, 75 de fechas y 59 con las mismas consultas,
   con el HTML idéntico en las 134 salvo el orden de los atributos de los
   enlaces de exportación de las 3 pantallas que pasan a `<a>` (categoría
   «L» desde `4b5fbd3`). Paridad de los enlaces de las pantallas: de 98
   distintos, 30 iguales y 6 rechazados a 0 distintos, 128 iguales y 6
   rechazados. Cada commit agregó solo su categoría y, como control, el
   diferencial sin el fix de cada commit falla. Los archivos y los efectos son
   idénticos salvo donde cambia el estado HTTP.
4. 38 mutaciones, todas detectadas: 4 por cada uno de los 9 primeros `fix`
   y 2 del de prefetch.

| Mutación | Resultado |
|---|---|
| D1: quitar el código interno del constructor, excluirlo solo en la exportación, buscarlo sin `mode` o en otra columna | Todas fallan; la primera solo por los snapshots, porque los dos lados lo pierden a la vez |
| D2: volver al objeto plano, ignorar de nuevo el margen bajo, no aplicar el margen, ignorar la búsqueda | Todas fallan |
| Fechas (×3): volver a `lte`, ignorar «hasta», cruzar las fechas, recortar o vaciar una fecha | Todas fallan; la de las asistencias de personal solo por el snapshot de la página, porque la exportación no consulta asistencias |
| Parámetros (×3): volver a aceptar un alias, volver al objeto plano, leer un parámetro con otro nombre, ignorar un parámetro | Todas fallan |
| Ruta: volver a `dateFrom` o `from`, declarar mal los nombres de personal, leer «hasta» con el nombre de «desde», ignorar el registro | Todas fallan |
| Prefetch: volver a `<Link>`, `<Link prefetch={false}>` | Ambas fallan |

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.583, 1.586, 1.589, 1.594, 1.599, 1.601, 1.603, 1.605, 1.641
y 1.650 pruebas según el commit; 101 archivos de prueba al final. El código
de producción cambia en 12 archivos de `src` (+141 y −202) y en
`eslint.config.mjs` (+23); las pruebas, en 3 (+532 y −5), y los snapshots,
en 4 (+301 y −238). `npm run refactor:inventory` analiza 542 archivos y
mantiene 127 páginas, 136
formularios y 48 archivos de acciones; desplaza la línea del formulario de
las tres páginas.

| Caso | Antes | Después |
|---|---|---|
| Exportar mantenimiento con una búsqueda | El archivo no incluye las fallas cuya máquina tiene ese código interno | Las incluye, como la pantalla |
| Exportar rentabilidad con margen bajo y utilidad negativa | El archivo ignora el margen bajo | Aplica los dos, como la pantalla; en datos reales casi nunca cambia filas, porque una utilidad negativa suele traer la alerta |
| Pantalla de auditoría con «hasta» | Pierde las entradas del último milisegundo del día | Las incluye, como el archivo |
| Pantallas de personal y rentabilidad con «hasta», en local (Lima) | Incluyen el día siguiente | No lo incluyen; en producción no cambia nada |
| Fecha mal escrita en la URL de esas tres pantallas (`2026-7-5`) | La pantalla la ignora y el archivo la interpreta | Las dos la interpretan |
| URL de exportación escrita a mano con `dateFrom`, `operatorId`, `searchText`... en personal, rentabilidad o auditoría | Filtra por esos nombres, antes que por los de la pantalla | No filtran |
| URL de exportación con un rango invertido en nombres que el reporte no lee | 400 | Se ignoran: 200 |
| Abrir la pantalla de personal, rentabilidad o auditoría (build de producción) | Registra exportaciones fantasma con `_rsc` en `exportacion_datos` y en la bitácora | No registra nada |
| Clic en «Exportar» de esas pantallas | Dos registros: uno con `_rsc` y la descarga real | Uno |
| Enlaces de exportación de las pantallas, aspecto y permisos | — | Sin cambios (el HTML solo cambia el orden de los atributos de esos enlaces) |

Hallazgo de la paridad, registrado y no corregido: con «desde» posterior a
«hasta», una pantalla de reportes muestra la tabla vacía y su enlace de
exportación responde 400 con un JSON (6 casos de personal en la batería): el
usuario que exporta ve un error en lugar de un archivo vacío. Es de
experiencia de usuario y corresponde a la pista B.

Hallazgo de la foto del «antes», corregido en `4b5fbd3`: las pantallas de
personal, rentabilidad y auditoría no eran de solo lectura. Sus botones de
exportación eran `<Link>` de `next/link` (desde `87ccb97`, 2026-07-02), y en
el build de producción Next hace prefetch de cada `<Link>` visible con un GET
a su URL (`?_rsc=…`). Como esa URL es la ruta de exportación, cada visita
registraba exportaciones en `exportacion_datos` y en la bitácora y generaba
los archivos, y un clic en «Exportar» registraba dos: el GET con `_rsc` de la
navegación de cliente y la descarga real. Las otras 6 pantallas usan `<a>`.
Nadie lo había visto: `npm run dev` no hace prefetch automático, el HTML de
un `<Link>` es igual al de un `<a>` y la verificación de la entrega 5 en
producción leyó el HTML con `fetch`, que no ejecuta JavaScript. La foto del
«antes» de este grupo, tomada recorriendo esas pantallas en el navegador,
registró 45 exportaciones fantasma en staging (`EXP00000027` a
`EXP00000071`) sin autorización, porque se suponía que esas pantallas solo
leían. En total, staging tiene 62 exportaciones con `_rsc` de 72, desde
`EXP00000001`; producción tiene el mismo defecto desde julio.

- Arreglo: los botones pasan a `<a>`, como en los otros 6 reportes; «Limpiar»
  sigue en `<Link>` porque lleva a una página. `<Link prefetch={false}>` no
  basta: el clic también hace el GET con `_rsc`.
- Prueba: `reports/export-links.test.ts` renderiza las 9 pantallas de
  reportes con un doble de `next/link` que marca sus enlaces y exige que
  ningún enlace a `/api/` sea un `<Link>`; fallaba en las 3.
- Regla de ESLint: `no-restricted-syntax` prohíbe `<Link>` con
  `buildReportExportHref`, con un literal o con una plantilla que empieza por
  `/api/`. Vive en el mismo bloque que la regla de la entrega 3, porque un
  segundo bloque la reemplazaría. Se comprobó por entrada estándar: 5 de 5
  casos y los 2 botones de la página anterior.
- Snapshots: 9 de HTML, 18 líneas, solo el orden de los atributos de los
  enlaces de exportación (comprobado por programa ordenando los atributos).
  El diferencial lo clasifica como «L» en las 3 pantallas.
- 2 mutaciones detectadas: volver a `<Link>` y `<Link prefetch={false}>`.
- Los fantasmas se identifican por `"_rsc"` en `exportacion_datos.parametros`
  (una exportación real nunca lo lleva) y su entrada de bitácora, por
  `entidad_afectada = 'exportacion_datos'` e `id_registro_afectado`; ninguna
  tabla referencia a `exportacion_datos`. El responsable decidió conservar
  los de staging como evidencia; el conteo de producción queda para después
  de integrar el grupo en `main`.

Límites:

- Las 14 páginas de listados que no son reportes (pedidos, pagos, compras,
  asistencias...) siguen con `parseDateParam` y `lte`: tienen el mismo hueco
  del último milisegundo y, en local, el mismo día de más en columnas `date`,
  pero no exportan. Queda como pendiente.
- Los días siguen siendo de UTC en producción: el pendiente de instantes de
  la entrega 3.

### Publicación, CI y verificación en staging

- Foto del «antes» tomada el 2026-10-12 **antes del push**, con staging en
  `bc5afb1` (`buildId` `f-U_VYYmvZk2SYwTWH1px`), con ADMIN desde el navegador
  integrado. 20 observaciones secuenciales: 16 pantallas de personal,
  rentabilidad, auditoría y mantenimiento (sin filtros, rangos cerrados en el
  pasado, un día, y por reporte una referencia con la fecha bien escrita y
  una señal con la fecha mal escrita) y 4 rechazos de la ruta por `fetch`
  (rangos invertidos, que la ruta rechaza antes de escribir). Método de la
  entrega 7: navegación completa, lectura del DOM cuando el texto deja de
  cambiar y SHA-256 del texto de la página con sus tablas y, aparte, de sus
  enlaces de exportación, guardados en `sessionStorage`. Auditoría usa rangos
  cerrados hasta el 11/10 para que una exportación de ese día no la mueva.
- El «antes» es fiel y coherente: Python recalculó el sello del navegador
  (`b69604…`) y los hashes de los rechazos, y las fechas mal escritas se
  ignoraban (las señales de personal y rentabilidad tenían el hash de la
  pantalla sin filtros). Antes del push, `verify_antes.py` aplicó las reglas
  del grupo y calculó el sello esperado del «después» (`9d3515b2…`): cambian
  las 3 señales y nada más. Los dos rechazos con nombres de fecha ajenos al
  reporte (producción con `from` y `to`, personal con `dateFrom` y `dateTo`)
  no se repiten, porque con el código nuevo exportarían.
- La foto descubrió el defecto del prefetch (ver el hallazgo corregido en
  `4b5fbd3`): 45 exportaciones fantasma, `EXP00000027` a `EXP00000071`. Las
  observaciones no se invalidan: auditoría usa rangos cerrados hasta el 11/10
  y las exportaciones no tocan planillas ni costeos.
- D1 se reprodujo con una exportación autorizada (`EXP00000072`):
  `searchText=HRS8745`, el código interno de la Prensa Hidráulica, que no
  aparece en su nombre ni en las descripciones. La pantalla muestra
  `FAL00000001` y `FAL00000002`; el Excel, leído dentro del navegador
  (`fetch` y `DecompressionStream`, sin descargar), tenía 0 filas.
- Push de 13 commits (de `6414798` a `5879d91`): CI #60 en verde (2m 38s).
  Vercel desplegó solo (estado de `5879d91` pendiente 00:05:57 y completado
  00:07:42 UTC). Antes de abrir las pantallas se comprobó, con el HTML
  obtenido por `fetch` (que no ejecuta JavaScript ni hace prefetch), que la
  URL de rama servía el build nuevo: cambió el `buildId`
  (`Vw5EaevsPDIYvVqvIJ3w6`), los enlaces de exportación tenían el orden de
  atributos de un `<a>` y `staff?from=2026-7-5` ya no contenía `PLA00000001`.
- «Después» con el mismo procedimiento: **18 de 18 hashes iguales a los
  esperados y el mismo sello**; las 3 señales cambiaron a la pantalla de su
  fecha bien escrita y nada más. El historial siguió en `EXP00000072` tras
  recorrer las tres pantallas: abrirlas ya no registra exportaciones.
- D1 después, con una segunda exportación autorizada (`EXP00000073`): el
  Excel trae 2 filas, `FAL00000002` y `FAL00000001`, con los mismos
  encabezados. El archivo es igual a la pantalla.

| # | Caso | Antes (`bc5afb1`) | Después (`5879d91`) |
|---|---|---|---|
| S1 | `staff?from=2026-7-5` | Como sin filtros: la planilla `PLA00000001` | Como `from=2026-07-05`: sin planillas |
| S2 | `profitability?from=2026-10-8` | Como sin filtros: 5 costeos | Como `from=2026-10-08`: 3 costeos |
| S3 | `audit?from=2026-10-9&to=2026-10-11` | Desde el inicio hasta el 11/10 | Como `from=2026-10-09&to=2026-10-11` |
| D1 | Exportar mantenimiento con `searchText=HRS8745` | `EXP00000072`: 0 filas | `EXP00000073`: 2 filas, las de la pantalla |
| — | Recorrer personal, rentabilidad y auditoría | 45 exportaciones fantasma | Ninguna |
| P1–P13, R1 y R2 | Pantallas con fechas válidas o sin fechas y rechazos con los nombres propios | — | Idénticas |

No se probaron otros roles: el grupo no cambia permisos, rutas ni acciones.
Datos que deja la verificación en staging: `EXP00000072` y `EXP00000073`
(autorizadas) y las 45 exportaciones fantasma de `EXP00000027` a `EXP00000071`,
que el responsable decidió conservar como evidencia junto con las 17 anteriores
(62 de 73, cada una con su entrada de bitácora). Se reconocen por `"_rsc"` en
`parametros`: `tmp/g4-diff/limpieza-fantasmas-staging.sql` las borraría con una
guarda de conteo, y `conteo-fantasmas-produccion.sql` cuenta, solo leyendo, las
de producción después de integrar el grupo en `main`. La evidencia está en
`tmp/g4-diff/staging-antes.json`, `despues-esperado.json`,
`staging-despues.json` y `staging-exportaciones.json` (ignorados); el «después»
se copió por programa de `despues-esperado.json`, porque el navegador confirmó
su sello.

### Integración en `main` y conteo de producción

- El primer despliegue de producción del merge commit `19a0bf4` falló en
  Vercel (estado «Vercel» `failure` a las 00:37:35 UTC): `next/font/google` no
  pudo descargar Oswald durante el build. El árbol de `19a0bf4` es idéntico al
  de `3d10c09` (`147a21ef`), que staging desplegó bien, y el CI #63 compiló en
  verde: la causa fue la descarga de la fuente, no el código. El responsable lo
  redesplegó dos veces y los dos despliegues terminaron en `success` (04:12:52
  y 04:13:55 UTC). La solución de fondo, alojar las fuentes con
  `next/font/local`, va en la entrega 8.
- Conteo de exportaciones fantasma en producción, ejecutado por el responsable
  el 2026-10-12 después del redespliegue con
  `tmp/g4-diff/conteo-fantasmas-produccion.sql` (solo lectura): 33 fantasmas y
  6 exportaciones reales de 39. El primer fantasma es del 2026-07-13 23:54:36
  UTC y el último del 2026-08-01 18:36:51 UTC: ninguno desde entonces. Por
  reporte: auditoría 15 en Excel y 9 en PDF, personal y planillas 5 en Excel y
  4 en PDF, y rentabilidad 0. La bitácora tiene 33 entradas asociadas, una por
  fantasma.
- El responsable decidió conservarlos y documentarlos, como los 62 de staging:
  la bitácora de producción es de solo agregar y los fantasmas se identifican
  con precisión por `"_rsc"` en `parametros`. Si la pista B necesita mostrar
  limpio el historial de exportaciones, se marcarán o se filtrarán con su
  propio plan y prueba, nunca con un borrado manual.

## Entrega 8 — Base visual y galería

Fecha: 2026-10-13 y 2026-10-14. Estado: cerrada el 2026-10-14. 15 commits,
de `0ad4150` a `7150d10`, más el cierre `bbc3259` (CI #67 en verde),
publicados en tres tandas y verificadas las tres en staging: CI #64, #65 y #66
en verde, y 10 de 10, 24 de 24 y 26 de 26 huellas visuales como se predijo
(en la tercera, 2 con redondeos de 0,01 px que la predicción no anticipó).
Integrada en `main` con el PR #21 (CI #68 en verde; merge commit `a945a5a`,
CI #69 en verde, 2m 7s). Es la primera entrega de la pista B:
construye la base visual y la prueba en una galería interna sin cambiar
ninguna pantalla; las pantallas la adoptan en las entregas 9 y 10.

Decisiones del responsable:

- Ninguna pantalla existente cambia en esta entrega: la base se construye y
  se prueba en la galería.
- La galería es solo para ADMIN y no aparece en el menú.
- El rango de fechas invertido de los reportes (hallazgo del grupo 4) se
  corrige en la entrega 10; esta solo crea `DateRangeFields`.
- Fuentes solo del subconjunto latino, alojadas con su licencia OFL.

| Commit | Tipo | Cambio |
|---|---|---|
| 0ad4150 | docs | Integración del grupo 4 en `main` y conteo de exportaciones fantasma de producción. |
| d3cc557 | fix | Fuentes con `next/font/local`: los mismos archivos que servía Google (el build de producción del grupo 4 falló al descargar Oswald). |
| 9268a6f | test | Caracterización del HTML completo, con clases, de 64 casos de las primitivas y 4 superficies. |
| 7546379 | feat | Galería `/dashboard/gallery`, solo ADMIN y fuera del menú. |
| fee8ee1 | refactor | `globals.css` se separa en 7 hojas de `src/styles`; el CSS compilado es idéntico byte a byte. |
| b30aa08 | refactor | Se retiran 24 de las 49 reglas `industrial-dark` y 2 selectores de una regla viva: ningún elemento podía recibirlas. |
| 667eb70 | refactor | Tokens semánticos definidos una sola vez: sin el `.dark` duplicado, con estados, sombras, capas y movimiento. |
| 9102e3b | refactor | Los 25 colores literales de 11 componentes pasan a tokens; una regla de ESLint los prohíbe en los `.tsx`. |
| b588465 | feat | `Button` con estado pendiente, tipos que exigen `aria-label` en los tamaños de icono, `Spinner` y `SubmitButton`. |
| 259c618 | feat | `Field`, `FieldError` compartido y estilos de solo lectura. |
| 3fb247d | feat | `Skeleton`, `LoadingState`, `AlertDialog` y `ConfirmDialog`. |
| 0aae1d5 | feat | `Dialog` y `Sheet` con cuerpo desplazable y pie fijo. |
| aada765 | feat | `FilterBar`, `DateRangeFields` y filas de carga para tablas. |
| 7dd295f | fix | La nota de «Listados» de la galería pasa de 46 barras y 28 rejillas a 43 formularios GET y 27 combinaciones de clases. |
| 7150d10 | docs | Registro de la entrega: esta sección, `CLAUDE.md` e inventario. |

Diseño:

- Fuentes. Geist, Oswald y JetBrains Mono viven en `src/app/fonts` con los
  mismos `.woff2` del subconjunto latino que servía Google, copiados del build
  local sin volver a descargarlos, con su licencia OFL y un README de
  procedencia. `next/font/local` toma el nombre de la familia de la constante
  que la declara; `declarations: font-family` cambiaría la regla `@font-face`
  pero no la variable CSS. Oswald es variable: conserva una cara por peso
  sobre el mismo archivo para que el 650 siga resolviendo en 700. Una prueba
  fija el hash de cada archivo y su licencia, y una regla de ESLint prohíbe
  volver a `next/font/google`.
- Hoja global. `globals.css` solo importa, en orden: `tokens`, `base`,
  `brand`, los adaptadores de Toastify y SweetAlert2, `patterns` y el
  adaptador temporal `legacy-industrial-dark`. El orden de las importaciones
  es el de las reglas y decide su prioridad: `global-stylesheet.test.ts` lo
  fija e impide hojas sin importar.
- Tokens. `tokens.css` define cada token una vez en `:root` (la aplicación es
  solo oscura; la clase `.dark` solo activa las variantes `dark:` de shadcn) y
  `@theme inline` expone a Tailwind los que se usan como utilidades. Los
  estados (`--success`, `--warning`, `--info`) dan significado a la paleta de
  marca. `tokens.test.ts` exige definición única, que cada `var()` apunte a un
  token y que fuera de `tokens.css` no haya colores literales.
- Galería. Una muestra rotulada por estado de cada componente compartido, con
  datos ficticios. `gallery-page.test.ts` fija su contrato: solo ADMIN, sin
  Prisma, sin acciones del servidor (ningún formulario con `action` de
  función), sin enlaces a `/api/` y fuera del menú. La ruta tiene su propia
  entrada en `dashboardRoutes`: sin ella heredaría los permisos de
  `/dashboard`.
- Botones (C8). `pending` deshabilita, marca `aria-busy` y muestra un
  `Spinner` decorativo. Los atributos pendientes van después de las props: sin
  `pending` el HTML no cambia y con él ganan a un `disabled={false}` del
  formulario. Los tipos son uniones discriminadas: un tamaño de icono sin
  `aria-label` o un enlace (`asChild`) con `pending` no compilan.
  `SubmitButton` toma el estado de `useFormStatus`; su `DistributiveOmit`
  evita que un `Omit` simple pierda el `aria-label` obligatorio.
- Campos (C9). `Field` entrega el control a una función hija con `id`,
  `required`, `disabled`, `readOnly`, `aria-invalid` (solo con error) y
  `aria-describedby` (solo la ayuda y el error que existen); con `Slot` o
  `cloneElement`, un `aria-describedby` propio del hijo borraría en silencio
  la asociación. El obligatorio es un asterisco `aria-hidden` más `required`
  en el control. `FieldError` reproduce el HTML de las 14 copias locales y,
  con `size="sm"`, el de las 2 de los catálogos. Solo lectura usa el
  atributo (`[&[readonly]]`): en Chromium 152, `:read-only` (la variante
  `read-only:` de Tailwind) coincide con todo `<select>` y con los `input`
  deshabilitados, de archivo y casillas. Un `<select>` no admite solo lectura:
  se muestra la opción en un campo de solo lectura y el valor viaja en un
  `input` oculto, como ya hacía `user-form`.
- Carga y confirmación (C10). `Skeleton` repite las clases de
  `production/loading.tsx` y es decorativo; `LoadingState` se anuncia con
  `role="status"`. `ConfirmDialog`, sobre el `AlertDialog` de Radix, exige en
  los tipos la entidad, la consecuencia y el verbo; si `onConfirm` devuelve
  una promesa, espera con el botón pendiente y no deja cancelar. `showConfirm`
  y `ConfirmDeleteButton` siguen con SweetAlert2 hasta la entrega 11. El token
  `--overlay` es el velo que pone hoy SweetAlert2. Las animaciones de
  `tw-animate-css` no miran `prefers-reduced-motion` y sus variantes
  `data-open:` van después de `motion-reduce:` en el CSS, así que
  `motion-reduce:animate-none!` lleva `!important`.
- Ventanas (C11). `Dialog` y `Sheet` (el mismo Dialog de Radix anclado a un
  lado, que reutiliza sus piezas) tienen encabezado y pie fijos y solo
  desplazan el cuerpo; en el teléfono ocupan la pantalla. La X de cerrar va
  al final del DOM para que el foco inicial caiga en el primer campo. Un
  formulario envuelve cuerpo y pie (`flex min-h-0 flex-1 flex-col`) para que
  `SubmitButton` funcione.
- Listados (C12). `FilterBar` es un formulario GET con `role="search"` y una
  rejilla `auto-fit` de columnas de 12rem; como contenedor de consultas
  (`@container`), el rango ocupa dos columnas solo si la barra tiene sitio,
  aunque esté dentro de un panel. `DateRangeFields` conserva los nombres de la
  URL de cada pantalla (`from`/`to`, `dateFrom`/`dateTo`, `desde`/`hasta`) y,
  con «desde» posterior a «hasta», muestra el mensaje de la ruta de
  exportación (`src/lib/date-range.ts`, que también usa `validateDateRange`)
  y bloquea el envío con `setCustomValidity`. «Hasta» lleva `min`; «Desde» no
  lleva `max`, porque el navegador lo marcaría inválido con su mensaje
  genérico. `TableLoadingRows` anuncia la carga con un `LoadingState` oculto
  dentro de la primera celda: un `role="status"` en una fila rompería la
  tabla.
- Pruebas sin navegador. Radix no renderiza portales en el servidor: un doble
  de `radix-ui` vuelve el `Portal` un paso directo y abre la ventana, y así se
  prueban en Node el `role`, las asociaciones, el orden de los botones y el
  estado pendiente. El foco, Esc, la devolución del foco y la validación al
  escribir se prueban a mano en la galería; si conviene Playwright se decide
  en la entrega 9.

Evidencia:

1. Caracterización con clases (C2). El arnés de páginas quita `class`,
   `style` y `data-slot`, así que ninguna prueba protegía el aspecto.
   `primitives.test.ts` y `app-surfaces.test.ts` fijan el HTML completo, una
   etiqueta por línea: 64 casos de las primitivas (89 al final de C12) y 4
   superficies. Cada cambio de un snapshot fue a propósito: C7 en 33 líneas,
   todas con solo el reemplazo previsto; C9 en 11 entradas que solo insertan
   los tokens de clase nuevos (`verify_snap_c9.py` falla con cualquier otro
   cambio), y C8, C10, C11 y C12 solo agregan entradas. Los snapshots de las
   páginas no cambian en ningún commit.
2. CSS compilado, commit a commit (`tmp/e8-diff`, ignorado): C1, idéntico
   salvo las reglas de fuentes (`css_diff.py --sin-fuentes`); C3 solo gana las
   8 utilidades de la galería; C4, idéntico byte a byte; C5 pierde
   exactamente los 94 selectores; en C6 cada declaración conserva su valor al
   resolver `var()` con los tokens (`css_resolve_diff.py`); de C8 a C12 solo
   se agregan 4, 2, 37, 38 y 4 entradas (`css_added.py`, que exige que el CSS
   anterior sea una subsecuencia del nuevo a nivel de declaración, porque
   Tailwind v4 agrupa las utilidades en un `@layer`; se comprobó que falla
   entre C6 y C7).
3. Mutaciones: C8, 11 de 11; C9, 15 de 15; C10, 10 de 10; C11, 9 de 9 (la X
   sin nombre la rechaza `tsc` por los tipos de C8); C12, 10 de 10. Dos
   sobreviven a propósito porque necesitan eventos del navegador y se prueban
   a mano: Esc durante el pendiente de `ConfirmDialog` y la validación al
   escribir de `DateRangeFields`. Una de C12 mostró un hueco que ya no existe:
   cambiar el texto del rango invertido de la ruta de exportación solo lo
   detecta la prueba nueva de `date-range`. De C1 a C6 se mutaron copias de
   3, 2, 3, 1, 1 y 3 archivos (`tmp/e8-diff/mut-c1` a `mut-c6`); su conteo
   no quedó registrado.
4. Huella visual en staging, antes y después de cada tanda (abajo).

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.650, 1.658, 1.726, 1.735, 1.738, 1.741, 1.745, 1.745, 1.764,
1.788, 1.808, 1.820 y 1.847 pruebas; de 101 a 116 archivos de prueba. De
`3d10c09` a `aada765`, el código de producción de `src` cambia en 43 archivos
(+2.539 y −49), las hojas en 8 (+751 y −856), `eslint.config.mjs` (+81 y
−30), las pruebas en 16 (+1.782 y −1) y los snapshots en 6 (+3.468 y −4), y
se agregan 7 archivos de fuentes y licencias. `npm run refactor:inventory`
analiza 583 archivos y cuenta 128 páginas (la galería), 138 formularios
(`FilterBar` y la ventana de ejemplo) y 48 archivos de acciones.

### Huella visual

- `tmp/e8-diff/huella.js` (ignorado) se pega entero en cada página desde el
  navegador integrado: la CSP impide `eval` y `X-Frame-Options: DENY`, los
  iframes. Por cada elemento mide su geometría, ~55 propiedades calculadas
  (`getComputedStyle`) y su texto propio, guarda la captura comprimida en
  IndexedDB y devuelve su SHA-256; en el «después» enumera los elementos y
  propiedades distintos.
- Normaliza el nombre de la familia de fuente (cambia con `next/font/local`),
  excluye `<vercel-*>` (la barra de comentarios de Vercel cambia de alto
  recién iniciada su sesión), marca como variable la geometría de los
  elementos animados y no mide si el puntero está sobre la página, porque un
  `:hover` cambiaría la captura. La galería se mide por sección, con la
  geometría relativa a la sección.
- Cada página se mide a 1281 px (1280 × 800, `dpr` 1,19) y a 376 px (el
  preset móvil, `dpr` 2), con ADMIN salvo el login.
- La evidencia son los hashes de `tmp/e8-diff/staging-*-t*.json`, con su
  sello recalculado en Python: si se cierra el panel del navegador se pierden
  la sesión de Vercel y la IndexedDB.
- La v3, de la tanda 3 (`tmp/e8-diff/huella.js`; la v2 queda en
  `huella-v2.js`), registra los elementos sin caja (una `<option>` de un
  select cerrado, un `input` oculto) como «sin caja», no con coordenadas que
  solo siguen a su sección; se niega a medir fuera del origen de staging, y
  descubre las secciones de la galería del DOM. Las diferencias de una
  captura se clasifican por elemento: «subpíxel» es solo geometría con
  diferencia de hasta 0,02 px.

### Publicación, CI y verificación en staging

Tanda 1 (C0 a C3):

- «Antes» el 2026-10-13, de 20:38 a 20:43 UTC, sobre `3d10c09` (`buildId`
  `YBnn0mxDYWrXZJus4_F-a`): 10 huellas (inicio, clientes, cliente nuevo,
  materiales, `OTR00000006`, resumen de caja y reporte de mantenimiento a
  1281; inicio, clientes y `OTR00000006` a 376) con el sello `0a3202a2…`, y
  tres controles: dos páginas medidas otra vez dan el mismo hash y una
  mutación de la fuente lo cambia.
- Push de 4 commits (`0ad4150` a `7546379`): CI #64 en verde (2m 17s).
  Vercel desplegó solo (23:42:38 UTC) y cambió el `buildId`
  (`xcp2HtyY9nkvR-8OFtM89`).
- «Después»: 10 de 10 huellas iguales y el mismo sello. La primera de
  `/dashboard` difirió solo en `<vercel-live-feedback>`, que medía 15,13 px de
  alto recién iniciada la sesión de Vercel; la repetición dio el hash del
  «antes», y la v2 de la huella excluye esa barra. Las tres fuentes se sirven
  con el mismo SHA-256, con otro nombre de archivo. La galería responde 200,
  no aparece en el menú, no enlaza a `/api/` y no desborda en el teléfono; la
  consola solo muestra errores *report-only* de la CSP por `vercel.live`,
  ninguno de la aplicación.

Tanda 2 (C4 a C7):

- «Antes» con la huella v2 sobre `7546379`: 22 capturas con sesión (las 10
  pantallas y las 6 secciones de la galería a las dos anchuras) con el sello
  `dd3444ec…`, y 2 del login sin sesión. Dos capturas del login se
  descartaron porque se tomaron en producción: con sesión del ERP activa,
  `/login` de staging redirige a `/dashboard` con el host de `AUTH_URL` y de
  ahí al login de producción (solo lectura).
- Predicción escrita antes del push: las 10 pantallas idénticas; en la
  galería cambia solo «Fundamentos» (C6); en el login cambia un solo
  elemento, el velo `bg-background/45`, de un `lab()` que precalculaba el
  minificador a un `oklab()` que calcula el navegador, con el mismo color.
- Push de 4 commits (`fee8ee1` a `9102e3b`): CI #65 en verde (2m 32s).
  Vercel desplegó solo (03:08:11 UTC del 2026-10-14) y cambió el `buildId`
  (`6CyuJKcZl8zsdZxaMKzQT`).
- «Después»: 24 de 24 como se predijo. Las 10 pantallas, idénticas. En la
  galería, «Fundamentos» crece de 1.003 a 1.443 px de alto y de 149 a 210
  elementos; las otras 5 secciones no tienen diferencias de propiedades, solo
  elementos sin caja que siguen a su sección y redondeos de hasta 0,01 px. En
  el login, 1 elemento de 57 y 1 propiedad, exactamente la predicha;
  pintados en un canvas dan los mismos píxeles (`[9, 11, 13, 115]` al 45 %).

Tanda 3 (C8 a C13):

- «Antes» el 2026-10-14 sobre `9102e3b` (`buildId` `6CyuJKcZl8zsdZxaMKzQT`)
  con la huella v3 («sin caja», que se niega a medir fuera del origen de
  staging y descubre las secciones de la galería del DOM): 22 capturas con
  ADMIN (las 10 pantallas y las 6 secciones de la galería a las dos anchuras)
  y 2 del login sin sesión, con el sello `97679a36…`, más tres controles (dos
  repeticiones con el mismo hash y una mutación de `letter-spacing` que lo
  cambia). Con el panel oculto, Chrome frena los temporizadores (las esperas
  de 100 ms duraban ~670 ms) y cada captura tardó unos 6 s.
- Predicción escrita a las 14:32 UTC, antes del push
  (`staging-antes-t3.json`): idénticas las 10 pantallas, el login y las
  secciones «Fundamentos» y «Presentación»; cambian «Botones», «Campos»,
  «Mensajes» y «Listados»; «Ventanas» es nueva.
- Push de 7 commits (`b588465` a `7150d10`). Los primeros intentos fallaron
  con `Failed to connect to github.com port 443`: el DNS resolvía, GitHub no
  declaraba incidentes y Google respondía siempre, pero entre las 14:46 y las
  14:51 UTC la mayoría de las conexiones TCP a sus IP (`140.82.112-114.x`)
  no se establecían. Fue la ruta entre el proveedor de internet y GitHub, no
  el repositorio: un vigía con `curl` esperó 5 conexiones seguidas y el push
  pasó después. El remoto siguió en `9102e3b` hasta entonces.
- CI #66 en verde (2m 26s). Vercel desplegó solo (15:13:02 UTC) y cambió el
  `buildId` (`uxKz4bI4ct3DnwZx8Pua6`), comprobado también dentro de cada
  página medida.
- «Después»: 26 capturas, sello `3e3a1974…` (recalculado en Python). 14
  idénticas como se predijo; 8 cambian como se predijo, y en «Botones» y
  «Campos» todos los elementos anteriores a las muestras nuevas son
  idénticos, también los `Input`, `Textarea` y `NativeSelect` que ganaron
  clases en C9; «Ventanas», nueva a las dos anchuras. «Presentación» no salió
  idéntica, como predije, sino con 2 elementos a 0,01 px y ninguna propiedad
  distinta: las secciones de arriba crecieron, la sección bajó y la posición
  relativa redondeada a centésimas cayó al otro lado, el mismo fenómeno de la
  tanda 2. A 376 px, la descripción nueva de «Mensajes» y «Listados» ocupa
  una línea más (+20 px) y desplaza la sección. Nada quedó sin explicar.
- No se probaron SELLER ni WORKSHOP_MASTER, por decisión del responsable: la
  entrega no cambia permisos ni pantallas de esos roles, y
  `gallery-page.test.ts` exige que los dos sean rechazados en la galería.

Recorrido de teclado y móvil en la galería de staging, con teclas reales (un
`KeyboardEvent` creado con JavaScript no cierra las ventanas de Radix: no
sirve como prueba de teclado) y `document.activeElement` leído en cada paso:

| # | Qué | Resultado |
|---|---|---|
| K1 | Botón pendiente | `aria-busy`, deshabilitado y spinner girando. El foco sigue en el botón al pulsar, pasa a `body` en ~1 s (corrección de foco de Chromium 152) y no vuelve al terminar |
| K2 | `ConfirmDialog` | Foco inicial en Cancelar; Tab no sale de la ventana; Esc cierra y devuelve el foco al disparador; durante el pendiente, Esc no cierra (la mutación que sobrevivió en C10) |
| K3 | Ventana con formulario | Foco en el primer campo (`required`, con su ayuda en `aria-describedby`); Mayús+Tab desde él va a la X; Enter envía sin navegar, queda pendiente y Esc no cierra |
| K4 | Ventana larga | Mide `100dvh − 4rem` × `max-w-lg` y el pie sigue visible, pero el cuerpo no recibe el foco y no se desplaza con el teclado (hallazgo, abajo) |
| K5 | Paneles | Anclados a su lado (448 px), foco inicial, Esc y devolución del foco; el izquierdo no tiene `aria-describedby`, a propósito |
| K6 | `DateRangeFields` | La URL invertida se marca desde el principio; un «Hasta» anterior muestra el mensaje y marca solo «Hasta»; Enter en «Filtrar» no navega y lleva el foco al campo inválido (la mutación que sobrevivió en C12); corregido, el formulario es válido |
| K7 | Solo lectura | `[readonly]` coincide con el `readOnly=""` de React; fondo `--muted`, texto a contraste completo, enfocable; el deshabilitado no lo es |
| M1 | 376 px | Sin desbordamiento horizontal; la ventana ocupa la pantalla (376 × 813, sin redondeo) con los botones del pie apilados; `FilterBar` y el rango a una columna |

`prefers-reduced-motion` no se puede emular en el navegador integrado: queda
verificado en el CSS compilado (C8, C10 y C11). En el panel izquierdo, el foco
inicial va a la X y no al primer enlace: Radix evita a propósito dar el foco
inicial a un enlace.

Hallazgo de la verificación, no corregido en esta entrega (decisión del
responsable): en una ventana cuyo cuerpo desplazable no tiene nada enfocable
(la ventana larga de la galería), el cuerpo no se alcanza con Tab y ni las
flechas ni AvPág lo mueven, porque la trampa de foco de Radix calcula sus
propios elementos tabulables y deja fuera la zona desplazable que Chrome sí
haría enfocable. Con teclado no se leen las líneas que no caben (WCAG 2.1.1).
Ninguna pantalla usa `Dialog`; se corrige con el primer commit de la entrega
9, cuyo piloto usa ventanas.

Decisiones del responsable en la tanda 3: la etiqueta de estado de la entrega
10 es `Badge`; las confirmaciones destructivas usan el botón destructivo suave
de las pantallas, no el sólido de SweetAlert2; aprueba el aspecto de los
componentes nuevos y de la galería, y propondrá más adelante otros estilos.

Evidencia en `tmp/e8-diff/staging-antes-t3.json`, `staging-despues-t3.json`
y `t3-registro.tsv` (ignorados), con los sellos recalculados en Python.

Lo que queda:

| Pendiente | Dónde |
|---|---|
| El cuerpo de una ventana sin nada enfocable no se alcanza con el teclado (hallazgo de la tanda 3) | Primer commit de la entrega 9 |
| 16 copias locales de `FieldError` (14 iguales a la compartida y 2 a su tamaño `sm`) | Entregas 9 y 10 |
| 113 páginas con un `<main>` dentro del `<main>` del shell, y `production/loading.tsx` | Entregas 9 y 10 |
| `user-form` nombra con `Label htmlFor="rol"` un control que no existe cuando el usuario se edita a sí mismo; 10 páginas de producción ponen `*` en el texto del `Label` y no tienen `htmlFor` | Entregas 9 y 10, con `Field` |
| 43 formularios GET (41 barras de filtros y 2 de parámetros) con 27 combinaciones de clases; con el rango invertido, las pantallas de reportes muestran la tabla vacía sin aviso y su exportación responde 400 con un JSON (grupo 4) | Entrega 10, con `FilterBar` y `DateRangeFields` |
| Adoptar `Badge` para las etiquetas de estado (`StatusBadge` se usa en 14 archivos) | Entrega 10 |
| Un botón con foco que pasa a deshabilitado pierde el foco a `body` en ~1 s y no lo recupera (también hoy, con `disabled={isPending}`); decidir `aria-disabled` | Entrega 9 |
| Integrar `ConfirmDialog` con formularios y `useActionState`; decidir Playwright para foco y teclado | Entrega 9 |
| SweetAlert2 (`showConfirm`, `showLoading`, `ConfirmDeleteButton`), el adaptador `legacy-industrial-dark` y `dropdown-menu.tsx`, que no tiene consumidores | Entrega 11 |

### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-14 y comparados con git:

- PR #21, abierto a las 17:13:04 UTC y fusionado con merge commit a las
  17:16:33 UTC del 2026-10-14: 16 commits, de `0ad4150` a `bbc3259`. Su CI,
  el #68, sobre `bbc3259`, terminó en verde (3m 4s).
- El merge commit `a945a5a` tiene como padres `19a0bf4` (`main`) y `bbc3259`
  (`staging`), y su árbol es el de `bbc3259` (`2fdcc4ca`): `main` y `staging`
  tienen el mismo contenido. CI #69 en verde (2m 7s).
- Vercel desplegó `a945a5a` en producción al primer intento (estado «Vercel»
  `pending` a las 17:16:37 UTC y `success` a las 17:18:13 UTC). Es el primer
  despliegue de producción con las fuentes locales de `d3cc557`: el build ya
  no descarga fuentes de Google, la causa del fallo del merge del grupo 4, y
  esta vez no hizo falta redesplegar.

## Entrega 9 — Piloto Clientes y categoría en ventanas

Fecha: 2026-10-14 y 2026-10-15. Estado: cerrada el 2026-10-15. 14 commits, de
`543ff6e` a `498533d`, más el cierre `e81299e` (CI #73 en verde):

- El paso 0 (`543ff6e`).
- El paso 1, el fix K4 (`01ca73c` y `1812fff`), verificado en staging con el
  CI #70.
- El piloto (de `490034e` a `5261489`) y su registro (`ef477f2`), publicados
  con el CI #71.
- Un fix que encontró la verificación del piloto (`498533d`), publicado con el
  CI #72.

Los tres CI terminaron en verde. En staging, 15 de las 18 huellas salieron como
se predijo y las otras 3 tienen explicación; el CSS servido fue el predicho byte
a byte, y las tareas T1 a T5 se midieron antes y después. Integrada en `main`
con el PR #22 (CI #74 en verde; merge commit `e38d633`, CI #75 en verde,
2m 58s).

Es la segunda entrega de la pista B: las primeras pantallas adoptan la base
visual de la entrega 8 y prueban dos variantes del alta y la edición, un panel
lateral con URL para una entidad relevante (Clientes) y una ventana modal sin
URL para un catálogo breve (categorías de producto). Esa comparación calibra la
entrega 10.

Decisiones del responsable:

- El paso 0 registra la integración de la entrega 8 en `main`. El paso 1
  corrige K4 antes del piloto, que usa ventanas, y se registra aquí con la
  entrega.
- Clientes se edita en un panel lateral con rutas interceptadas y paralelas; la
  recarga o la URL directa sirven la página completa.
- La categoría del piloto es la de producto, en una ventana modal sin URL:
  tiene la misma área y los mismos roles que Clientes, así que una sola matriz
  de 3 roles cubre el piloto.
- El botón pendiente usa `aria-disabled` y el formulario, una guarda de envío;
  `disabled` queda para «no permitido».
- `ConfirmDialog` gana un modo controlado para confirmar el descarte de
  cambios. Confirmar antes de enviar se hará en la entrega 10 con
  `startTransition` y el `pending` externo. Nunca dos ventanas apiladas, salvo
  la confirmación.
- Playwright se pospone a la entrega 11, cuando el CI tenga una base
  desechable: toda página exige sesión y la sesión exige base. La batería queda
  escrita abajo.
- El commit 8 se divide en 8a (caracterización) y 8b (la ventana modal), por la
  regla 6.
- Las pruebas con SELLER y WORKSHOP_MASTER en staging se omiten (2026-10-15).
  Las cubren las pruebas automáticas; el detalle está abajo.

| Commit | Tipo | Cambio |
|---|---|---|
| 543ff6e | docs | Integración de la entrega 8 en `main` (paso 0). |
| 01ca73c | test | Foco de las ventanas con el Radix real en jsdom (`jsdom` 29.1.1 como dependencia de desarrollo) y 4 guardas del foco inicial. |
| 1812fff | fix | K4: el cuerpo desplazable de una ventana sin nada enfocable entra en el orden de Tab. |
| 490034e | fix | `returnTo` se valida resolviendo la ruta y sin decodificarla dos veces. |
| e0d6d91 | feat | `Button` pendiente con `aria-disabled` y `ActionForm`, que cancela el segundo envío, remonta los campos y enfoca el primero inválido. |
| 6d08d2e | feat | `ConfirmDialog` controlada, que devuelve el foco sin disparador. |
| 012a71c | test | Caracterización del alta y la edición de clientes (19 casos). |
| 8a2dc82 | feat | Clientes guarda con `FormActionState`: conserva lo escrito al fallar, da un solo aviso y vuelve al listado con sus filtros. |
| 762bd5a | feat | El alta y la edición de clientes se abren en un panel lateral con rutas interceptadas (`RouteSheet`). |
| 61fa23e | feat | El listado de clientes usa `FilterBar` y `Field`, sin `<main>` anidado, y «Nuevo cliente» lleva `returnTo`. |
| 4914163 | test | Caracterización del alta y la edición de categorías de producto (19 casos). |
| 5261489 | feat | Categorías de producto: alta y edición en una ventana modal; sus dos acciones autorizan con `getAuthorizedSession`. |
| ef477f2 | docs | Registro de la entrega: esta sección, una trampa de Tailwind en `CLAUDE.md` e inventario. |
| 498533d | fix | La galería respondía 500 en staging: `Button` pendiente pone la guarda de clic solo si es de envío o tiene un `onClick` propio, así que un componente de servidor puede pintarlo. |
| e81299e | docs | Cierre con la verificación del piloto en staging. |

Diseño:

- Foco en jsdom (1a). Un archivo de prueba elige jsdom con su primera línea
  (`// @vitest-environment jsdom`) y usa el Radix real. jsdom no calcula la
  disposición: la prueba simula `scrollHeight` y `clientHeight` con atributos
  `data-test-*` y un doble de `ResizeObserver`. Cuatro guardas fijan el foco
  inicial que el arreglo no debe cambiar: con formulario, el primer campo; sin
  campos, el primer botón del pie; en un panel con campos, el primer campo, y
  con solo enlaces, la X (Radix no da el foco inicial a un enlace).
- K4 (1b). `DialogBody` (y `SheetBody`) entra en el orden de Tab
  (`tabindex="0"`) solo si desborda y no tiene nada tabulable dentro, la regla
  que Chrome aplica a las zonas desplazables. Lo recalcula con un
  `ResizeObserver` y un `MutationObserver` y lo escribe desde un efecto de
  layout, antes del foco inicial de Radix. Con un campo dentro, el foco inicial
  sigue yendo al primer campo. Con el teclado muestra un anillo hacia dentro.
  `DialogBody` ya no acepta `ref` ni `tabIndex`.
- `returnTo` (C1). `getSafeReturnTo` resuelve el valor con `new URL` contra un
  origen ficticio, exige ese mismo origen y una ruta bajo `/dashboard`, y
  devuelve la ruta normalizada con su consulta y su fragmento. `hasListFilters`
  dice si la lista tenía filtros, además de la paginación.
- Pendiente y envío (C2). Con `pending`, `Button` pone `aria-disabled` y
  `aria-busy`, cancela el clic y se atenúa (`pointer-events-none opacity-50`):
  el foco no se pierde (K1 de la entrega 8). Desde `498533d`, el clic solo se
  cancela si el botón envía (también sin `type`) o tiene un `onClick` propio. `ActionForm` es el `<form>` de una
  acción con `useActionState`: cancela un segundo envío mientras está pendiente
  (Enter en un campo lo encolaba). Con `resultKey` remonta los campos para que
  tomen como `defaultValue` los valores que devuelve la acción, y después
  enfoca el primer campo con `aria-invalid`.
- Confirmación controlada (C3). `ConfirmDialog` acepta `trigger`, o bien `open`
  con `onOpenChange`; los tipos impiden mezclarlos. En modo controlado guarda
  el elemento con foco al abrir y lo devuelve al cerrar. La demo de la galería
  pide descartar los cambios.
- Contrato de resultado (C5). `FormActionState` (`src/lib/action-result.ts`)
  es `idle`; `error`, con `fieldErrors` y los `values` enviados; o `success`,
  con los datos mínimos. Cada respuesta lleva un `operationId` nuevo, que el
  formulario usa como `resultKey` y para no repetir el aviso, sin ocultar dos
  operaciones iguales seguidas. Las acciones de Clientes ya no redirigen:
  hacen las mismas lecturas, la misma transacción, la misma bitácora y el mismo
  `revalidatePath`, y devuelven el resultado.
- Formulario de Clientes (C5). Usa `ActionForm`, `Field` (con ids iguales al
  `name`), `SubmitButton` y una rejilla por consultas de contenedor: dentro del
  panel, un punto de corte del viewport daría dos columnas apretadas. El error
  general queda dentro del formulario, sin toast; antes salían la alerta y un
  toast. Al guardar da un solo aviso, con «Puede no aparecer con los filtros
  activos del listado.» si la lista tenía filtros, y vuelve al `returnTo` que
  validó la página.
- Panel sobre la lista (C6). `clients/layout.tsx` pinta `{children}{panel}`.
  La ranura `@panel` tiene `default.tsx` y `page.tsx` en `null` y las rutas
  interceptadas `(.)new` y `(.)[id]/edit`, que autorizan con los mismos roles y
  hacen la misma consulta que las páginas completas. `RouteSheet` funciona así:
  - Cierra con `router.back()`: Atrás cierra el panel y Adelante lo reabre.
  - Si hubo algún `input`, pide confirmar el descarte; al recargar, avisa con
    `beforeunload`.
  - Tras guardar, cierra sin preguntar y llama a `router.refresh()` en el
    `popstate`, porque Next reutiliza las páginas al ir atrás.
  - Mientras guarda, no se cierra.
  - Devuelve el foco al enlace que lo abrió.
  - Sus controles son estables: si cambiaran con el estado, el efecto de éxito
    se repetiría (dos avisos y dos `back()`).
  - Mide 576 px de ancho (`sm:max-w-xl`).
- Listado (C7). `FilterBar` con `Field` y los mismos nombres en la URL (`q`,
  `type`, `status` y `origin`), sin `<main>` anidado. «Nuevo cliente» lleva el
  `returnTo` de la lista, así que el alta vuelve con los filtros.
- Ventana modal de categorías (C8b). La tabla es de solo lectura. «Nueva
  categoría» (en el encabezado, solo ADMIN) y «Editar» abren
  `ProductCategoryDialog` desde su propio disparador, al que Radix devuelve el
  foco. La ventana tiene el mismo contrato, el descarte, la guarda de ocupado y
  un solo aviso. SELLER ve «Solo lectura» en lugar de formularios
  deshabilitados. Las dos acciones autorizan con `getAuthorizedSession` y, ante
  otro rol, responden con un error en lugar de redirigir: la desviación conocida
  queda corregida para ellas.
- Registro de notificaciones (C5 y C8b). Reconoce como emisión el acceso
  `xxxNotifications["clave"]` y lee los nombres de los catálogos del propio
  `notification-registry.ts`. Desde C8b fija en un snapshot «archivo [atributo
  JSX] → clave» para cada acceso. Las claves nuevas `product-category-created`
  y `product-category-updated` llevan los textos que ya daba el gestor; el
  puente pasa de 123 a 125 claves.

Evidencia:

1. Caracterización antes de mover (C4 y C8a): 19 casos por feature. Cubren los
   roles, la validación, los duplicados, las carreras con P2002, los fallos y
   si la bitácora va dentro de la transacción. Los commits siguientes conservan
   las lecturas, las escrituras, el correlativo, la bitácora y las
   revalidaciones. Cambian solo el final (la redirección pasa a ser el
   resultado) y, en las categorías, el nombre de la autorización.
2. Prueba roja antes de cada arreglo: `tmp/e9-diff/rojo-1b.txt`, `rojo-c1.txt`
   (6 casos), `rojo-c2.txt`, `rojo-c3.txt`, `rojo-c5.txt` y
   `rojo-c7.txt`. En C8b, la prueba de la ventana falló sin el componente.
3. CSS compilado, commit a commit (`css_added.py` de la entrega 8): el 1b
   agrega `focus-visible:ring-inset`, C2 `opacity-50` y C6 `sm:max-w-xl`. Los
   demás commits lo dejan idéntico byte a byte, también C4 y C8a, que solo
   traen pruebas.
4. Mutaciones (`tmp/e9-diff/mut_*.txt`): 1a, 3 de 3; 1b, 12 de 13; C1, 7 de 7;
   C2, 9 de 9; C3, 5 de 6; C4, 10 de 10; C5, 11 de 11; C6, 14 de 14; C7, 7 de
   7; C8a, 8 de 8, y C8b, 11 de 11. En total, 97 de 99. Las dos que sobreviven
   son equivalentes:
   - 1b M7, contar como enfocable un `input` oculto: la hoja del navegador ya
     le da `display: none !important`.
   - C3 M4, dejar que Radix devuelva el foco: en modo controlado no hay
     disparador y el foco devuelto se queda.

   Las mutaciones M10 y M11 de C8b, que intercambian los avisos, solo las
   detecta el snapshot nuevo del registro. El fix de la verificación
   (`498533d`) detecta 5 de 5 (`mut_fix_galeria.txt`); entre ellas está M1,
   que es exactamente el código de C2. Su prueba roja está en
   `rojo-fix-galeria.txt`.

Comprobaciones: `npm run check` terminó con código 0 después de cada commit,
en Windows: 1.851, 1.860, 1.877, 1.883, 1.890, 1.913, 1.921, 1.941, 1.944,
1.963 y 1.972 pruebas, de 117 a 125 archivos de prueba, y 1.975 con el fix
`498533d`. El paso 1
(`543ff6e..1812fff`) cambia 9 archivos (+948 y −15). En el piloto
(`1812fff..5261489`) cambian el código de producción (24 archivos, +1.186 y
−618), las pruebas (15, +2.020 y −19), los snapshots (9, +2.705 y −105) y
`CLAUDE.md`. `npm run refactor:inventory` analiza 601 archivos y cuenta:

- 131 páginas, por las 3 de la ranura del panel.
- 135 formularios JSX: `ActionForm` reemplaza al de Clientes y a los dos de la
  tabla de categorías, y la barra GET del listado pasa a `FilterBar`.
- 48 archivos de acciones.

Tiempo de preparación, desde la petición de cada commit hasta tenerlo listo
para el commit (según las marcas de la sesión, sin contar las revisiones del
responsable):

| Commit | 1a | 1b | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8a | C8b |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Minutos | 8 | 32 | 9 | 12 | 11 | 12 | 22 | 14 | 11 | 4 | 10 |

El piloto suma unos 105 minutos. Para estimar la entrega 10: el catálogo breve
en ventana modal (C8a y C8b) costó 14 minutos, y Clientes con su panel (de C4 a
C7), 59, sin contar los cimientos de C1 a C3.

La verificación del piloto en staging llevó unos 57 minutos de trabajo, sin
contar las esperas del CI, de Vercel ni de los inicios de sesión:

| Tramo | Scripts | «Antes» | «Después» con el diagnóstico de la galería | Fix | Galería |
|---|---|---|---|---|---|
| Minutos | 4 | 18 | 24 | 6 | 5 |

### Paso 1: publicación y verificación en staging (K4)

- «Antes» el 2026-10-15, de 03:35 a 03:49 UTC, sobre `bbc3259` (`buildId`
  `14LcIxR7bhCtAO5Ba9eJc`) y con la huella v4. Se tomaron 10 capturas con
  ADMIN: las 7 secciones de la galería, clientes e inicio a 1281 px, y
  «Ventanas» a 376 px. El sello es `d48c8e55…`, recalculado en Python. Como
  controles, cuatro repeticiones dieron el mismo hash (una con un spinner
  girando) y una mutación de `letter-spacing` lo cambió.
- K4, reproducido con teclas reales. En la ventana larga, el foco inicial va al
  «Cerrar» del pie y el cuerpo no tiene `tabindex`. AvPág, las flechas y Fin no
  lo mueven: `scrollTop` sigue en 0, con 1.299 px de contenido y 584 visibles.
  Sobre la página, AvPág sí desplaza 700 px.
- La v4 de la huella (`tmp/e9-diff/huella.js`) marca como variable la
  geometría de lo que hay dentro de un elemento animado. Con la v3, «Botones»,
  «Mensajes» y «Listados» diferían del «después» de la entrega 8 solo en los
  `<path>` de spinners que giran. Las secciones sin animación dan el mismo hash
  con la v3, con la v4 y en el «después» de la entrega 8.
- El CSS del «antes» es igual byte a byte al compilado en Windows, salvo por un
  redondeo de Linux en el `lab()` de `--destructive-outline` (`60.745` frente a
  `60.7449`); corregido, da el SHA del local. Con eso se predijo el SHA exacto
  del CSS del «después».
- Push de 3 commits (`543ff6e` a `1812fff`): CI #70 en verde (2m 52s). Vercel
  desplegó `1812fff` (`pending` a las 04:04:36 y `success` a las 04:05:39 UTC)
  y cambió el `buildId` (`wyC-IlwpQ7SEoPI7yl80L`).
- «Después», de 04:08 a 04:14 UTC, con el sello `1a5b1159…`. El CSS servido es
  el predicho byte a byte (`1daf024b…`). Hay 8 de 10 capturas idénticas.
  «Ventanas» cambia como se predijo: a 376 px, la nota y su sección crecen
  58,49 px con el texto nuevo, y nada más; a 1281 px cambia solo el texto de la
  nota. Única desviación: la predicción decía que a 1281 px también crecerían la
  nota y la sección, pero el texto nuevo ocupa las mismas líneas.
- Teclado, con teclas reales y `document.activeElement` leído en cada paso.
  Todo salió como se predijo:
  - En la ventana larga, el foco inicial va al cuerpo (`tabindex="0"`).
  - AvPág lo baja a 510 px, tres flechas a 629 y Fin a 715, que es el final
    (1.299 − 584).
  - Tras usar el teclado se ve el anillo de 3 px hacia dentro; tras un clic,
    no. Abierta con Enter, el anillo se ve desde el principio.
  - Mayús+Tab va a la X, Tab vuelve al cuerpo y después al «Cerrar» del pie.
  - Esc cierra y devuelve el foco al disparador.
  - Donde hay campos nada cambia: la ventana con formulario enfoca su primer
    campo, y su cuerpo, que no desborda, no entra en el orden; los paneles se
    comportan como en la entrega 8.
  - A 376 px, la ventana ocupa la pantalla (376 × 813), el cuerpo recibe el
    foco y no hay desplazamiento horizontal.
- No se probaron SELLER ni WORKSHOP_MASTER: el arreglo no cambia permisos y la
  galería es solo para ADMIN.

Evidencia en `tmp/e9-diff/staging-antes-e9.json`, `staging-despues-e9.json` y
`e9-registro.tsv` (ignorados), con los sellos recalculados en Python.

### Publicación, CI y verificación del piloto en staging

Método:

- Huella: la v4 con su propia base (`e9p-huella`) y etiquetas `p9/`
  (`tmp/e9-diff/huella-piloto.js`).
- Medidor de tareas (`tmp/e9-diff/medidor.js`). Con el reloj del navegador,
  anota en `sessionStorage` los clics, las navegaciones suaves y las cargas de
  documento, los avisos, el momento en que el campo está listo, el
  desplazamiento y el foco.
- Clics y teclas reales; el `<select>`, con `form_input`.
- A 376 px no hay barra de desplazamiento donde dejar el puntero. Queda en el
  margen derecho del shell (`div.industrial-dark` > `div.px-4.py-6`, sin
  `:hover`); la captura de inicio a 376 px da el mismo hash que en la entrega 8.

Publicación y medición:

- «Antes» el 2026-10-15, de 16:53 a 17:08 UTC, sobre `1812fff` (`buildId`
  `wyC-IlwpQ7SEoPI7yl80L`): 18 capturas con ADMIN, con el sello `4b47c8cc…`,
  igual en Python. Las 9 que se pueden comparar con mediciones anteriores dan el
  mismo hash que en el paso 1 o en la tanda 3 de la entrega 8.
- Datos de prueba, con autorización del responsable, todos «PRUEBA E9» y
  editados una vez: `CLI00000008` y `CPR00000010` en el «antes», y
  `CLI00000009` y `CPR00000011` en el «después». T3 y T4 no escriben.
- Predicción escrita antes del push (`piloto-antes.json`).
- Push de 10 commits (`490034e` a `ef477f2`): CI #71 en verde (2m 54s). Vercel
  desplegó `ef477f2` (`success` a las 17:27:30 UTC) y cambió el `buildId`
  (`b5G58zIOVKJPdKq72MOEh`). El CSS servido es el predicho byte a byte (113.899
  bytes, `5a0081d3…`).
- «Después», de 17:33 a 17:48 UTC. La galería respondía 500 (abajo).

T1 a T5, con los mismos pasos en las dos fases. Los tiempos son del navegador,
del clic o el envío al evento:

| Tarea | Antes (`1812fff`) | Después (`ef477f2`) |
|---|---|---|
| T1 Alta desde `?status=activo&pageSize=3&page=2` | 4 pasos; formulario listo en 677 ms; aviso a los 1.386 ms; vuelve a `/clients` sin filtros ni página; foco en `body` | 4 pasos; panel listo en 1.027 ms; aviso a los 1.499 ms, con la nota de filtros; vuelve a la misma URL y la lista se refresca; foco en «Nuevo cliente» |
| T2 Edición desde `?q=PRUEBA+E9&status=activo&pageSize=3` | 4 pasos; 556 ms y 1.104 ms; pierde los filtros aunque el enlace llevaba `returnTo` | 4 pasos; 723 ms y 1.280 ms; vuelve a la lista filtrada; foco en el «Editar» de la fila |
| T3 Error (nombre «A», tipo Ferretería y una observación) | Se pierde todo lo escrito, también el tipo; foco en `body`, sin `aria-invalid`; alerta y toast | Se conserva todo; foco en el nombre, con `aria-invalid` y su error asociado; una alerta y ningún toast |
| T4 Cancelar con cambios | Sale sin preguntar y pierde los filtros | Pide confirmar «¿Descartar el cliente nuevo?»; Esc vuelve con lo escrito; descartar vuelve a la lista filtrada; no escribe nada |
| T5 Categoría | Alta en 5 pasos (1.217 ms) y edición en la fila en 4 (1.114 ms) | Alta en 5 pasos (1.062 ms) y edición en 5 (982 ms); la ventana abre en 23 ms con el foco en el nombre, y el foco vuelve al botón que la abrió |

Notas sobre T1 a T5:

- En las dos fases todo ocurre en un solo documento, con un aviso por guardado.
- Para la entrega 10: el panel con URL tarda unos 350 ms más que la página
  completa en estar listo, porque pide la ruta del panel; la ventana sin URL
  abre al instante.
- La predicción decía 6 pasos para el alta de categoría: el foco inicial ya
  está en el nombre y sobra el clic.
- El texto de la confirmación de T4 es el que fijó C6, no el de la predicción.

Teclado y 376 px:

- Teclado a 1281 px, con teclas reales:
  - Enter en «Nuevo cliente» abre el panel con el foco en el primer campo.
  - Mayús+Tab va a la X y Tab vuelve al campo.
  - Esc sin cambios cierra sin preguntar y devuelve el foco al enlace, con su
    anillo.
  - Atrás cierra el panel en el mismo documento y Adelante lo reabre.
- A 376 px:
  - El panel y la ventana de categoría ocupan la pantalla (376 × 813), con los
    botones del pie apilados y sin desbordamiento horizontal.
  - El cuerpo del panel desborda, pero no entra en el orden de Tab porque tiene
    campos (la regla de K4).
  - Ninguna página medida desborda.

La regresión de la galería:

- `/dashboard/gallery` respondía 500.
- Causa: desde C2, `Button` pendiente agregaba siempre un `onClick`. `Button`
  no es un componente de cliente, y la sección «Botones» de la galería, que es
  un componente de servidor, pinta botones pendientes. React Server Components
  no admite manejadores en un elemento que llega del servidor.
- Se reprodujo con el renderizador RSC de Next
  (`tmp/e9-diff/repro-rsc-button.tsx`).
- Solo afectaba a la galería: las pantallas usan el pendiente desde componentes
  de cliente.
- El fix `498533d` (prueba roja y 5 de 5 mutaciones) pone la guarda solo cuando
  hay algo que cancelar. CI #72 en verde (2m 48s); Vercel `success` a las
  19:17:29 UTC; `buildId` `NKujz1QVyzsB6uj6JEElm`. Sirve el mismo CSS y la
  galería responde 200.
- La galería se midió a las 19:22 UTC. El panel del navegador se había cerrado
  al reiniciarse la sesión y se perdió su base, así que la comparación es por
  hash contra `piloto-registro.tsv`.

Huella, 18 de 18 (sello del «después» `58d089d2…`, calculado en Python):

- Idénticas, 8: inicio a 1281 y a 376 px, materiales, `OTR00000006`, y las
  secciones «Fundamentos», «Botones», «Campos» y «Mensajes».
- Cambian como se predijo, 8:
  - la lista de clientes: la barra de filtros y una fila más por los datos;
  - la lista filtrada a las dos anchuras: la barra y la posición de lo que la
    sigue, con las mismas filas;
  - «Nuevo cliente» a las dos anchuras: los primeros 194 elementos (el shell y
    el encabezado) son iguales;
  - categorías a las dos anchuras: de 427 a 384 elementos;
  - «Ventanas»: de 13 a 14 elementos, por la nota de `RouteSheet`.
- En total, 15 salieron como se predijo. En una, la lista filtrada a 1281 px,
  hubo además un efecto que no anticipé: la página pasa a medir 800,83 px,
  menos que la ventana; desaparece la barra de desplazamiento y todo se
  ensancha 15,12 px.
- Las 3 desviaciones, explicadas:
  - «Botones» sale idéntica, aunque se predijo que cambiaría su nota. La nota
    nueva está desplegada, pero cambia a partir del carácter 120, y la huella
    guarda solo los 120 primeros de cada texto. Los botones pendientes se ven
    como el deshabilitado anterior: opacidad 0,5 y cursor `default`.
  - «Presentación» y «Listados» cambian de hash con los mismos elementos. Se
    devolvió «Ventanas» a su texto anterior en el DOM de la pestaña, y las tres
    secciones dieron los hashes del «antes» (`fae2709e…`, `bce406a5…` y
    `51687c82…`). «Ventanas» creció 101,98 px, y la geometría relativa de lo
    que hay debajo, redondeada a centésimas, cayó al otro lado, como en las
    tandas 2 y 3 de la entrega 8.

Roles: no se probaron SELLER ni WORKSHOP_MASTER en staging, por decisión del
responsable. Los cubren las pruebas automáticas:

- Las páginas y las ranuras del panel exigen ADMIN o SELLER, y un rol sin
  permiso es rechazado antes de tocar Prisma.
- Las acciones de Clientes aceptan a SELLER y rechazan a WORKSHOP_MASTER.
- Las de categorías rechazan a SELLER y a WORKSHOP_MASTER con un error.
- La página de categorías muestra «Solo lectura» a SELLER.

Evidencia en `tmp/e9-diff/piloto-antes.json`, `piloto-despues.json` y
`piloto-registro.tsv` (ignorados).

Batería E2E escrita para la entrega 11 (Playwright con una base desechable):

| # | Caso | Esperado |
|---|---|---|
| E1 | Clic en «Nuevo cliente» o «Editar» desde la lista filtrada | Panel sobre la lista con la URL `/clients/new` o `/clients/<id>/edit`; la lista, sus filtros, la página y el desplazamiento siguen debajo |
| E2 | Recarga, URL directa o pestaña nueva | Página completa con el mismo formulario |
| E3 | Atrás con el panel abierto, y después Adelante | Cierra el panel y lo reabre |
| E4 | Guardar en el panel | Un aviso; el panel se cierra; la lista muestra el cambio en el mismo punto; el foco vuelve al enlace |
| E5 | Cancelar, X, Esc o el velo con cambios | Confirmación de descarte; seguir editando conserva lo escrito |
| E6 | Recargar con cambios | Aviso del navegador |
| E7 | Error del servidor | Se conserva lo escrito, el foco va al primer campo inválido y no sale un toast |
| E8 | Enter repetido o doble clic durante el envío | Un solo envío |
| E9 | Ventana modal de categoría | Foco en el primer campo, Esc, descarte y foco devuelto al botón |
| E10 | Roles | ADMIN gestiona todo; SELLER gestiona clientes y solo consulta categorías; WORKSHOP_MASTER, acceso denegado en las dos |
| E11 | Atrás del navegador con cambios en el panel | Cierra sin preguntar (limitación conocida); si Next llega a permitir interceptarlo, el caso cambia |
| E12 | Cargar cada página, galería incluida, en un build de producción | 200 y ningún error de servidor: la regresión de la galería solo apareció en staging (hallazgo 8) |

Hallazgos:

1. Tailwind v4 genera una utilidad por cada palabra con forma de clase que
   encuentra en los archivos que git no ignora, también en los `.md` y en los
   nombres de variables. En el 1b, el primer intento agregaba 3 utilidades
   muertas por un parámetro de `dialog.tsx` y dos nombres de la prueba, que se
   renombraron. Desde los registros de la entrega 8, el CSS de staging y
   producción lleva `.text-red-200`, `.bg-black` y `.max-w-lg` sin
   consumidores, sacadas de `CLAUDE.md` y de este archivo. No cambia nada
   visible. Se corrige con `@source not` en un commit propio; mientras tanto,
   cada registro se comprueba compilando: con este, el CSS no cambia.
2. Los defectos de `returnTo` estaban en producción:
   - Decodificaba dos veces: un `&` o un `%` dentro de un filtro rompía la
     lista al volver.
   - No normalizaba la ruta: `/dashboard/../api/reports/export/audit` pasaba
     la validación, y «Volver» habría ejecutado una exportación.
   - Aceptaba cualquier ruta que empezara por las letras `/dashboard`, aunque
     no fuera ese segmento.
3. Al cerrarse, un `Dialog` o `AlertDialog` modal de Radix enfoca su
   disparador; sin disparador, el foco cae en `body`. `ConfirmDialog`
   controlada y `RouteSheet` guardan el foco y lo devuelven a mano.
4. React 19 reinicia los campos de un `<form action>` al terminar la acción,
   aunque esta devuelva un error; un `<select>` no toma un `defaultValue` nuevo,
   y `useActionState` encola un segundo envío. Lo comprobó una exploración en
   jsdom (`tmp/e9-diff/explore-form.test.ts`), y el «antes» de T3 lo confirmó
   en staging: Clientes perdía todo lo escrito, también el tipo elegido en el
   `<select>`.
5. Antes de C8b, ninguna prueba detectaba un aviso intercambiado: el aviso
   viaja como prop de un componente de cliente y no aparece en el HTML. Lo
   detecta ahora el snapshot del registro.
6. Un `aria-describedby={undefined}` explícito borra la descripción que Radix
   asocia. Se escribió dos veces (en el panel y en la ventana modal); solo debe
   ir cuando no hay descripción, y ahora lo cubren pruebas.
7. El inventario no entiende las ranuras ni las rutas interceptadas: cuenta
   bien las páginas, pero las nombra `/dashboard/commercial/clients/@panel` y
   `…/@panel/edit`.
8. Las pruebas no aplican las reglas de React Server Components:
   `renderToStaticMarkup` ignora los manejadores, así que un componente de
   servidor que pasa una función a un elemento solo falla en un build real. Así
   llegó a staging la galería con 500 (fix `498533d`). La batería de la entrega
   11 debe cargar cada página en un build de producción (caso E12).
9. La huella guarda solo los primeros 120 caracteres del texto de cada
   elemento: un cambio de texto más allá no cambia el hash si la geometría no
   cambia («Botones»). Para la entrega 10, guardar el hash del texto completo.
10. Si el panel del navegador integrado se cierra (por ejemplo, al reiniciarse
    la sesión), se pierden la sesión de Vercel y la base de la huella. La
    evidencia queda en los hashes de `tmp/e9-diff`.

Lo que queda:

| Pendiente | Dónde |
|---|---|
| Integrar la entrega en `main` (PR que abre el responsable) | Paso 0 de la entrega 10 |
| Extraer un diálogo de formulario compartido: el descarte y la guarda de ocupado viven en la demo de la galería, en `RouteSheet` y en la ventana de categorías | Entrega 10, con el siguiente catálogo |
| Acciones de `useActionState` que redirigen al negar el permiso (la desviación conocida: productos y el resto de la lista de `CLAUDE.md`) | Entrega 10, al migrar cada formulario |
| Confirmar antes de enviar (`startTransition` con el `pending` externo) y confirmar al inactivar | Entrega 10 |
| El Atrás del navegador con cambios en el panel cierra sin preguntar: el App Router no permite interceptarlo | Documentado; caso E11 de la batería |
| Utilidades muertas que Tailwind saca de los `.md` (hallazgo 1) | Commit propio con `@source not`, cuando lo decida el responsable |
| 14 copias locales de `FieldError`, 109 páginas con `<main>` anidado y 42 formularios GET con 26 combinaciones de clases | Entrega 10 |
| El inventario nombra mal las rutas de ranuras e interceptadas (hallazgo 7) | Con el siguiente cambio de `scripts/refactoring-inventory.mjs` |
| Hash del texto completo en la huella visual (hallazgo 9) | Entrega 10, antes de su primera verificación en staging |
| Batería E2E con Playwright, con el caso E12 (hallazgo 8) | Entrega 11 |
| SweetAlert2 restante y el adaptador `legacy-industrial-dark` | Entrega 11 |

De la lista de la entrega 8 quedan resueltos:

- K4, en el paso 1.
- `aria-disabled`, decidido y aplicado en C2.
- `ConfirmDialog` con formularios y `useActionState`, en C3, con el patrón de
  confirmar antes de enviar para la entrega 10.
- Playwright, decidido para la entrega 11.

De `FieldError` se migran 2 de las 16 copias, y del `<main>` anidado, 4 de las
113 páginas.

### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-15 y comparados con git:

- PR #22, abierto a las 19:40:31 UTC y fusionado con merge commit a las
  19:43:43 UTC del 2026-10-15: 15 commits, de `543ff6e` a `e81299e`. Su CI,
  el #74, sobre `e81299e`, terminó en verde (2m 56s).
- El merge commit `e38d633` tiene como padres `a945a5a` (`main`) y `e81299e`
  (`staging`), y su árbol es el de `e81299e` (`f87a9cc0`): `main` y `staging`
  tienen el mismo contenido. CI #75 en verde (2m 58s).
- Vercel desplegó `e38d633` en producción al primer intento (estado «Vercel»
  `pending` a las 19:43:46 UTC y `success` a las 19:45:20 UTC). La entrega no
  trae migraciones.
- El asunto del cierre `e81299e` («Commit de cierre de la entrega 9: Clientes
  panel y categorias») no sigue Conventional Commits: se escribió sin los
  comandos preparados. No se reescribe: ya está en `staging` y en `main`, y
  cambiar el mensaje cambia el hash del commit y del merge, lo que obligaría a
  forzar el push de las dos ramas. Desde la entrega 10, los comandos de cada
  commit se escriben antes de la pregunta que cierra el turno.

## Entrega 10 — Catálogos, listados y resto de dominios

Fecha: desde el 2026-10-15. Estado: en curso; plan aprobado por el
responsable el 2026-10-15. El paso 0 (`62640e1`) registró la integración de
la entrega 9 en `main`.

Es la tercera entrega de la pista B y cubre las fases 4 y 7 del plan maestro:
los catálogos, los listados y el resto de dominios adoptan los patrones del
piloto. Se divide en 8 sub-entregas por área, y cada una se publica y se
verifica en staging por separado.

Punto de partida (auditoría sobre `62640e1`):

- 135 formularios JSX, 131 páginas y 48 archivos de acciones.
- 34 archivos de acciones lanzan `throw new Error` (282 lanzamientos) en lugar
  de devolver un resultado. Solo Producción tiene `error.tsx`, y en producción
  Next oculta el mensaje: un rechazo de negocio muestra la página de error
  genérica y se pierde lo escrito.
- Solo 7 archivos de acciones están caracterizados: clientes, productos,
  costos, salidas, compras, órdenes de trabajo y avances.
- La desviación de autorización afecta a 30 funciones en 15 archivos.
- Inactivar no pide confirmación: `RowToggleStatusButton` en 9 páginas, el
  gestor de catálogos de inventario y 3 listas de Producción.
- Hay 14 copias de `FieldError`, 109 páginas con `<main>` anidado, 42
  formularios GET con 26 combinaciones de clases y `StatusBadge` en 12
  archivos.
- 27 pantallas tienen rango de fechas, contadas por nombre de parámetro: 19
  con `from`/`to`, 7 con `dateFrom`/`dateTo` y 1 con `desde`/`hasta`. Son las
  mismas en `aada765`.
- No hay manual de usuario en el repositorio.

Decisiones del responsable (2026-10-15):

- La presentación sigue la sección 5, con los datos de la entrega 9:
  - Ventana modal breve, sin URL: hasta unos 4 campos sin datos dependientes.
  - Panel lateral con URL (rutas interceptadas): una entidad de 5 a 12 campos.
  - Superficie amplia, una página completa con `returnTo` y descarte: líneas o
    varias secciones.
  - En el teléfono, las tres ocupan la pantalla.
- Diálogo de formulario compartido en 10.1:
  - `FormDialog`.
  - `useFormSurface`: los controles de la ventana, o `null` en página
    completa.
  - `useFormResult`: un aviso por operación.
  - Un guardián de descarte común a `FormDialog` y `RouteSheet`.

  La extracción no cambia nada. Un `feat` aparte hace que la ventana modal
  también avise al recargar con cambios.
- La desviación de autorización se corrige en el `feat` que migra el contrato
  de cada formulario y se anuncia en su mensaje. Antes, la caracterización fija
  la redirección actual.
- Un formulario que hoy lanza pasa a `FormActionState` en su `feat`, con una
  prueba de cada mensaje que antes se perdía.
- `ConfirmActionButton` (10.1) es una `ConfirmDialog` controlada que ejecuta la
  acción con `startTransition` y usa como pendiente externo el de
  `useTransition` (el plan decía el de `useActionState`; la 10.1 explica el
  cambio). Confirman inactivar, dar de baja, anular y borrar; activar, no.
- La unidad de la tarifa de operarios bloquea unificar el cálculo y la
  etiqueta, no la presentación. Por eso Personal y Costos van al final (10.8):
  si la decisión llega antes, su `fix` abre 10.8; si no, 10.8 conserva el
  texto «Tarifa».
- El manual de usuario se versiona en `docs/manual/`, con un archivo por área.
  Cada sub-entrega agrega su capítulo en el cierre, escrito con lo verificado
  en staging. Antes, `@source not` excluye la documentación del escaneo de
  Tailwind; es el primer commit de 10.1.
- El inventario aprende las ranuras y las rutas interceptadas al empezar 10.3,
  antes del siguiente panel.
- Pedidos pilotea la superficie amplia con líneas, porque no mueve stock ni
  dinero. Las versiones de receta la reutilizan, y la entrega 11 la hereda
  para compras, proformas y órdenes de trabajo.
- El `<main>` anidado se quita en todas las páginas de cada área durante su
  sub-entrega, también en las de la entrega 11.
- Un `error.tsx` para el panel queda para la entrega 11.
- En cada verificación, el responsable decide si se prueban SELLER y
  WORKSHOP_MASTER.

Límite con la entrega 11:

- Entran en esta entrega 31 formularios de alta y edición, 32 acciones de fila
  (tablas de cobertura) y todos los listados, también los de las pantallas
  críticas, sin tocar sus acciones de fila.
- Van a la entrega 11 estas 29 operaciones:
  - proformas, comprobantes y pagos de clientes;
  - compras, pagos a proveedor y salidas de inventario;
  - órdenes de trabajo (crear y 7 operaciones) y avances (3);
  - caja chica: apertura, gastos, ingresos y anulación;
  - venta de chatarra, que crea un movimiento de caja;
  - planillas y pago a operario;
  - cancelar pedido (H11).

| Sub-entrega | Área | Roles de las acciones | Alcance | Estimación |
|---|---|---|---|---|
| 10.1 | Bases y catálogos breves | ADMIN | `@source not`, diálogo compartido, `ConfirmActionButton`, tipos de proveedor, categorías de material y de gasto; manual: patrones comunes | 3,5 h |
| 10.2 | Reportes y auditoría | ADMIN; SELLER y WORKSHOP_MASTER en sus reportes | `FilterBar` y `DateRangeFields` en 9 reportes, el historial de exportaciones y auditoría; `fix` del rango invertido | 3,3 h |
| 10.3 | Inventario | ADMIN | Proveedores, materiales y materiales de proveedor; atender alerta; listados. Partida el 2026-10-18 en 10.3a (materiales y alertas) y 10.3b (proveedores, materiales de proveedor y listados); el 2026-10-19 la 10.3b se partió en 10.3b (proveedores y asociaciones) y 10.3c (listados con fechas y `<main>`) | 5 h; recalibrada a 5,3 h y 4,9 h, la 10.3b a 7,5 h y 2,5 h, y la 10.3c a 4,5 h |
| 10.4 | Comercial | ADMIN y SELLER; productos, solo ADMIN | Productos y pedidos; inactivar con confirmación; listados con `Badge`. Partida el 2026-10-23 en 10.4a (productos, estados e inicio), 10.4b (listados con fechas y `Badge`) y 10.4c (pedidos, la superficie amplia) | 5 h; recalibrada a 6,3 h, 3,5 h y 6,6 h, y la 10.4b a 5 h |
| 10.5 | Mantenimiento | ADMIN; fallas, también WORKSHOP_MASTER | Máquinas, repuestos, fallas, preventivos y reparaciones; cambios de estado. Partida el 2026-10-29 en 10.5a (máquinas, repuestos e inicio) y 10.5b (fallas, preventivos y reparaciones) | 8 h; recalibrada a 6 h y 6,7 h |
| 10.6 | Producción: rutas, etapas y recetas | ADMIN y WORKSHOP_MASTER | Rutas, etapas, recetas, versiones y detalles; requerimientos y cuellos de botella; listado de órdenes | 7 h |
| 10.7 | Campañas, mermas y usuarios | ADMIN y WORKSHOP_MASTER; usuarios, solo ADMIN | Campañas y su detalle, chatarra, retazos, usuarios y restablecer contraseña | 8 h |
| 10.8 | Personal y Costos | ADMIN; asistencia y tareas, también WORKSHOP_MASTER | Operarios, asistencia y tareas; secciones del detalle del costeo; listados | 8 h |

La estimación suma unas 48 horas de preparación y verificación, sin contar
las revisiones ni las esperas. Se calibra con la entrega 9:

| Unidad | Minutos |
|---|---|
| Catálogo breve en ventana modal (C8a y C8b) | 14 |
| Entidad en panel que ya usa `useActionState` (C4 a C7, sin rehacer `RouteSheet`) | 50 |
| Página que lanza, convertida en componente con resultado y panel | 65 (estimado) |
| Superficie amplia con líneas | 90 (sin calibrar) |
| Listado (C7) | 9 |
| Acción de fila con confirmación | 10 (estimado) |
| Registro y capítulo del manual | 30 (estimado) |
| Verificación en staging (57 en la entrega 9) | 60 |

Se recalibra después de 10.1 y 10.2. Las sub-entregas de 7 u 8 horas pueden
partirse en dos; por ejemplo, 10.5a para máquinas y repuestos y 10.5b para
fallas, preventivos y reparaciones.

Cobertura de formularios. «Hoy» describe el mecanismo actual:

- «desviación»: usa `useActionState` y redirige al negar el permiso.
- «lanza»: la acción usa `throw new Error`.

| Formulario | Área | Roles | Hoy | Presentación | Sub-entrega | Estado |
|---|---|---|---|---|---|---|
| Clientes | Comercial | ADMIN, SELLER | — | Panel lateral | 9 | Migrado |
| Categorías de producto | Comercial | ADMIN | — | Modal breve | 9 | Migrado |
| Tipos de proveedor | Inventario | ADMIN | Gestor de catálogo, desviación | Modal breve | 10.1 | Migrado |
| Categorías de material | Inventario | ADMIN | Gestor de catálogo, desviación | Modal breve | 10.1 | Migrado |
| Categorías de gasto | Caja chica | ADMIN | Formulario en la lista y página de edición, desviación | Modal breve; la edición conserva su página | 10.1 | Migrado; sin el campo Estado |
| Proveedores | Inventario | ADMIN | Páginas, desviación | Panel lateral | 10.3b | Migrado |
| Materiales | Inventario | ADMIN | Páginas, desviación; el alta escribe el kárdex inicial y la alerta de stock | Panel lateral | 10.3a | Migrado |
| Materiales de proveedor | Inventario | ADMIN | Páginas, desviación | Panel lateral | 10.3b | Migrado |
| Productos | Comercial | ADMIN | Páginas, desviación | Panel lateral | 10.4a | Migrado |
| Pedidos | Comercial | ADMIN, SELLER | Páginas con líneas, desviación | Superficie amplia | 10.4c | Pendiente |
| Máquinas | Mantenimiento | ADMIN | Páginas, desviación | Panel lateral | 10.5 | Pendiente |
| Repuestos | Mantenimiento | ADMIN | Páginas, desviación; alta auxiliar de proveedor | Panel lateral | 10.5 | Pendiente |
| Fallas | Mantenimiento | ADMIN, WORKSHOP_MASTER | Página, lanza | Panel lateral | 10.5 | Pendiente |
| Mantenimientos preventivos | Mantenimiento | ADMIN | Página, lanza | Panel lateral | 10.5 | Pendiente |
| Reparaciones | Mantenimiento | ADMIN | Página con varios repuestos, lanza | Panel lateral amplio | 10.5 | Pendiente |
| Rutas de fabricación | Producción | ADMIN, WORKSHOP_MASTER | Páginas de alta y edición, lanza | Modal breve | 10.6 | Pendiente |
| Etapas de ruta | Producción | ADMIN, WORKSHOP_MASTER | Páginas, desviación | Panel lateral | 10.6 | Pendiente |
| Recetas técnicas | Producción | ADMIN, WORKSHOP_MASTER | Página, lanza | Modal breve | 10.6 | Pendiente |
| Versiones de receta | Producción | ADMIN, WORKSHOP_MASTER | Página con líneas, lanza | Superficie amplia | 10.6 | Pendiente |
| Detalles de receta | Producción | ADMIN, WORKSHOP_MASTER | Páginas, desviación | Panel lateral | 10.6 | Pendiente |
| Campañas de producción | Producción | ADMIN, WORKSHOP_MASTER | Páginas de alta y edición, lanza | Panel lateral | 10.7 | Pendiente |
| Detalle de campaña | Producción | ADMIN, WORKSHOP_MASTER | Página, lanza | Modal breve | 10.7 | Pendiente |
| Chatarra | Mermas | ADMIN, WORKSHOP_MASTER | Página, lanza | Panel lateral | 10.7 | Pendiente |
| Retazos reutilizables | Mermas | ADMIN, WORKSHOP_MASTER | Página, lanza | Panel lateral | 10.7 | Pendiente |
| Usuarios | Usuarios | ADMIN | Páginas, desviación; el `Label` de rol sin control al editarse a sí mismo | Panel lateral | 10.7 | Pendiente |
| Restablecer contraseña | Usuarios | ADMIN | Página, desviación | Modal breve | 10.7 | Pendiente |
| Operarios | Personal | ADMIN | Páginas, desviación | Panel lateral | 10.8 | Pendiente |
| Asistencia | Personal | ADMIN, WORKSHOP_MASTER | Página, lanza | Panel lateral | 10.8 | Pendiente |
| Tareas de operario | Personal | ADMIN, WORKSHOP_MASTER | Página, lanza | Panel lateral | 10.8 | Pendiente |
| Mano de obra del costeo | Costos | ADMIN | Sección del detalle, lanza | Superficie amplia (el detalle) | 10.8 | Pendiente |
| Costos indirectos | Costos | ADMIN | Sección del detalle, lanza | Superficie amplia (el detalle) | 10.8 | Pendiente |
| Márgenes | Costos | ADMIN | Sección del detalle, lanza | Superficie amplia (el detalle) | 10.8 | Pendiente |
| Rentabilidad | Costos | ADMIN | Sección del detalle, lanza | Superficie amplia (el detalle) | 10.8 | Pendiente |

Cobertura de acciones de fila; todas pasan a devolver un resultado y las
destructivas confirman:

| Sub-entrega | Acciones |
|---|---|
| 10.1 | Inactivar tipo de proveedor, categoría de material y categoría de gasto (migradas) |
| 10.3 | Inactivar material y atender alerta de stock (10.3a, migradas); inactivar proveedor y material de proveedor (10.3b, migradas) |
| 10.4 | Inactivar cliente, producto y categoría de producto (10.4a, migradas) |
| 10.5 | Inactivar máquina y repuesto; cambiar el estado de máquina, repuesto, falla, preventivo y reparación |
| 10.6 | Inactivar ruta, etapa y receta; marcar versión vigente; anular versión; borrar detalle de receta |
| 10.7 | Cambiar el estado de campaña y de retazo; activar y desactivar usuario |
| 10.8 | Inactivar operario; cancelar tarea; generar costeo desde una orden; recalcular costeo; anular costo indirecto |

### Sub-entrega 10.1 — Bases y catálogos breves

Fecha: del 2026-10-15 al 2026-10-17. Estado: cerrada el 2026-10-17. 12
commits, de `582f871` a `0f968ad`, más el registro `b3ec729` y el cierre
`d3de58e` (CI #77 en verde). Integrada en `main` con el PR #23 (merge commit
`9f52808`, CI #79 en verde):

| Commit | Tipo | Cambio |
|---|---|---|
| 582f871 | fix | El Markdown sale del escaneo de Tailwind: `src/styles/sources.css` con `@source not`, importada desde `globals.css`. |
| f6dd994 | refactor | Descarte y superficie compartidos: `FormDialog`, `useFormSurface`, `useFormResult` y `useDiscardGuard`; `RouteSheet`, la ventana de categorías de producto, `ClientForm` y la demo de la galería los usan sin cambiar lo que hacen. |
| 8b7aeab | feat | La ventana modal también avisa al recargar con cambios. |
| af50bb2 | feat | `ConfirmActionButton` para las acciones de fila; `ConfirmDialog` gana `closeOnConfirm` y `error`. |
| b6d57ef | test | Caracterización de tipos de proveedor y categorías de material (46 casos). |
| fd762d6 | fix | Activar e inactivar esos catálogos fijan el estado pedido. |
| 41dedf4 | feat | Tipos de proveedor y categorías de material en ventana modal con `FormActionState`. |
| 40cdd85 | feat | Inactivarlos pide confirmación. |
| 524d53b | test | Caracterización de las categorías de gasto (26 casos). |
| ddde8f6 | fix | Activar e inactivar categorías de gasto fijan el estado pedido. |
| 05b4523 | feat | Categorías de gasto en ventana modal, sin el campo Estado. |
| 0f968ad | feat | Inactivarlas pide confirmación; el listado usa `FilterBar`. |

Decisiones del responsable en la sub-entrega (2026-10-15):

- A. Activar e inactivar envían el estado pedido, y el servidor lo fija con
  una sola sentencia que compara y escribe (*compare-and-set*).
- B. Los catálogos de inventario conservan sus textos de alta y edición
  («Registro creado correctamente»), ahora en cuatro claves del catálogo.
- C. La edición de categorías de gasto se abre en la ventana; su URL
  `[id]/edit` sigue sirviendo el mismo formulario a pantalla completa.
- D. WORKSHOP_MASTER ve las categorías de material en solo lectura.
- El formulario de categorías de gasto pierde el campo Estado (decidido tras
  la caracterización del commit `524d53b`).

Diseño:

- Superficie del formulario (`src/components/forms/form-surface.tsx`). El
  mismo formulario funciona en el panel (`RouteSheet`), en la ventana modal
  (`FormDialog`) y en una página completa:
  - `useFormSurface()` devuelve los controles de la ventana (`requestClose`,
    `closeAfterSave` y `setBusy`), o `null` en la página.
  - `useFormResult(state, pending, { successNotification, onSuccess })`
    informa el pendiente y da un solo aviso por operación. El aviso y
    `onSuccess` se leen de una ref: si el efecto dependiera de ellos, una
    función nueva en cada render repetiría el aviso.
  - `useDiscardGuard` reúne los cambios pendientes, la guarda de ocupado, el
    aviso al recargar y la confirmación de descarte. Sus controles leen refs
    para ser estables.
- `FormDialog` (`src/components/forms/form-dialog.tsx`) es la ventana modal
  con su disparador; desde `8b7aeab` también avisa al recargar con cambios.
- `ConfirmActionButton` (`src/components/forms/confirm-action-button.tsx`)
  ejecuta la acción con `await` dentro de `startTransition`, y el pendiente de
  `useTransition` dura hasta la respuesta. El plan decía el pendiente de
  `useActionState`, pero cerrar la confirmación al llegar el éxito habría
  exigido un `setState` dentro de un efecto, que prohíbe el lint de React.
  Con éxito, un aviso y se cierra; con error, el mensaje queda dentro. Sin
  `confirm`, como al activar, el botón ejecuta la acción y un error sale como
  aviso.
- Estado pedido (`src/lib/requested-status.ts`). `parseRequestedStatus`
  acepta solo `"true"` o `"false"`, y `StatusToggleState` es el resultado de
  una acción de fila. La acción hace `updateMany` con el estado opuesto en el
  `where`. Con `count` 0 lee el registro para responder «ya estaba
  inactivo» o «no existe», sin bitácora. `RowToggleStatusButton` gana la prop
  opcional `sendsRequestedStatus` para el paso intermedio de cada área.
- Catálogos de inventario. Un contrato común
  (`src/modules/inventory/catalog-form-state.ts`), `InventoryCatalogDialog` y
  `InventoryCatalogManager`, que pasa a ser una tabla de servidor de solo
  lectura.
- Categorías de gasto. `ExpenseCategoryForm` funciona en la ventana o en la
  página, y `ExpenseCategoryStatusButton` es el botón de la fila. El campo
  `estado` sale también del esquema: con su valor por defecto `"true"`,
  editar una categoría inactiva la habría reactivado.
- Las confirmaciones dicen la consecuencia real, comprobada en las consultas:
  un tipo o una categoría inactivos dejan de ofrecerse al registrar, y los
  registros que ya los usan los conservan.
- `action-access.test.ts` declara con `rechazanConResultado` las acciones que
  responden con el error de permisos en lugar de redirigir.

Evidencia:

1. Caracterización antes de mover: 46 casos en los catálogos de inventario y
   26 en las categorías de gasto. Después, un script compara los snapshots:
   las llamadas solo cambian en la autorización (`verify_c7_snaps.py` y
   `verify_c11_snaps.py`), salvo los cambios anunciados en el estado escrito.
2. Prueba roja antes de cada arreglo: `tmp/e10-diff/rojo-c1.txt` (9 archivos
   `.md` escaneados), `rojo-c3.txt`, `rojo-c6.txt` y `rojo-c10.txt`. En los
   dos últimos, pedir «Inactivar» sobre un registro que otro ya había
   inactivado lo volvía a activar.
3. Mutaciones (`tmp/e10-diff/mut_c*.txt`): 5 de 5, 14 de 15, 5 de 5, 13 de
   13, 11 de 11, 7 de 7, 10 de 10, 8 de 8, 11 de 11, 8 de 8, 9 de 9 y 9 de 9;
   en total, 110 de 111. La superviviente (reiniciar los cambios al abrir la
   ventana) es equivalente: todas las salidas ya los dejan en cero.
4. Pruebas con el Radix real para lo que un snapshot no distingue: un
   «Inactivar» con confirmación y uno sin ella pintan el mismo `<button>`.
5. CSS compilado, commit a commit: 113.900 → 113.366 bytes. Solo pierde 7
   utilidades y 4 variables de tema sin consumidores, y no gana nada.
6. `npm run check` terminó con código 0 después de cada commit, de 126 a 135
   archivos de prueba y de 1.977 a 2.108 pruebas. `npm run refactor:inventory`
   analiza 619 archivos: 131 páginas, 130 formularios JSX (eran 135) y 48
   archivos de acciones.
7. Este registro empieza el manual de usuario (`docs/manual/`): las reglas
   comunes de las pantallas renovadas, Inventario y Caja chica. Se escribió
   con el código y sus pruebas, y se contrasta con staging en la
   verificación; el cierre corrige lo que no coincida.

Tiempo entre commits según sus horas (incluye la preparación y la revisión
del responsable; el commit 12 cruzó la noche):

| Commit | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Minutos | 24 | 21 | 13 | 18 | 12 | 7 | 14 | 12 | 6 | 27 | 18 |

Los commits 1 a 11 suman unos 172 minutos, frente a las 3,5 horas de
preparación estimadas para la 10.1.

Hallazgos:

1. Tailwind no solo leía el Markdown. Eran 4 utilidades muertas y no 3:
   también `.bg-white`. Además, los comentarios y nombres del código se
   siguen escaneando. El comentario de una prueba nueva regeneró dos
   utilidades, y un parámetro llamado `container`, la utilidad `.container`.
   Una sonda que pregunta al escáner de dónde sale cada clase encontró los
   dos casos (`tmp/e10-diff/probe-sources.mjs`).
2. 11 acciones de activar e inactivar leían el estado y escribían el
   contrario sin bloqueo; esta sub-entrega corrige 3.
3. La edición de categorías de gasto podía inactivar sin confirmar, y la
   bitácora lo registraba como «actualizar».
4. Con un estado inválido, Zod respondía en inglés («Invalid option…»). Solo
   ocurría con una petición manipulada, y el campo ya no existe.
5. En Windows, la escritura de un archivo justo después de Vitest falló dos
   veces (`Errno 22`). Una vez dejó una mutación aplicada, que se detectó y
   se restauró. Los scripts de mutación ahora reintentan cada escritura y la
   comprueban leyendo el archivo.
6. En jsdom, un Esc sintético sí cierra las ventanas de Radix; en el
   navegador real no. Allí se sigue probando con teclas reales.
7. Quitar un campo de un formulario exige quitarlo también del esquema si
   tiene un valor por defecto.

#### Publicación, CI y verificación en staging

Método:

- Huella v5 (`tmp/e10-diff/huella.js`): la v4 de la entrega 9 con su propia
  base (`e10-huella`) y etiquetas `e10/`. Guarda el texto completo de cada
  elemento (la v4 lo cortaba en 120 caracteres, hallazgo 9 de la entrega 9) y
  devuelve aparte el hash de los textos.
- Medidor de tareas (`tmp/e10-diff/medidor.js`), como en la entrega 9.
- Clics y teclas reales; también Enter y Esc.
- Las listas que cambian con los datos de prueba se capturaron en el «antes»
  después de sus tareas, y en el «después» antes de las suyas: las dos fases
  ven una sola fila «PRUEBA E10 antes» activa.

Publicación y medición:

- «Antes» el 2026-10-17, de 00:29 a 00:43 UTC, sobre `e81299e` (`buildId`
  `FmieWNMH6hbqw0HZiY0ih`): 17 capturas con ADMIN, con el sello `0078f4e8…`,
  igual en Python. Tres repeticiones de control dieron el mismo hash.
- Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-1.md`), con
  un anexo del «antes»: las listas se ordenan por estado, y al inactivar la
  fila salta al final.
- Datos de prueba, con autorización del responsable: `TPR00000006` y
  `CGA00000002` («PRUEBA E10 antes») y `TPR00000007` y `CGA00000003`
  («PRUEBA E10 despues»), todos activos al terminar. T4 y los controles no
  escriben.
- Push de 15 commits (`62640e1` a `b3ec729`): CI #76 en verde (2m 54s).
  Vercel desplegó `b3ec729` (`success` a las 01:13:36 UTC) y cambió el
  `buildId` (`EK0U8em4FPh9uqS2QCKRX`). El CSS
  servido es el predicho byte a byte (113.365 bytes, `3e6b3374…`).
- «Después» el 2026-10-17, de 01:52 a 02:06 UTC: 17 capturas, sello
  `299de801…`, igual en Python.

Huella, 17 de 17:

- Idénticas, 8: inicio a 1281 y a 376 px, categorías de producto y las
  secciones «Fundamentos», «Botones», «Campos», «Mensajes» y «Presentación».
- Cambian como se predijo, 8:
  - tipos de proveedor y categorías de material: «Nuevo…» en el encabezado,
    sin formulario en la página y la tabla de solo lectura (de 355 a 301 y de
    337 a 290 elementos);
  - categorías de gasto a las dos anchuras: `FilterBar` fuera de la tarjeta y
    «Nueva categoría» junto a «Solo ADMIN»;
  - tipos de proveedor a 376 px: lo mismo que a 1281, sin desbordamiento;
  - la edición de `CGA00000001`: sin el selector Estado y con «Nombre de
    categoría*»;
  - «Ventanas»: solo el texto de la nota, con la misma geometría;
  - «Listados»: la nota crece 39 px y los otros 122 elementos solo bajan
    39 px.
- Una diferencia del «antes», demostrada: clientes a 1281 px. Solo cambiaban
  los enlaces «Dashboard» y «Comercial» de la barra lateral. En el «antes» su
  transición de color estaba congelada en el arranque, con «Dashboard» aún
  activo: la página estaba oculta y Chrome no avanza las animaciones sin
  pintar. Pausadas esas 6 transiciones al arrancar, el «después» da el hash
  del «antes» (`aa3d2de8…`). La 10.1 no toca la barra ni sus estilos.

Tareas, con los mismos pasos en las dos fases. Los tiempos son del
navegador, del clic al aviso o al mensaje:

| Tarea | Antes (`e81299e`) | Después (`b3ec729`) |
|---|---|---|
| T6 Alta de tipo de proveedor con el slug `otros` | Alerta (779 ms) y toast de error; se borran los tres campos; foco en `body` | Ventana con el foco en el nombre; alerta dentro (785 ms), sin toast; se conserva lo escrito; foco en el nombre, con `aria-invalid` |
| T6 Alta válida | Toast «Registro creado correctamente» (1.041 ms); foco en `body` | Un aviso (1.018 ms); la ventana se cierra; foco en «Nuevo tipo de proveedor» |
| T7 Inactivar el tipo | Sin preguntar; `?toast=` (1.577 ms); foco en `body` | Confirmación con la consecuencia; Esc la cierra sin hacer nada; al confirmar, un aviso (917 ms); la fila pasa al final y el foco la sigue en «Activar» |
| T7 Activar | Sin preguntar; `?toast=` (1.111 ms); foco en `body` | Con Enter, sin preguntar; un aviso (987 ms); la fila vuelve a su sitio y el foco sigue en el mismo botón, ahora «Inactivar» |
| T8 Alta de categoría de gasto | En la tarjeta, con selector Estado; `?toast=` (1.099 ms) | En la ventana, sin Estado; un aviso (1.442 ms); foco en «Nueva categoría» |
| T8 Edición | Página `[id]/edit` con Estado; vuelve con `?toast=` (923 ms) | En la ventana: un aviso (1.530 ms) y el foco vuelve a «Editar». Por la URL, la página completa sin Estado: un aviso (1.257 ms) y vuelve a la lista sin `?toast=` |
| T8 Inactivar y activar | Sin preguntar, con `?toast=` (1.061 y 952 ms) | Inactivar confirma y activar no; un aviso cada uno (1.140 y 894 ms); el foco queda en el mismo botón |

Controles del «después», sin escribir:

- T4: «Nuevo cliente» desde `?q=a`. Sin cambios, Cancelar cierra sin
  preguntar; con un nombre escrito pide «¿Descartar el cliente nuevo?», y
  descartar vuelve a `?q=a` con el foco en el enlace.
- Categoría de producto: la ventana abre con el foco en el nombre; Esc con
  cambios pide «¿Descartar la categoría?»; al descartar se cierra y el foco
  vuelve a «Nueva categoría».
- El aviso al recargar (un `beforeunload` sintético que la página cancela)
  solo está activo con cambios, en el panel y en la ventana.
- El clic fuera de la ventana cierra sin cambios y pide descartar con ellos;
  volver de esa confirmación conserva lo escrito.
- A 376 px, la ventana de tipo de proveedor ocupa la pantalla (376 × 813)
  sin desbordamiento; Tab recorre nombre, slug, descripción, Cancelar, Crear
  y Cerrar sin salir de ella; Esc sin cambios cierra y devuelve el foco.
- La edición de un tipo de proveedor muestra su código bajo el título.

SELLER y WORKSHOP_MASTER se omitieron por decisión del responsable: el
«Solo lectura» de las categorías de material lo cubren las pruebas.

Hallazgos de la verificación:

8. Foco (menor; ya ocurría con la ventana de la entrega 9). Si la
   confirmación de descarte se abre con un clic fuera de la ventana,
   «Cancelar» la cierra y deja el foco en `body`: el clic quitó el foco del
   campo y la confirmación lo devuelve al elemento que lo tenía al abrirse.
   Un Tab vuelve al primer campo. Se propone como primer `fix` de la 10.2.
   Corregido en `871fb5a`, en la 10.2.
9. Método: la sesión del ERP se cierra tras 15 minutos sin actividad y
   aterriza en el `/login` de producción. Ejecutar JavaScript no cuenta como
   actividad. Antes de medir se comprueba el origen.
10. Método: la página puede estar oculta (`document.visibilityState`)
    aunque el panel figure como mostrado. Entonces las animaciones casi no
    avanzan: un cierre tardó 1,6 s en desmontar. Se comprueba `data-state` y
    no la existencia del nodo, y una huella con elementos animados de la
    barra lateral se repite.
11. El manual traía ejemplos que no existen («Distribuidor», «Fabricante» y
    «Planchas»). Ahora usa los registros base de la migración
    `20260701173000`, y explica que la fila inactiva pasa al final de la
    lista.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-17 y comparados con git:

- El cierre `d3de58e` se publicó en `staging`: CI #77 en verde (2m 55s), y
  Vercel lo desplegó (`success` a las 15:32:44 UTC).
- PR #23, abierto a las 15:36:00 UTC y fusionado con merge commit a las
  15:40:44 UTC del 2026-10-17: 16 commits, de `62640e1` a `d3de58e`, y 61
  archivos (+8.460 −1.324). Su CI, el #78, sobre `d3de58e`, terminó en verde
  (2m 23s).
- El merge commit `9f52808` tiene como padres `e38d633` (`main`) y `d3de58e`
  (`staging`), y su árbol es el de `d3de58e` (`2d6f4f3e`): `main` y `staging`
  tienen el mismo contenido. CI #79 en verde (2m 38s).
- Vercel desplegó `9f52808` en producción al primer intento (estado «Vercel»
  `pending` a las 15:40:48 UTC y `success` a las 15:42:06 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.2 — Reportes y auditoría

Fecha: del 2026-10-17 al 2026-10-18. Estado: cerrada el 2026-10-18. El paso
0 (`23f2827`) registró la integración de la 10.1 en `main`. 10 commits, de
`871fb5a` a `9d70f59`, el registro `0073c2b`, el `fix` `a4a5f9c` que salió de
la verificación y el cierre `41c35cd` (CI #82 en verde). Integrada en `main`
con el PR #24 (merge commit `9dc6dd9`, CI #84 en verde):

| Commit | Tipo | Cambio |
|---|---|---|
| 871fb5a | fix | Hallazgo 8 de la 10.1: cancelar el descarte devuelve el foco al último elemento enfocado de la ventana; tras un clic fuera quedaba en `body`. `ConfirmDialog` controlada gana `returnFocusTo`. |
| 37cc40c | test | Caso «rango invertido» en las 10 caracterizaciones y «rango de más de 366 días» en las 9 que exportan. |
| 3331e90 | refactor | Las opciones de los filtros de financiero, mantenimiento y auditoría pasan a funciones `find*FilterOptions`. |
| a68066b | fix | `DateRangeFields` solo valida las fechas que el campo puede mostrar (`toDateInputValue`). |
| e66639c | fix | Con el rango invertido, las 10 pantallas no consultan los datos ni ofrecen exportar, y muestran un aviso. |
| 683ca93 | fix | Con más de 366 días, las 9 que exportan muestran un aviso en lugar de los enlaces de exportar. |
| e63ceae | feat | Auditoría e historial con `FilterBar` y `DateRangeFields`; auditoría pierde el `<main>` anidado. |
| a7ff382 | feat | Rentabilidad y personal, sin `<main>` anidado. |
| c2860bb | feat | Ventas y cobranzas, proveedores y compras y financiero. |
| 9d70f59 | feat | Inventario, producción y mantenimiento. |
| 0073c2b | docs | Registro de la sub-entrega, `CLAUDE.md`, inventario y capítulo de Reportes del manual. |
| a4a5f9c | fix | Hallazgo 9 de la verificación: `DateRangeFields` toma las fechas de la URL cuando la página se vuelve a pintar sin montarse («Limpiar», Atrás, Adelante). |
| 41c35cd | docs | Cierre: publicación y verificación en staging, hallazgos, manual cotejado e inventario. |

Alcance: 10 pantallas. El plan de la entrega 10 decía «9 reportes, el
historial y auditoría», pero auditoría es uno de los 9 reportes del registro.
El panel `/dashboard/reports` no tiene filtros y no cambia.

| Pantalla | Roles | Fechas en la URL | Exporta |
|---|---|---|---|
| Ventas y cobranzas | ADMIN y SELLER | `dateFrom`/`dateTo` | Sí |
| Inventario | ADMIN y WORKSHOP_MASTER | `dateFrom`/`dateTo` | Sí |
| Producción | ADMIN y WORKSHOP_MASTER | `dateFrom`/`dateTo` | Sí |
| Mantenimiento | ADMIN y WORKSHOP_MASTER | `dateFrom`/`dateTo` | Sí |
| Proveedores y compras | ADMIN | `dateFrom`/`dateTo` | Sí |
| Financiero | ADMIN | `dateFrom`/`dateTo` | Sí |
| Historial de exportaciones | ADMIN | `dateFrom`/`dateTo` | No |
| Costos y rentabilidad | ADMIN | `from`/`to` | Sí |
| Personal y planillas | ADMIN | `from`/`to` | Sí |
| Auditoría | ADMIN | `from`/`to` | Sí |

Decisiones del responsable (2026-10-17):

- D1. Con el rango invertido en la URL, «Hasta» muestra el mensaje y la
  pantalla muestra «Corrige el rango de fechas para ver el reporte.» en
  lugar de los totales y las tablas. No consulta los datos, solo las
  opciones de los filtros, y no ofrece exportar.
- D2. La ruta de exportación conserva su 400: valida antes de escribir y no
  registra nada. Solo se llega escribiendo la URL a mano.
- D3. Con más de 366 días, la pantalla muestra los datos y, en lugar de los
  botones de exportar, «Para exportar, el rango no puede superar 366 días.».
- D4. Cada pantalla conserva sus textos. El título visible «Filtros del
  reporte» o «Filtros del historial» pasa a ser el nombre accesible de la
  barra.
- La sub-entrega no se parte, y el arreglo del foco se verifica en staging
  con ella.

Diseño:

- Una sola regla para la pantalla y la ruta. `isReportDateRangeInverted` y
  `exceedsReportExportRange` (`src/lib/reports/report-filters.ts`) comparten
  con `validateDateRange` la comparación y la cuenta de días, sobre fechas
  interpretadas con `parseReportDate`. La comparación de texto de
  `isDateRangeInverted` queda para el campo, que solo recibe fechas
  `aaaa-mm-dd` válidas (`toDateInputValue`).
- Cada consulta con opciones expone `get*FilterOptions`, que reutiliza la
  tupla `find*FilterOptions` de su consulta de datos: las opciones no pueden
  divergir entre los dos caminos.
- Cada página tiene su encabezado en un objeto `pageHeader`, sus filtros en un
  componente local `ReportFilters` (`FilterBar`, `Field` y `DateRangeFields`
  con id explícito) y un retorno temprano para el rango invertido. Los avisos
  son `InvertedRangeNotice` y `ExportRangeNotice` (`src/modules/reports`).
- Foco: `useDiscardGuard` recuerda el último elemento enfocado dentro de la
  ventana (`trackFocus` en el `onFocus` del contenido), y la confirmación de
  descarte vuelve ahí, o a la ventana si ese elemento ya no existe.

Evidencia:

1. Prueba roja antes de cada arreglo: `tmp/e10-diff/rojo-102-1.txt` (5
   casos), `rojo-102-c3.txt` (15), `rojo-102-c4.txt` (20) y
   `rojo-102-c5.txt` (18).
2. Los cambios de snapshots se comprobaron con scripts contra copias previas:
   - C1 solo agrega 38 entradas, y C2 no cambia ninguna.
   - C4 cambia solo las 20 del rango invertido: las llamadas son solo las
     de las opciones, y el HTML tiene el aviso y ningún enlace de exportar.
   - C5 cambia solo el HTML de los 9 casos largos: el «antes», con los dos
     enlaces cambiados por el aviso, es exactamente el «después».
   - C6 a C9 (`verify_filters_snaps.py`) dejan idénticas las llamadas y el
     HTML fuera de la barra, y conservan dentro las etiquetas, los campos con
     sus valores, las opciones y los botones.
3. Mutaciones (`tmp/e10-diff/mut_102_*.txt`): 9 de 9, 2 de 2, 5 de 5, 5 de
   5, 6 de 6, 5 de 5, 5 de 5, 4 de 4, 4 de 4 y 4 de 4; en total, 49 de 49.
4. Paridad nueva en `screen-parity.test.ts`: con el rango invertido y con más
   de 366 días, las 9 pantallas que exportan no ofrecen el enlace, y la ruta
   responde 400 sin registrar la exportación.
5. CSS compilado: igual hasta C8. C9 quita solo `xl:col-span-5` y
   `xl:col-span-6` (113.366 → 113.282 bytes), y el CSS anterior sin esas dos
   reglas es el nuevo byte a byte.
6. `npm run check` terminó con código 0 después de cada commit, con 135
   archivos de prueba y de 2.108 a 2.189 pruebas. `npm run
   refactor:inventory` analiza 621 archivos: 131 páginas, 120 formularios JSX
   (eran 130) y 48 archivos de acciones.

Tiempo entre commits según sus horas (incluye la preparación y la revisión
del responsable; el commit C1 incluye la auditoría y el plan):

| Commit | 0 | 1 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Minutos | 30 | 37 | 18 | 6 | 8 | 47 | 9 | 10 | 12 | 9 | 29 |

C1 a C9 suman unos 148 minutos, frente a los 151 que el plan detallado
estimó para esos commits. El plan de la entrega 10 daba 3,3 horas a toda la
sub-entrega; el plan detallado la recalibró a unas 4,4 horas con la
verificación, porque la auditoría agregó la separación de las opciones, el
`fix` de `DateRangeFields`, el límite de 366 días y la verificación del
arreglo del foco.

Hallazgos:

1. `screen-parity.test.ts` compara el filtro de 4 reportes con rangos válidos
   (los del grupo 4), no de los 9: ventas, inventario, producción,
   proveedores y financiero no tienen esa paridad. Las pruebas nuevas de
   rango invertido y largo sí recorren los 9. Ampliarla queda pendiente.
2. `isDateRangeInverted` compara texto, que solo sigue el calendario con
   ceros a la izquierda; la ruta compara fechas. Con «2026-7-5»
   discrepaban. Ahora el campo solo recibe fechas válidas y la pantalla usa
   la regla de la ruta.
3. Con más de 366 días, la pantalla ofrecía exportar y la ruta respondía 400
   con un JSON. Se corrige en `683ca93`.
4. Seis de las nueve consultas ya componían sus opciones con funciones
   `find*` del módulo dueño, así que la separación de las opciones fue
   menor de lo previsto.
5. El maestro de taller tiene permiso para los reportes de inventario y
   mantenimiento, pero ningún enlace lo lleva a ellos: la tarjeta «Reportes
   operativos» del inicio abre el de producción, y el panel de Reportes es
   solo para ADMIN. Se anota para una sub-entrega de navegación.
6. Safari no enfoca un botón al pulsarlo, así que `ConfirmActionButton`
   devolvería el foco al elemento anterior tras «Cancelar». No se pudo
   comprobar sin Safari.
7. Método: la trampa de foco de Radix vuelve a enfocar la ventana cuando
   desaparece un nodo, pero solo si el foco está en `body`. Por eso la
   prueba del respaldo quita el campo con la confirmación abierta.
8. Método: el borde de 366 días se escribió mal en una prueba (366 días
   justos se admiten). La prueba de concordancia con la ruta lo contradijo y
   Python lo confirmó. Cada regla compartida lleva una prueba «coincide con
   la ruta».

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e102-huella`) y etiquetas `e102/`
  (`tmp/e10-diff/e102-huella-min.js`), los ayudantes de navegación y
  comparación (`e102-ayudantes.js`) y el medidor de tareas
  (`e102-medidor.js`), como en la 10.1.
- Clics y teclas reales. Las fechas se escriben con flechas y dígitos:
  escribir texto no llena un `input type="date"`.
- Auditoría e historial con rangos cerrados en el pasado, porque iniciar
  sesión escribe en la bitácora.
- Solo lectura: ninguna tarea guarda datos ni exporta (de los enlaces de
  exportar se lee el `href`).

Publicación y medición:

- «Antes» el 2026-10-17, de 21:06 a 21:25 UTC, sobre `d3de58e` (`buildId`
  `j4iKut5sUaZi1kYn7yebm`, CSS servido de 113.365 bytes, `3e6b3374…`): 16
  capturas con ADMIN, 13 a 1281 px y 3 a 376, con el sello `c8ae572a…`,
  igual en Python, y 4 controles.
- Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-2.md`).
- Push de 12 commits (`23f2827` a `0073c2b`): CI #80 en verde (3m 0s).
  Vercel desplegó `0073c2b` (`success` a las 22:00:03 UTC) y cambió el
  `buildId` (`GA7HaoF8ZH4YtVXNKXzx6`). El CSS servido es el predicho byte a
  byte (113.281 bytes, `c5d15599…`): solo faltan `xl:col-span-5` y
  `xl:col-span-6`.
- «Después» el 2026-10-17, de 22:03 a 22:17 UTC: 16 capturas, sello
  `37026342…`, igual en Python.

Huella: las 16 cambian como se predijo, y los 3 controles (el panel de
reportes, tipos de proveedor y la sección «Listados» de la galería) dan el
mismo hash que en el «antes».

- A 1281 px, en las 10 pantallas el principio de la página es idéntico salvo
  el alto de 4 contenedores (y `main` → `div` en rentabilidad, personal y
  auditoría). Cambia la barra de filtros, y el resto solo se desplaza en `y`,
  con un delta constante por página: −2,3 px en la familia A (−16,3 en
  proveedores y compras), +21,7 en rentabilidad y +43,7 en personal y
  auditoría. La familia A pierde el título visible de la barra (2 elementos
  menos en total).
- staff-largo: lo mismo y, en el encabezado, el aviso de los 366 días en
  lugar de los enlaces (de 354 a 353 elementos).
- Las dos invertidas cambian enteras: la página es más corta (de 441 a 251 y
  de 351 a 300 elementos) y, sin barra de desplazamiento, los anchos cambian
  15 px. Su contenido lo comprueba T9.
- A 376 px, el mismo patrón (−62,3 px en financiero y −22,3 en personal y
  auditoría), sin desbordamiento horizontal.

Tareas, con los mismos pasos en las dos fases:

| Tarea | Antes (`d3de58e`) | Después (`0073c2b`) |
|---|---|---|
| T9 Rango invertido por URL en financiero, auditoría y personal | Consulta: 0 filas con el mensaje de lista vacía, totales a cero (salvo los que no dependen del rango) y dos enlaces de exportar | No consulta: «Corrige el rango de fechas para ver el reporte.», sin totales ni tablas y sin enlaces; «Hasta» con `aria-invalid` y el mensaje |
| T10 Más de 366 días en financiero (2 filas) y personal (1) | Los datos y dos enlaces de exportar | Las mismas filas y el aviso de los 366 días en lugar de los enlaces |
| T11 Auditoría: rango al revés con teclas reales y clic en «Filtrar» | Envía y recarga con el rango invertido; foco en `body` | No envía (mismo documento); «Hasta» muestra el mensaje y recibe el foco |
| T12 Hallazgo 8: clic fuera y Esc, en tipos de proveedor (ventana) y Clientes (panel) | Foco en `body` | Foco en el campo del nombre. «Descartar cambios» sigue devolviendo el foco a «Nuevo tipo de proveedor» y a «Nuevo cliente» |

Control del «después», sin escribir: a 376 px, Tab recorre la barra de
auditoría en orden (Buscar, Usuario, Acción, Entidad, Desde, Hasta, Filtrar,
Limpiar), luego la tabla y «Siguiente». Cada fecha tiene 4 paradas: día, mes,
año y el selector del navegador.

La regresión del «después» y su arreglo:

- Al llegar a T10 por navegación suave desde el rango invertido, personal
  conservaba las fechas anteriores. En personal y auditoría, «Limpiar» dejaba
  la URL limpia y los campos con las fechas viejas, que «Filtrar» volvía a
  aplicar (hallazgo 9). La captura de staff-largo se repitió con la página
  montada de nuevo.
- `a4a5f9c`: la prueba nueva fallaba antes del arreglo en 4 de sus 5 casos
  (`tmp/e10-diff/rojo-102-fix.txt`), las mutaciones dan 8 de 8
  (`mut_102_fix.txt`), `npm run check` terminó en verde con 136 archivos y
  2.194 pruebas, y el CSS compilado no cambia.
- Push: CI #81 en verde (2m 22s). Vercel `success` a las 22:30:52 UTC,
  `buildId` `KZMyuMdruOU1_UopARfPp` y el mismo CSS servido.
- Re-verificación el 2026-10-18, de 02:51 a 02:55 UTC, con la predicción
  escrita antes (`tmp/e10-diff/prediccion-102-fix.md`):
  - «Limpiar» vacía las fechas en personal y auditoría, en el mismo
    documento;
  - Atrás las devuelve y Adelante las vacía;
  - T10 por navegación suave muestra 2025-01-01 y 2026-10-16 sin error, 1
    fila y el aviso de los 366 días;
  - la huella de staff-largo llegando sin recargar desde el rango invertido
    es la del montaje nuevo (`73f5b307…`), la misma del «después» pese al
    cambio de día UTC.

El capítulo de Reportes del manual se cotejó con staging el 2026-10-18: GET
secuencial de las 11 páginas (el panel y las 10 pantallas) sin abrir ninguna
exportación, y los límites de filas y las tarjetas por rol en el código.
Coincide; solo se precisó que «Fecha desde» y «Fecha hasta» son lo habitual
(7 de las 10 pantallas).

Se verificó solo con ADMIN: el responsable no pidió probar SELLER ni
WORKSHOP_MASTER. Ninguna tarea escribió datos. Tiempos: el «antes», 19
minutos; el «después» con sus tareas, 14; del informe de la regresión al
commit del arreglo, unos 9; la re-verificación y el cotejo del manual, 5.

Hallazgos de la verificación:

9. Regresión de la 10.2, corregida en `a4a5f9c`. `DateRangeFields` guardaba
   las fechas en un estado que solo leía la URL al montarse, y Next no vuelve
   a montar la página cuando `next/link` cambia la URL. El componente tenía
   el defecto desde la entrega 8 (`aada765`), pero solo lo usaba la galería:
   antes de la 10.2, los campos de fecha de los reportes no eran controlados
   y React actualizaba su `defaultValue`. Las caracterizaciones no podían
   verlo, porque pintan una sola vez en el servidor.
10. Preexistente, pendiente: un `NativeSelect` con `defaultValue` no sigue a
    la URL tras «Limpiar». En auditoría con `accion=crear`, la acción sigue
    en «crear» aunque la URL y la tabla ya no filtran, porque React no
    actualiza el `defaultValue` de un `<select>`. Afecta a toda barra con
    selects que se limpia con `next/link`, también a las de la 10.1. Se
    propone un `fix` aparte. Corregido en `53d9601`, en la 10.3a: `FilterBar`
    vuelve a montar sus campos cuando cambia la URL. Completado en `9f484d2`
    tras verificar la 10.3a: con Atrás, Adelante y el panel, la URL cambia
    antes de que lleguen los campos de la página (hallazgo 12 de la 10.3a).
11. Preexistente (ya ocurría en el «antes», que tiene el mismo código que
    producción), pendiente: el clic con el ratón en «Cancelar»
    de la confirmación de descarte no la cierra, en la ventana ni en el
    panel; `data-state` pasa de `open` a `closed` y vuelve a `open` en 14 ms.
    Esc, Enter y «Descartar cambios» con el ratón sí funcionan, y jsdom no lo
    reproduce. Hipótesis: la ventana trata ese clic, fuera de su árbol de
    React, como un clic fuera y vuelve a pedir el descarte. Se arregla aparte,
    tras el cierre de la 10.2. Corregido en `49cf5f5`, publicado con la
    10.3a: la ventana y el panel ignoran el clic fuera que empieza dentro de
    la confirmación (`ignoreConfirmationPointer`). En staging, el clic con el
    ratón en «Cancelar» la cierra sin reabrirla, conserva lo escrito y
    devuelve el foco a la ventana o al panel.
12. Método: una huella tomada tras una navegación suave puede arrastrar
    estado del cliente. Por eso la de staff-largo se repitió montando la
    página, y en la re-verificación las dos coinciden.
13. Método: `javascript_tool` no puede devolver un elemento del DOM
    («Object reference chain is too long»); las comprobaciones devuelven
    booleanos y textos.
14. Método: entre sesiones de la app, el panel perdió el acceso a Vercel y
    hubo que entrar de nuevo antes de la re-verificación.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-18 y comparados con git:

- El cierre `41c35cd` se publicó en `staging`: CI #82 en verde (2m 58s), y
  Vercel lo desplegó (`success` a las 03:12:56 UTC).
- PR #24, abierto a las 03:17:48 UTC y fusionado con merge commit a las
  03:21:51 UTC del 2026-10-18: 14 commits, de `23f2827` a `41c35cd`, y 62
  archivos (+7.783 −1.566). Su CI, el #83, sobre `41c35cd`, terminó en verde
  (2m 51s).
- El merge commit `9dc6dd9` tiene como padres `9f52808` (`main`) y `41c35cd`
  (`staging`), y su árbol es el de `41c35cd` (`569d259c`): `main` y `staging`
  tienen el mismo contenido. CI #84 en verde (1m 54s).
- Vercel desplegó `9dc6dd9` en producción al primer intento (estado «Vercel»
  `pending` a las 03:21:57 UTC y `success` a las 03:23:20 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.3a — Materiales y alertas

Fecha: del 2026-10-18 al 2026-10-19 (UTC). Estado: cerrada el 2026-10-19.
9 commits, de `4fd9631` a `c5e6f6b`, el registro `7e50c8e`, el `fix`
`9f484d2` que salió de la verificación y el cierre `512cbc4` (CI #87 en
verde). Viajaron con `513c513` (integración de la 10.2) y `49cf5f5`
(hallazgo 11 de la 10.2), que no se publicaron al cerrar la 10.2.
Integrada en `main` con el PR #25 (merge commit `13ea654`, CI #89 en
verde).

| Commit | Tipo | Cambio |
|---|---|---|
| 4fd9631 | fix | El inventario de refactor muestra la URL de las rutas interceptadas y su ranura (`describeRoute`, con prueba). |
| 53d9601 | fix | Hallazgo 10 de la 10.2: los campos de `FilterBar` se vuelven a montar cuando cambia la URL. |
| 1fe0693 | test | Caracterización de las acciones de materiales y de la alerta de stock (42 casos). |
| ffaa3f1 | fix | El alta de material decide el kárdex inicial y la alerta con la fila que devuelve la escritura. |
| c69eab4 | fix | Activar e inactivar material fijan el estado pedido. |
| d2b3ca3 | fix | Atender una alerta ya atendida no reescribe quién ni cuándo. |
| f7abaf0 | feat | Materiales en panel lateral con `FormActionState`; corrige la desviación de alta y edición. |
| 5991f06 | feat | Inactivar material pide confirmación; el listado usa `FilterBar` y pierde el `<main>` anidado. |
| c5e6f6b | feat | Atender una alerta con confirmación y resultado de acción; alertas sin `<main>` anidado. |
| 7e50c8e | docs | Registro de la sub-entrega, `CLAUDE.md`, inventario y manual de Materiales y Alertas. |
| 9f484d2 | fix | Hallazgo 12 de la verificación: `FilterBar` sigue a la página con Atrás, Adelante y el panel. |
| 512cbc4 | docs | Cierre: publicación y verificación en staging, hallazgos, manual cotejado e inventario. |

Decisiones del responsable (2026-10-18), tras la auditoría:

- D1. La 10.3 se parte. La 10.3a lleva la herramienta, el hallazgo 10, los
  materiales (lo crítico: el alta escribe el kárdex y la alerta) y las
  alertas. La 10.3b lleva proveedores, materiales de proveedor y los
  listados del área. El plan detallado estimó la 10.3 completa en unas
  8,8 horas, por encima del umbral de la entrega 10.
- D2. El hallazgo 10 se corrige primero y en `FilterBar`, así las barras de
  inventario lo heredan.
- D3. El alta de material decide con la fila escrita (regla 5 de
  `CLAUDE.md`), aunque solo cambia con una petición manipulada.
- D4. Atender una alerta confirma con el botón normal, no el destructivo:
  no borra ni anula nada, pero no se puede deshacer.
- La confirmación de inactivar material agrega «y saldrá de Stock crítico
  actual» al texto del plan (aprobado en el commit).

Auditoría: consecuencias comprobadas en las consultas.

- Material inactivo: compras, salidas, recetas (detalles y versiones),
  chatarra, retazos y asociaciones nuevas solo ofrecen y aceptan materiales
  activos; la entrega y la entrega adicional a una orden de trabajo lo
  rechazan; sale de «Stock crítico actual», de «Materiales activos» y de la
  tarjeta de stock bajo del inicio. Su stock, kárdex y alertas se conservan.
- Alerta atendida: no se puede reactivar. «Stock crítico actual» se calcula
  con el stock, así que el material sigue allí mientras no supere el
  mínimo; solo una entrega a una orden de trabajo abre otra alerta.
- Para la 10.3b. Proveedor inactivo: deja de ofrecerse en compras,
  repuestos y asociaciones nuevas, y en el filtro del reporte de proveedores
  y compras; sale de «Proveedores activos»; sus compras, pagos y
  asociaciones lo conservan. Material de proveedor inactivo: ninguna otra
  pantalla lee `proveedor_material`.

Diseño:

- `describeRoute` (`scripts/refactoring-inventory-routes.mjs`) sigue la
  documentación de Next 16: los grupos y las ranuras no son segmentos de la
  URL, y `(.)`, `(..)`, `(..)(..)` y `(...)` cuentan segmentos de ruta. El
  inventario gana la columna «Ranura».
- `FilterBarFields` (`src/components/forms/filter-bar-fields.tsx`) envuelve
  los campos de `FilterBar` en un `Fragment` con la consulta de la URL como
  `key`. Si la URL cambia, los campos se vuelven a montar con los valores que
  la página leyó de ella; si no, conservan lo elegido. Los botones quedan
  fuera y «Limpiar» conserva el foco. El HTML no cambia. Tras la
  verificación, `9f484d2` cambia la `key` por la consulta vigente cuando
  llegan campos nuevos del servidor (hallazgo 12).
- Materiales, como Clientes:
  - `layout.tsx` con la ranura `@panel` (`default`, `page`, `(.)new` y
    `(.)[id]/edit`); cada panel autoriza y consulta como su página completa.
  - Las acciones devuelven `FormActionState` y autorizan con
    `getAuthorizedSession`; ninguna redirige ya.
  - `MaterialForm` usa `ActionForm`, `Field`, `SubmitButton` y
    `useFormResult`; el stock actual y el reservado solo se escriben en el
    alta.
  - `getMaterialEditValues` (`material-edit-values.ts`) da los valores de
    edición a la página y al panel: el `formatDecimal` de la página se movió
    allí.
  - `MaterialStatusButton` y `StockAlertAttendButton` sobre
    `ConfirmActionButton`; atender usa `confirm.variant: "default"`.
- El alta pide `select` de `stock_actual` y `stock_minimo` al `create` y
  decide con esos `Decimal`. Atender y el cambio de estado comparan y
  escriben en una sola sentencia.

Evidencia:

1. Prueba roja antes de cada arreglo: `tmp/e10-diff/rojo-103-c1.txt` (4 de
   7 casos), `rojo-103-c2.txt` (2 de 4), `rojo-103-c4.txt` (3 de 3),
   `rojo-103-c5.txt` (4 de 4) y `rojo-103-c6.txt` (2 de 3).
2. Caracterización antes de mover: 42 casos de acciones en `1fe0693` y dos
   casos de la página de alertas con una alerta activa, escritos con el
   código anterior (`tmp/e10-diff/c9-alerts-pages-snap-antes.snap`): los
   datos generados nunca tenían una alerta activa y el snapshot no mostraba
   la acción.
3. Los cambios de snapshots se comprobaron con scripts contra copias
   previas (`verify_103_c4_snaps.py`, `verify_103_c5_snaps.py`,
   `verify_103_c7_actions.py`, `verify_103_c8_page.py` y
   `verify_103_c9_page.py`): las llamadas solo cambian donde el commit lo
   anuncia, y el HTML, en los elementos que cambian.
4. Mutaciones (`tmp/e10-diff/mut_103_c*.txt`): 7 de 8, 4 de 4, 14 de 14, 6
   de 6, 6 de 6, 5 de 5, 15 de 15, 10 de 10 y 10 de 10; en total, 77 de
   78. La superviviente de C1 (sin `Math.max`) solo cambia al subir por
   encima de la raíz, que no es una ruta válida.
5. Pruebas con React real en jsdom: `filter-bar.test.ts` (4),
   `material-form.test.ts` (10, en página y en panel),
   `material-status-button.test.ts` (3) y `stock-alert-attend-button.test.ts`
   (2), las tres últimas con el Radix real.
6. CSS compilado: igual hasta C7. C8 quita solo la rejilla de la barra
   anterior de materiales (113.282 → 113.131 bytes), y el CSS anterior sin
   esa regla es el nuevo byte a byte. C9 no cambia.
7. `npm run check` terminó con código 0 después de cada commit, de 137 a 143
   archivos de prueba y de 2.205 a 2.286 pruebas. `npm run
   refactor:inventory` analiza 637 archivos: 134 páginas (6 en ranuras, 4
   que interceptan), 117 formularios JSX (eran 120) y 48 archivos de
   acciones.

Tiempo entre commits según sus horas. Incluye la preparación, la revisión
del responsable y sus pausas, así que los primeros no calibran por sí solos:

| Commit | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
|---|---|---|---|---|---|---|---|---|---|
| Hora (Lima) | 09:26 | 12:38 | 14:50 | 16:14 | 16:21 | 16:27 | 16:43 | 17:28 | 17:43 |
| Minutos desde el anterior | — | 192 | 132 | 84 | 7 | 5 | 17 | 45 | 15 |

El tramo más continuo, de C5 a C9, suma 89 minutos frente a los 110 que el
plan estimó para esos commits.

Hallazgos:

1. El inventario de refactor ponía `@panel` en la URL y perdía `new` en las
   rutas interceptadas. Corregido en `4fd9631`.
2. Regla de negocio pendiente: la alerta compara el stock actual con el
   mínimo (alta, entregas y compras), mientras «Stock crítico actual» y el
   filtro «Críticos» comparan el disponible (actual menos reservado). Un
   material puede estar crítico sin alerta.
3. Las salidas de inventario no crean ni actualizan alertas, y editar el
   stock mínimo no las reevalúa.
4. Editar una asociación o un repuesto cuyo proveedor (o material) está
   inactivo falla con «no existe o está inactivo», aunque el formulario lo
   ofrece. Se revisa en la 10.3b y la 10.5. Corregido para las
   asociaciones en `c446d03` (10.3b).
5. El filtro del reporte de proveedores y compras solo ofrece proveedores
   activos: las compras de uno inactivo no se pueden filtrar allí.
6. 13 listados de 5 áreas (entre ellos entradas, salidas, compras y pagos a
   proveedor) filtran fechas con `parseDateParam`, en la hora del servidor, y
   `lte 23:59:59.999`: la regla que el grupo 4 corrigió solo en los reportes.
   Se propone un grupo de `fix` aparte o la entrega 11. Corregido en
   `12975d0` (10.3c) para los 13 que usan `buildDateRangeFilter`; quedan 4
   copias locales (hallazgo 2 de la 10.3c).
7. Carrera menor: una entrega a una orden puede actualizar una alerta que
   alguien acaba de atender, y no abre otra. Entrega 11.
8. Atender no registra bitácora; la alerta guarda quién la atendió y cuándo.
9. Método: `tsc` no conoce `LayoutProps` de un layout nuevo hasta correr
   `next typegen`; `npm run typecheck` lo hace.
10. Método: React agrega su `<script>` de reenvío de formularios solo si la
    página tiene un `<form>` cuya acción es una función. Al pasar las filas a
    `ConfirmActionButton` desaparece del HTML.
11. Método: un heredoc de Bash volvió a comerse las barras invertidas en dos
    scripts de `tmp`. Los scripts de mutación ahora comprueban todos los
    fragmentos antes de ejecutar nada.

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e103-huella`) y etiquetas `e103/`, los
  ayudantes y el medidor de tareas (`tmp/e10-diff/e103-*.js`, generados por
  `c-e103-guiones.py` desde los de la 10.2). Plan en
  `tmp/e10-diff/plan-verificacion-10-3a.md`.
- Clics y teclas reales, puntero en el margen del shell.
- Las capturas que dependen de los datos (lista, lista filtrada y alertas) se
  tomaron en el «antes» después de sus tareas y en el «después» antes de las
  suyas: las dos fases ven el mismo estado.
- T13 a T16 escriben en staging, con autorización del responsable y cada
  material de prueba inactivo al final. Las demás tareas solo leen.

Publicación y medición:

- «Antes» el 2026-10-19, de 00:00 a 01:05 UTC, sobre `41c35cd` (`buildId`
  `E6utUZdLyh7ix_xNXaXhJ`, CSS servido de 113.281 bytes, `c5d15599…`): 7
  capturas y 4 controles, con el sello `7c180c40…`, igual en Python.
- Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-3a.md`).
- Push de 12 commits (`513c513`, `49cf5f5` y de `4fd9631` a `7e50c8e`): CI
  #85 en verde (2m 6s). Vercel desplegó `7e50c8e` (`success` a las 01:11:43
  UTC) y cambió el `buildId` (`959zJuAQLhnbJ-bTWPAS6`). El CSS servido es el
  predicho byte a byte (113.130 bytes, `e8dc6378…`): solo falta la rejilla de
  la barra anterior de materiales.
- «Después» el 2026-10-19, de 01:14 a 01:40 UTC: 7 capturas y 4 controles,
  sello `4da904c7…`, igual en Python. Evidencia en
  `tmp/e10-diff/antes-10-3a.json` y `despues-10-3a.json`.

Huella: las 7 cambian como se predijo, y los 4 controles (proveedores, tipos
de proveedor, auditoría y la sección «Listados» de la galería) dan el mismo
hash que en el «antes».

- Alta y edición a página completa: el encabezado (migas, título y
  descripción) es idéntico registro a registro y la raíz `<main>` pasa a
  `<div>`. En el formulario, el texto visible solo cambia porque el asterisco
  va en su propio `span` y «Cancelar» queda después de «Guardar».
- Lista, lista filtrada y lista a 376 px: sin el `<form>` y el campo oculto
  de cada fila, las tablas tienen los mismos registros (224, 54 y 224). Todos
  difieren solo en `y`, con un delta constante (+43,98 a 1281 px y −43,98 a
  376, por la barra de `FilterBar`), salvo los botones de fila, que solo pasan
  de `inline-flex` a `flex` (un hijo de un contenedor flexible se vuelve de
  bloque) con la misma variante y tamaño. Ninguna línea con texto visible
  cambia.
- Alertas a 1281 y 376 px: solo `<main>` → `<div>`, con el mismo texto.

Tareas, con los mismos pasos en las dos fases («PRUEBA E103 antes» y
«PRUEBA E103 despues»). Los tiempos van del clic al aviso y dependen de la
red y del servidor de staging: no miden rendimiento.

| Tarea | Antes (`41c35cd`) | Después (`7e50c8e`) |
|---|---|---|
| T13 Alta con un nombre que ya existe | Página completa con el foco inicial en `body`: mensaje rojo y además un toast de error; se borran todos los campos | Panel con el foco inicial en el nombre: el error queda en el panel, sin toast; se conserva lo escrito y el nombre recibe el foco (696 ms) |
| T13 Alta válida | `MAT00000012`; aviso a 1.625 ms y vuelta a la lista | `MAT00000013`; un aviso a 1.925 ms, el panel se cierra, la fila aparece primera y el foco vuelve a «Nuevo material» |
| T14 Edición del mínimo de 5 a 6 | Página completa, stock de solo lectura; 1.390 ms | Panel desde la fila, stock de solo lectura; Tab no sale del panel y Esc con cambios pide descartar; 1.681 ms y el foco vuelve a «Editar» de la fila |
| T15 Inactivar, activar e inactivar | Sin preguntar (1.351 y 1.237 ms) | Confirmación con la consecuencia; Esc no hace nada; inactivar a 1.131 ms con la fila en su lugar y el foco en su «Activar»; activar sin preguntar (828 ms) |
| T16 Atender la alerta del material | Sin preguntar (979 ms) | Confirmación con el botón normal y el texto aprobado; 799 ms y la fila pasa a «atendida» (hallazgo 13) |
| T17 Hallazgo 10: «Limpiar», Atrás y Adelante en auditoría y materiales | El selector seguía en el valor viejo tras «Limpiar» | «Limpiar» corregido; Atrás y Adelante un paso atrasados (hallazgo 12) |
| T18 Hallazgo 11: clic en «Cancelar» de la confirmación de descarte | Se reabría a los 10 ms (ventana) y 13 ms (panel) | Se cierra, conserva lo escrito y devuelve el foco, en la ventana y en el panel |

Además, en el «después»: la edición por URL directa se abre a página
completa y su «Cancelar» vuelve a la lista con el filtro de `returnTo`; desde
una lista filtrada, «Nuevo material» y «Editar» llevan ese filtro; a 376 px
el panel ocupa toda la pantalla (376 × 813) sin desbordamiento, y Esc sin
cambios lo cierra sin preguntar.

La regresión del «después» y su arreglo:

- Al repetir T17, «Limpiar» ya funcionaba, pero con Atrás y Adelante el
  selector quedaba un paso atrasado. Además, abrir el panel de materiales
  volvía a montar la barra y perdía lo elegido sin enviar (comprobado con la
  categoría «Herramienta»).
- `9f484d2`: la prueba nueva fallaba antes del arreglo en sus 3 casos, igual
  que en staging (`tmp/e10-diff/rojo-103-fix-filterbar.txt`), las mutaciones
  dan 4 de 4 (`mut_103_fix_filterbar.txt`), `npm run check` terminó en verde
  con 143 archivos y 2.289 pruebas, y el CSS compilado no cambia.
- Push: CI #86 en verde (2m 11s). Vercel `success` a las 02:27:10 UTC,
  `buildId` `rfS33EAqVmaxzvQQ-Zw6C` y el mismo CSS servido.
- Re-verificación el 2026-10-19, de 02:29 a 02:33 UTC, sin escribir datos
  (`tmp/e10-diff/reverificacion-fix-filterbar.json`, predicción en
  `plan-reverificacion-fix-filterbar.md`):
  - auditoría: «Limpiar» vacía la acción y las fechas, Atrás devuelve
    «crear» y las fechas, y Adelante las vacía; materiales: «Limpiar
    filtros» vacía el estado, Atrás devuelve «inactive» y Adelante lo vacía;
  - con «Herramienta» elegida sin filtrar, abrir y cerrar el panel conserva
    el mismo nodo y el valor;
  - la auditoría y la lista filtrada dan el mismo hash que en el «después».
    La lista completa cambia solo por los datos (hallazgo 14): 17 registros
    de la fila `MAT00000013`, 7 contenedores 52,81 px más altos, el texto
    «Mostrando 1 - 13 de 13» y 207 registros desplazados +52,81 en `y`; la
    barra y los otros 263 registros son idénticos.

El capítulo de Inventario del manual se cotejó con lo verificado: coincide.
Se precisó en las reglas comunes que «Cancelar» de la página completa vuelve
a la lista con sus filtros y que abrir y cerrar una ventana o un panel no
cambia lo elegido en la barra.

Se verificó solo con ADMIN: el responsable no pidió probar SELLER ni
WORKSHOP_MASTER. Datos escritos en staging: `MAT00000012` y `MAT00000013`
(inactivos), su kárdex inicial, sus alertas (atendidas) y en la bitácora el
alta, la edición y los tres cambios de estado de cada uno; atender no
escribe en la bitácora. Tiempos: el «antes», 65 minutos; el «después» con
sus tareas, 26; de la primera ejecución de la prueba roja al commit del
arreglo, 13; la re-verificación, 4.

Hallazgos de la verificación:

12. Regresión de la 10.3a (`53d9601`), corregida en `9f484d2`. La lista con
    otra búsqueda es el mismo segmento de página para Next 16.2.9: Atrás y
    Adelante confirman la URL con el contenido que ya se ve y piden al
    servidor el de la URL restaurada, y el panel de una ruta interceptada
    cambia la URL sin cambiar la lista. Con la URL como `key`, los campos se
    montaban con los valores viejos y ya no cambiaban al llegar los nuevos.
    Ahora la `key` es la consulta vigente cuando llegan campos nuevos del
    servidor. Las pruebas de C2 pintaban siempre la URL y los campos juntos.
13. Seguimiento: atender una alerta deja el foco en `body`, porque el botón
    desaparece de la fila y `ConfirmActionButton` no tiene a dónde
    devolverlo. Se propone llevarlo a la fila o al título de la tabla, en la
    10.3b o en la entrega 11. Corregido en `9490114` (10.3b): va a la fila
    o a la tabla.
14. Método: las capturas con datos del «después» se toman antes de sus
    tareas, así que una re-verificación posterior ve los datos de prueba.
    Se compara con un diff por registros que ignora la `y`.
15. Método: el `textHash` de la huella incluye los elementos sin texto, así
    que cambia con el número de elementos aunque el texto visible sea el
    mismo; se compara la secuencia de textos no vacíos. El «antes» a 376 px,
    tomado tras recargar, tenía un campo oculto más por fila que a 1281
    (probablemente los que React agrega al pintar en el servidor un `<form>`
    con acción de función); no cambia la conclusión.
16. Método: la sesión del ERP caducó entre turnos y la primera petición
    aterrizó en el `/login` de producción. No se midió allí; el responsable
    volvió a entrar por el de staging.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-19 y comparados con git:

- El cierre `512cbc4` se publicó en `staging`: CI #87 en verde (1m 50s), y
  Vercel lo desplegó (`success` a las 02:53:57 UTC).
- PR #25, abierto a las 02:57:00 UTC y fusionado con merge commit a las
  03:06:09 UTC del 2026-10-19: 14 commits, de `513c513` a `512cbc4`, y 43
  archivos (+7.094 −684). Su CI, el #88, sobre `512cbc4`, terminó en verde
  (2m 27s).
- El merge commit `13ea654` tiene como padres `9dc6dd9` (`main`) y `512cbc4`
  (`staging`), y su árbol es el de `512cbc4` (`a9557820`): `main` y `staging`
  tienen el mismo contenido. CI #89 en verde (3m 8s).
- Vercel desplegó `13ea654` en producción al primer intento (estado «Vercel»
  `pending` a las 03:06:12 UTC y `success` a las 03:07:43 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.3b — Proveedores y asociaciones proveedor-material

Fecha: del 2026-10-19 al 2026-10-20 (UTC). Estado: cerrada el 2026-10-21
(UTC). El paso 0 (`f4cbcba`) registró la integración de la 10.3a en `main`.
9 commits, de `25303e2` a `2c0e3b5`, el registro `b6f4480` y el cierre
`a49f41b` (CI #91 en verde). Integrada en `main` con el PR #26 (merge commit
`28d12a7`, CI #93 en verde).

| Commit | Tipo | Cambio |
|---|---|---|
| 25303e2 | test | Caracterización de las acciones de proveedores (39 casos, con el alta rápida desde repuestos) y de asociaciones (33). |
| 8ca9f73 | fix | Activar e inactivar proveedor y asociación fijan el estado pedido. |
| c446d03 | fix | Hallazgo 4 de la 10.3a: editar una asociación conserva su proveedor y su material aunque estén inactivos. |
| f4cbcba | docs | Paso 0: integración de la 10.3a en `main`. |
| 441170b | fix | Mensajes en español y con tildes en proveedores y asociaciones, también los de Zod. |
| 9490114 | fix | Hallazgo 13 de la 10.3a: `ConfirmActionButton` lleva el foco a su fila o a su tabla si el botón desaparece. |
| aa87e84 | feat | Proveedores en panel lateral con `FormActionState`; corrige la desviación de alta y edición. |
| bf5535e | feat | Inactivar proveedor pide confirmación; el listado usa `FilterBar` y pierde el `<main>` anidado. |
| df26c50 | feat | Asociaciones en panel lateral con `FormActionState`; corrige la desviación de alta y edición. |
| 2c0e3b5 | feat | Inactivar asociación pide confirmación; el listado usa `FilterBar` y pierde el `<main>` anidado. |
| b6f4480 | docs | Registro de la sub-entrega, `CLAUDE.md` e inventario. |
| a49f41b | docs | Cierre: publicación y verificación en staging, hallazgos y manual de Proveedores y Materiales de proveedor. |

Decisiones del responsable (2026-10-19), tras la auditoría:

- D1. La 10.3b se parte. Recalibrada con los tiempos de la 10.3a, la
  10.3b completa daba unas 9 horas: la programación se cumple (de C5 a C9
  de la 10.3a, 89 minutos frente a 110), pero la verificación con datos y su
  cierre tardaron 135 minutos frente a 60, el registro 71 frente a 30, y la
  auditoría agregó la caracterización y cuatro `fix`. La 10.3b lleva las dos
  entidades (unas 7,5 horas) y la 10.3c, los listados con fechas (entradas,
  salidas, compras y pagos con `FilterBar` y `DateRangeFields`) y el
  `<main>` de inicio, nueva salida, nueva compra y detalle de compra (unas
  2,5 horas).
- D2. Hallazgo 4: la edición acepta el proveedor y el material actuales
  aunque estén inactivos mientras no se cambien; uno nuevo debe estar
  activo, como en el alta. Los repuestos tienen el mismo defecto y van a la
  10.5.
- D3. Hallazgo 13 en esta sub-entrega y en `ConfirmActionButton`: inactivar
  con el filtro «Activo» también saca la fila, así que el arreglo en el
  componente compartido lo heredan las sub-entregas siguientes.
- D4. Los textos de las confirmaciones se aprobaron en sus commits (C7 y
  C9).
- D5. Las tildes de las asociaciones en un `fix` aparte, ampliado a los
  mensajes de Zod en inglés de los dos esquemas.

Auditoría:

- Ninguna acción de proveedores ni de asociaciones tenía pruebas.
- Bloqueo de fila: solo los dos cambios de estado leían, decidían y
  escribían (escribían `!estado`); se corrigen con el compare-and-set de la
  10.1, sin bloqueo. El alta y la edición no lo necesitan: la base garantiza
  la unicidad (`numero_documento` y `@@unique([id_proveedor, id_material])`)
  y la acción captura el P2002; validar el tipo, el proveedor o el material
  fuera de la transacción tiene una carrera inocua (sin clave foránea al
  tipo, y una asociación con un proveedor recién inactivado es como
  cualquier otra existente).
- Consecuencias de inactivar, comprobadas otra vez en las consultas: las de
  la 10.3a (sección «Para la 10.3b»). Un proveedor inactivo deja de
  ofrecerse en compras, repuestos y asociaciones nuevas y en el filtro del
  reporte de proveedores y compras, y sale de «Proveedores activos»; sus
  compras, pagos y asociaciones lo conservan. Ninguna otra pantalla lee
  `proveedor_material`.

Diseño:

- Proveedores y asociaciones, como Materiales:
  - `layout.tsx` con la ranura `@panel` (`default`, `page`, `(.)new` y
    `(.)[id]/edit`); cada panel autoriza y consulta como su página
    completa, que acepta `returnTo`.
  - Las acciones de alta, edición y cambio de estado devuelven un resultado
    y autorizan con `getAuthorizedSession`; ninguna redirige ya. El alta
    rápida de proveedor desde repuestos no cambia.
  - `SupplierForm` y `SupplierMaterialForm` usan `ActionForm`, `Field`,
    `SubmitButton` y `useFormResult`, sin el toast de error que daban.
  - `getSupplierEditValues` (`supplier-edit-values.ts`) y
    `supplier-material-form-data.ts` (las opciones, con la unidad del
    material, y los valores de edición) los comparten la página y el panel.
  - `SupplierStatusButton` y `SupplierMaterialStatusButton` sobre
    `ConfirmActionButton`; la lista de asociaciones conserva su «Limpiar»
    con `clearLabel`.
- `ConfirmActionButton` (hallazgo 13): si el botón ya no está, el foco va a
  su fila, con `tabindex="-1"` hasta que sale de ella, o a su tabla. Cubre
  los dos órdenes en que llega la lista nueva: con la confirmación abierta,
  por el `returnFocusTo` de `ConfirmDialog` (Radix devuelve el foco en un
  `setTimeout` al desmontarse), y después de cerrarla o sin confirmación, en
  la limpieza del `useLayoutEffect`, que corre antes de que React saque el
  botón del documento.
- La edición de una asociación busca el proveedor y el material que no
  cambian sin `estado: true`.

Evidencia:

1. Prueba roja antes de cada arreglo: `tmp/e10-diff/rojo-103b-c2.txt` (8
   de 8), `rojo-103b-c3.txt` (2 de 4; las 2 contrarias pasan antes y
   después), `rojo-103b-c4.txt` (24 de 26) y `rojo-103b-c5.txt` (4 de 14:
   los casos de foco en `body`, como en staging).
2. Caracterización antes de mover: 72 casos de acciones en `25303e2`, y los
   casos nuevos de las páginas con `returnTo` grabados con el código
   anterior (`tmp/e10-diff/c6b-pages-antes.snap` y `c8b-pages-antes.snap`).
3. Los cambios de snapshots se comprobaron con scripts contra copias
   previas (`verify_103b_c2.py`, `c3`, `c4`, `c6`, `c7`, `c8` y `c9`): las
   llamadas solo cambian donde el commit lo anuncia; en las listas el texto
   visible es el mismo palabra a palabra, y en los formularios solo cambia
   el orden de «Cancelar» en Proveedores y suman los asteriscos de
   obligatorio en Asociaciones.
4. Mutaciones (`tmp/e10-diff/mut_103b_c*.txt`): 20 de 21, 10 de 10, 5 de 5,
   11 de 11, 8 de 8, 17 de 17, 12 de 12, 18 de 18 y 13 de 13; en total, 114
   de 115, cada commit con su contraria. La superviviente de C1 es
   equivalente: Zod convierte el texto vacío en `undefined` antes de
   `toNullable`.
5. Pruebas con React real en jsdom: `confirm-action-button.test.ts` (9
   casos nuevos, con el Radix real), `supplier-form.test.ts` (10),
   `supplier-status-button.test.ts` (3), `supplier-material-form.test.ts`
   (10) y `supplier-material-status-button.test.ts` (3). Esquemas:
   `supplier.schema.test.ts` y `supplier-material.schema.test.ts`.
6. CSS compilado: igual en cada commit salvo C7, que quita solo la rejilla
   de la barra anterior de proveedores (113.131 → 112.980 bytes); el CSS
   anterior sin esa regla es el nuevo byte a byte. La primera versión de C5
   generaba la clase `blur` por el nombre de un evento; se cambió antes del
   commit.
7. `npm run check` terminó con código 0 después de cada commit, de 145 a
   151 archivos de prueba y de 2.361 a 2.451 pruebas. `npm run
   refactor:inventory` analiza 659 archivos: 140 páginas (12 en ranuras, 8
   que interceptan), 113 formularios JSX y 48 archivos de acciones.

Tiempo entre commits según sus horas (Lima). Incluye la preparación, la
revisión del responsable y sus pausas; C1 incluye la auditoría desde el
«aprobado»:

| Commit | C1 | C2 | C3 | Paso 0 | C4 | C5 | C6 | C7 | C8 | C9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Hora | 16:19 | 16:32 | 17:05 | 17:12 | 17:22 | 19:23 | 19:40 | 20:08 | 20:25 | 20:41 |
| Minutos desde el anterior | — | 13 | 33 | 7 | 10 | 121 | 17 | 28 | 17 | 16 |

Entre C4 y C5 hay 121 minutos con una pausa larga, así que C5 no calibra.
Los otros siete (C2, C3, C4 y de C6 a C9) suman 134 minutos frente a los
185 que el plan recalibrado estimó para ellos.

Hallazgos:

1. Los dos cambios de estado escribían el contrario de lo que leían.
   Corregido en `8ca9f73`.
2. Hallazgo 4 de la 10.3a, corregido para las asociaciones en `c446d03`;
   los repuestos, en la 10.5.
3. Los textos de las asociaciones no llevaban tildes y Zod respondía en
   inglés; en proveedores un usuario lo veía al escribir un campo más largo
   de lo permitido, porque el formulario no limita el largo. Corregido en
   `441170b`.
4. Hallazgo 13 de la 10.3a, corregido en `9490114`.
5. El alta rápida de proveedor desde repuestos busca la razón social
   repetida sin restricción de unicidad: dos altas a la vez podrían
   duplicarla. Va a la 10.5 o a la entrega 11.
6. La lista de asociaciones ordena por `fecha_actualizacion` y el cambio de
   estado la actualiza: la fila sube al principio. El foco la sigue, porque
   la fila tiene `key`. En staging no se pudo ver (hallazgo 13).
7. Método: en Vitest 4, `-u` toma el argumento siguiente como su valor:
   `npx vitest run -u archivo` corre toda la suite y no actualiza ese
   archivo. Va al final.
8. Método: en Git Bash, `grep -c $'\r$'` contaba CRLF en archivos que la
   copia de trabajo tiene en LF, y `write_text` de Python en Windows escribe
   CRLF. Los finales de línea se miden con Python y se escribe con
   `write_bytes`.
9. Método: el commit de C3 no llegó a git la primera vez; antes de cada paso
   se comprueba `git log`.
10. Método: la primera versión de los scripts que comparan snapshots no
    reconocía las exportaciones de una línea; se corrigió antes de usarlos
    como evidencia.

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e103b-huella`) y etiquetas `e103b/`, los
  ayudantes y el medidor de tareas (`tmp/e10-diff/e103b-*.js`, generados por
  `c-e103b-guiones.py` desde los de la 10.3a). Plan en
  `tmp/e10-diff/plan-verificacion-10-3b.md`.
- Comparador nuevo, `e103b-resumen.js` (`window.__resumen`): empareja los
  registros de dos capturas por etiqueta y texto propio (una LCS) y separa
  los quitados, los añadidos, los que solo se mueven (agrupados por delta) y
  los cambios de propiedad, y compara la secuencia de textos no vacíos. Lo
  piden las pantallas que pierden elementos en cada fila: comparar por
  índice desalinea todo lo que sigue.
- Clics y teclas reales. Las listas, que dependen de los datos, se tomaron
  en el «antes» después de sus tareas y en el «después» antes de las suyas.
- T20 a T26 escriben en staging, con autorización del responsable en cada
  fase; el proveedor y la asociación de prueba de cada fase terminan
  inactivos. T19, T23 y T27 solo leen.

Publicación y medición:

- «Antes» el 2026-10-20 sobre `512cbc4` (`buildId`
  `KzGU1eZ-Fwjlek6UAt55l`, CSS servido de 113.130 bytes, `e8dc6378…`). Las
  capturas de solo lectura se tomaron de 02:12 a 02:17 UTC; la app se
  reinició, el panel del navegador perdió el acceso a Vercel y el
  responsable volvió a entrar; las tareas se hicieron de 08:52 a 09:00 y
  las capturas se repitieron con los mismos hashes, junto con las listas,
  hasta las 09:03. 10 capturas y 5 controles, sello `12960ef7…`, igual en
  Python.
- Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-3b.md`),
  con el CSS predicho (`css-103b-predicho.css`).
- Push de 11 commits (de `25303e2` a `b6f4480`, con el paso 0): CI #90 en
  verde (3m 1s). Vercel desplegó `b6f4480` (`success` a las 09:17:36 UTC) y
  cambió el `buildId` (`n0IFsosqB5qYOLNn-K4hh`). El CSS servido es el
  predicho byte a byte (112.979 bytes, `f9a5f2e3…`): solo falta la rejilla
  de la barra anterior de proveedores.
- «Después» el 2026-10-20: capturas de 09:19 a 09:31 UTC (10 capturas, 5
  controles y los 8 paneles), sello `e6ed7a4f…`, igual en Python. El panel
  del navegador se cerró y la sesión del ERP caducó; el responsable volvió a
  entrar y las tareas se hicieron de 11:49 a 11:59. Evidencia en
  `tmp/e10-diff/antes-10-3b.json` y `despues-10-3b.json`.

Huella: las 10 cambian como se predijo, con dos imprecisiones de la
predicción (hallazgo 11), y los 5 controles (materiales, alertas, tipos de
proveedor, auditoría y la sección «Listados» de la galería) dan el mismo hash
que en el «antes»: el arreglo del foco de `ConfirmActionButton` no cambia el
DOM de otras pantallas.

- Listas de proveedores, completa y filtrada: `<main>` → `<div>`. La barra
  pasa de seis columnas desiguales a las cinco iguales de `FilterBar`, con
  las etiquetas de `Field` (`gap` 4 en lugar de 8) y «Filtrar» y «Limpiar
  filtros» en la misma celda. Cada fila pierde su `<form>` y sus dos campos
  ocultos (390 → 365 registros en la completa) y su botón pasa de
  `inline-flex` a `flex`. La tabla no se mueve (su contenedor sigue en
  y = 377,7) y la secuencia de textos visibles es idéntica. «Nuevo
  proveedor» y «Editar» llevan `returnTo` con el filtro.
- Listas de asociaciones: lo mismo, salvo la barra, que ya tenía su
  rejilla: «Filtrar» deja de estirarse (133,77 → 60,67 px) y «Limpiar» pasa
  de `outline` a la variante `clear` (el cian de «Limpiar filtros» de
  proveedores) y se coloca a su lado. Nada se desplaza.
- A 376 px, la barra de proveedores queda 44 px más baja (los dos botones
  en una fila, ya no a todo el ancho) y los 109 registros de debajo se
  desplazan −43,98 en `y` (−43,99 en 18, por redondeo). Sin desbordamiento.
- Formularios a página completa: contenedor con radio de 10 px en lugar de
  14 y sin sombra, asterisco en su propio `span`; en proveedores, separación
  de 16 px en lugar de 20 (el formulario queda 44 px más bajo) y «Cancelar»
  después de «Guardar». El encabezado no cambia y, con `returnTo`, la miga y
  «Cancelar» llevan el filtro.
- Paneles, solo en el «después»: a 1281 px, 576 px a la derecha con todo el
  alto; a 376 px, toda la pantalla (376 × 813) sin desbordamiento. Los 8 se
  cierran con Atrás y vuelven a su lista.

Tareas, con los mismos pasos en las dos fases («PRUEBA E103B antes» y
«PRUEBA E103B despues»). Los tiempos van del clic al aviso y dependen de la
red y del servidor de staging: no miden rendimiento.

| Tarea | Antes (`512cbc4`) | Después (`b6f4480`) |
|---|---|---|
| T19 Alta de proveedor con el RUC de otro | Página completa: el error en el campo y además un toast (975 ms); se vacían los campos y el foco queda en `body` | Panel con el foco inicial en la razón social: el error queda en el panel, en la alerta del formulario y en el campo, sin toast (812 ms); se conserva lo escrito y el foco va al número de documento. Esc con cambios pide descartar |
| T20 Alta válida | `PVE00000008`; aviso a 1.518 ms | `PVE00000009`; un aviso a 1.824 ms, el panel se cierra, la fila aparece en su lugar alfabético y el foco vuelve a «Nuevo proveedor» |
| T21 Edición: condición de pago «Contado» | Página completa; 1.394 ms | Panel desde la fila; Esc con cambios pide descartar y Esc en la pregunta vuelve al teléfono con lo escrito; Tab no sale del panel (18 pasos); 1.752 ms y el foco vuelve a «Editar» de su fila |
| T23 Asociación repetida | Mensaje sin tilde y toast (756 ms); se vacían los campos | En el panel, en el campo Material y con tilde, sin toast (878 ms); se conserva lo escrito |
| T24 Alta válida de asociación | `PVM00000005`; 1.231 ms | `PVM00000006`; un aviso a 1.767 ms y la fila aparece primera |
| T22 Inactivar y activar el proveedor | Sin preguntar (1.146 y 1.128 ms); desde `?status=active`, la redirección perdía el filtro | Confirmación con el texto aprobado; Esc no hace nada; inactivar a 985 ms con la fila en su lugar y el foco en su «Activar»; activar sin preguntar (830 ms). Con `?status=active` (1.116 ms), la fila sale, el filtro se conserva y el foco va a la tabla |
| T25 Hallazgo 4: editar la asociación con su proveedor inactivo | «El proveedor seleccionado no existe o esta inactivo.» (544 ms) | Guarda el precio 2; un aviso a 1.784 ms |
| T26 Inactivar, activar e inactivar la asociación | Sin preguntar (1.097, 846 y 1.081 ms) | Confirmación con el texto aprobado; 1.036, 901 y 1.131 ms, con el foco en el botón de su fila |
| T27 T17 de la 10.3a en la barra de proveedores | Tras «Limpiar filtros» el selector seguía en «inactive»; «Nuevo proveedor» abría una página completa y se perdía lo elegido | «Limpiar filtros» lo vacía, Atrás devuelve «inactive» y Adelante lo vacía; con «Activo» elegido sin filtrar, abrir y cerrar el panel conserva el mismo nodo y el valor |

Además, en el «después»: la edición por URL directa se abre a página
completa y su «Cancelar» vuelve a `?status=active`; Esc sin cambios cierra
el panel sin preguntar; el alta de asociación no ofrece el proveedor ni los
materiales inactivos, y la edición ofrece su proveedor inactivo. Las altas y
ediciones dieron el aviso entre 250 y 540 ms más tarde que en el «antes»
(salvo T25, que antes fallaba en la validación); con una medida por tarea no
se puede separar la variación de staging del cambio de la respuesta, que
trae la lista revalidada en lugar de redirigir. Los cambios de estado dieron
tiempos parecidos o menores.

El capítulo de Inventario del manual suma Proveedores y Materiales de
proveedor, escritos con lo verificado. Las reglas comunes nombran las
pantallas nuevas y explican que, con un filtro de estado, la fila que deja
de cumplirlo sale de la lista y el cursor pasa a la tabla.

Se verificó solo con ADMIN: el responsable no pidió probar SELLER ni
WORKSHOP_MASTER, ni la tarea opcional T28. Datos escritos en staging:
`PVE00000008` y `PVE00000009` (inactivos), `PVM00000005` y `PVM00000006`
(inactivas) y en la bitácora 9 líneas del «antes» y 10 del «después» (la
edición de T25 ahora escribe), comprobadas en `/dashboard/audit` sin
exportar; las dos cancelaciones con Esc no escribieron. Tiempos: el «antes»,
5 minutos de capturas antes del reinicio de la app y 11 después (tareas y
capturas); el «después», 11 de capturas y 10 de tareas.

Hallazgos de la verificación:

11. Predicción: no recogió la tilde de «Tiempo de entrega (días)» en los
    formularios de asociación (C4), y describió «Volver a…» como un enlace
    con el filtro en el `href`, cuando es el botón Atrás del encabezado con
    ese destino como `fallbackHref`. Lección: un `fix` de textos se anota en
    cada pantalla que los muestra, y el encabezado se lee en el código antes
    de predecir.
12. Propuesta para la entrega 11: con un dato repetido, el mismo mensaje
    sale dos veces, en la alerta del formulario y en el campo. Es el contrato
    de la pista B, igual en Clientes y Materiales. La alerta podría decir
    solo que hay campos que revisar cuando todos los errores son de campo;
    decide el responsable.
13. T26 no pudo ver la fila subir al principio: la asociación de prueba ya
    era la primera porque T25 la acababa de actualizar. Lo cubren las
    pruebas en jsdom (hallazgo 6).
14. Método: durante las tareas, la página del panel estaba oculta para el
    navegador (`visibilityState` `hidden`, ningún fotograma en 4 s) porque
    la ventana de la app no se pintaba. Las animaciones de cierre de 200 ms
    tardaban unos 1.078 ms en desmontar y el foco volvía después. Los
    resultados valen; los tiempos de animación, no. Antes de medir una
    animación se comprueba `document.visibilityState` y se pide al
    responsable que deje la ventana a la vista.
15. Método: como en la 10.3a (hallazgo 16), la sesión del ERP caducó entre
    turnos, esta vez al reabrirse el panel del navegador, y la primera
    petición aterrizó en el `/login` de producción. No se tocó nada allí;
    los guiones y la base del navegador se conservaron.
16. En T19 de las dos fases, el navegador avisó que la página escribió en
    el portapapeles durante un clic sintético. `src` no usa el portapapeles:
    viene de fuera de la app, probablemente de la barra de Vercel de las
    vistas previas. No afecta a las medidas.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-21 y comparados con git:

- El cierre `a49f41b` se publicó en `staging`: CI #91 en verde (3m 16s), y
  Vercel lo desplegó (`success` a las 01:13:19 UTC del 2026-10-21).
- PR #26, abierto a las 01:26:34 UTC y fusionado con merge commit a las
  01:36:31 UTC del 2026-10-21: 12 commits, de `25303e2` a `a49f41b`, y 48
  archivos (+10.367 −963). Su CI, el #92, sobre `a49f41b`, terminó en verde
  (3m 4s).
- El merge commit `28d12a7` tiene como padres `13ea654` (`main`) y `a49f41b`
  (`staging`), y su árbol es el de `a49f41b` (`4a43a03c`): `main` y `staging`
  tienen el mismo contenido. CI #93 en verde (3m 6s).
- Vercel desplegó `28d12a7` en producción al primer intento (estado «Vercel»
  `pending` a las 01:36:34 UTC y `success` a las 01:37:40 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.3c — Listados con fechas e inicio de Inventario

Fecha: 2026-10-21 (UTC). Estado: cerrada el 2026-10-24 (UTC). El paso 0
(`2d9ca08`) registró la integración de la 10.3b en `main`. 6 commits, de
`c148d33` a `3272901`, el registro `7ea09c3` y el cierre `9c708a1` (CI #95
en verde). Integrada en `main` con el PR #27 (merge commit `cb43290`, CI
#97 en verde).

| Commit | Tipo | Cambio |
|---|---|---|
| 2d9ca08 | docs | Paso 0: integración de la 10.3b en `main`. |
| c148d33 | test | Caracterización de entradas, salidas, compras y pagos con un rango invertido y con fechas que no existen, una compra anulable en la lista y en el detalle, y el maestro de taller en el inicio y en entradas. |
| 12975d0 | fix | Hallazgo 6 de la 10.3a: el rango de fechas de los listados incluye todo el último día. |
| 9945158 | feat | Entradas y salidas con `FilterBar` y `DateRangeFields`; registrar salida sin `<main>` anidado. |
| c8553d8 | feat | Compras y pagos a proveedor con `FilterBar` y `DateRangeFields`; nueva compra y el detalle de compra sin `<main>` anidado. |
| 075bb00 | fix | El inicio de Inventario y las entradas solo enlazan lo que el rol puede abrir. |
| 3272901 | feat | El inicio enlaza entradas, salidas y pagos a proveedores, ordenado por flujo, y pierde el `<main>` anidado. |
| 7ea09c3 | docs | Registro de la sub-entrega, `CLAUDE.md` e inventario. |
| 9c708a1 | docs | Cierre: publicación y verificación en staging, hallazgos y manual de las listas de Inventario y de su inicio. |

Decisiones del responsable (2026-10-21), tras la auditoría:

- D1. El hallazgo 6 se corrige aquí, en `buildDateRangeFilter`, y lo heredan
  los 13 listados que la usan, como `FilterBar` en la 10.3a. La zona horaria
  de Lima, las 4 copias locales y la fecha que no existe quedan registradas
  (hallazgos 2 a 4).
- D2. Con un rango invertido, la lista lo marca con `DateRangeFields`, que no
  deja enviar la barra, y si el rango llega en la URL consulta igual y sale
  vacía: las listas no tienen indicadores ni exportación que salgan mal, a
  diferencia de los reportes de la 10.2.
- D3. El inicio de Inventario muestra a cada rol solo lo que puede abrir y
  enlaza entradas, salidas y pagos (C5 y C6). Los textos, iconos y tonos de
  las tres tarjetas nuevas y el orden por flujo se aprobaron en C6.
- D4. La 10.3c no se parte: recalibrada con los tiempos de la 10.3b, sumaba
  unas 4,5 horas, lejos del umbral de 7 u 8.

Auditoría (sobre `a49f41b`):

- Alcance: 8 páginas. Las cuatro listas, con sus roles, barras y
  parámetros:
  - Entradas (`/dashboard/inventory/entries`, ADMIN y WORKSHOP_MASTER):
    Buscar, Material, Proveedor, Compra, Desde y Hasta; `q`, `material`,
    `supplier`, `purchase`, `from`, `to`, `page` y `pageSize`.
  - Salidas (`/outputs`, ADMIN y WORKSHOP_MASTER): Buscar, Material, Orden,
    Desde y Hasta; `q`, `material`, `order`, `from`, `to`, `page` y
    `pageSize`.
  - Compras (`/purchases`, ADMIN): Buscar, Proveedor, Material, Estado
    compra, Estado pago, Desde y Hasta; `q`, `supplier`, `material`,
    `status`, `payment`, `from`, `to`, `page` y `pageSize`.
  - Pagos a proveedores (`/supplier-payments`, ADMIN): Buscar, Proveedor,
    Compra, Método, Estado, Desde y Hasta; `q`, `supplier`, `purchase`,
    `method`, `status`, `from` y `to`, sin paginar.

  Además pierden el `<main>` anidado el inicio, registrar salida, nueva
  compra y el detalle de compra.
- Ninguna acción entra en la pista B: anular compra, registrar un pago,
  nueva compra y registrar salida son de la entrega 11.
- Hallazgo 6, demostrado con Postgres real (PGlite, las 20 migraciones y las
  consultas reales; `tmp/e10-diff/e103c-demo/`):
  - En UTC, como en Vercel, entradas y salidas (`timestamptz`) perdían los
    movimientos de las 23:59:59.9994 y las 23:59:59.999999 del último día;
    compras y pagos (`date`) daban lo mismo con `lte` y con `lt`.
  - En la zona de Lima, como en desarrollo, compras y pagos incluían el día
    siguiente.
  - `buildDateRangeFilter` la usan 13 listados; filtran una columna
    `timestamptz` los de movimientos de inventario y las planillas.
- Con un rango invertido, las cuatro listas consultaban y decían «Todavía no
  hay … registradas», y la barra lo dejaba enviar. Con una fecha que no
  existe, `parseDateParam` pasaba el 30 de febrero al 2 de marzo (el campo se
  veía vacío y la lista filtraba) e ignoraba el día 32 o `2026-7-5`.
- Ninguna pantalla enlazaba entradas, salidas ni pagos a proveedores desde
  que se crearon (`40dc983`): solo se llegaba con la URL.
- El maestro de taller veía en el inicio Proveedores, Proveedor-material y
  Compras, y «Ver compra» en las entradas: esas páginas solo admiten ADMIN y
  lo llevaban a «acceso denegado».
- Los datos generados de la caracterización nunca pintaban «Anular» en la
  lista de compras ni «Anular compra» y «Registrar pago» en el detalle: dan
  dos pagos a cada compra.

Diseño:

- `buildDateRangeFilter` corta con `lt` el inicio del día siguiente (copia la
  fecha y le suma un día con `setDate`), en la zona del proceso como antes: la
  regla de `buildReportDateRange` en los reportes.
- Las cuatro barras usan `FilterBar` («Filtros de entradas», «… de salidas»,
  «… de compras» y «… de pagos a proveedores»), `Field` con el `id` igual al
  `name` y `DateRangeFields` con `id="fecha"`, con los mismos nombres de la
  URL, etiquetas y opciones. «Limpiar filtros» de pagos pasa de `outline` a
  `clear`, como en las demás listas.
- Enlaces por rol: cada tarjeta del inicio declara los roles que admite su
  pantalla (`ADMIN_ONLY` o `ADMIN_AND_WORKSHOP`) y se filtra por el de la
  sesión; «Ver compra» solo aparece con `canOpenPurchases` (ADMIN). No se
  usó la tabla `dashboardRoutes` del guardia de rutas: el guardia no registra
  el rechazo, como sí hace `requireRole`, y en staging redirige al host de
  `AUTH_URL`, como el login (entrega 4). `inventory-links.test.ts` abre cada
  enlace de Inventario del inicio y de las entradas con el mismo rol, y falla
  si su pantalla lo rechaza o si no figura en su tabla.
- El inicio, ordenado por flujo: Materiales, Entradas, Salidas y Alertas;
  después Proveedores, Proveedor-material, Compras y Pagos a proveedores. El
  maestro de taller ve las cuatro primeras.

Evidencia:

1. Prueba roja antes de cada arreglo: `tmp/e10-diff/rojo-103c-c2.txt` (6 de
   9; las otras 3 pasan antes y después) y `rojo-103c-c5.txt` (los dos casos
   del maestro de taller).
2. Caracterización antes de cambiar: 12 casos nuevos (24 entradas de
   snapshot) en `c148d33`, sin cambiar las existentes
   (`verify_103c_c1.py`). El rango invertido deja la lista vacía, como la
   devuelve la base: los datos generados darían filas.
3. Los cambios de snapshots se comprobaron con scripts contra copias
   previas:
   - `verify_103c_c2.py`: de los 84 snapshots cambian 13, en 27 líneas, todas
     `lte …T23:59:59.999Z` por `lt` con el día siguiente a las 00:00.
   - `verify_103c_lists.py` (C3 y C4): las llamadas y el HTML fuera de la
     barra son idénticos; dentro, las mismas etiquetas, campos, opciones y
     botones. Solo cambian, como se esperaba, las fechas que no existen (que
     empiezan vacías), el error de «Hasta» con el rango invertido y la
     variante de «Limpiar filtros» en pagos. Se comprobó que el script falla
     con una etiqueta equivocada.
   - C5 y C6 solo cambian los snapshots del inicio y, en C5, el de las
     entradas del maestro de taller; fuera de las tarjetas, el HTML es
     idéntico.
4. Mutaciones (`tmp/e10-diff/mut_103c_c*.txt`): 13 de 13, 7 de 8, 13 de 13,
   13 de 13, 7 de 7 y 7 de 7; en total, 60 de 61, cada commit con su
   contraria. La superviviente de C2 es equivalente: `setUTCDate` da el mismo
   día siguiente en UTC y en Lima, que no tienen horario de verano.
5. PGlite antes y después del arreglo (`e103c-demo/antes-*.json` y
   `despues-*.json`): en los 6 casos la lista real coincide con la regla
   `lt`.
6. CSS compilado igual en cada commit (112.980 bytes, `6b601998…`): las
   clases de las barras anteriores siguen teniendo consumidores.
7. `npm run check` terminó con código 0 después de cada commit, de 151 a 152
   archivos de prueba y de 2.451 a 2.476 pruebas. `npm run
   refactor:inventory` analiza 660 archivos: 140 páginas, 109 formularios JSX
   (eran 113) y 48 archivos de acciones.

Tiempo entre commits según sus horas (Lima, 2026-10-20). Incluye la
preparación, la revisión del responsable y sus pausas; el paso 0 incluye el
plan desde el «aprobado»:

| Commit | Paso 0 | C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|---|---|
| Hora | 21:32 | 22:02 | 22:14 | 22:26 | 22:38 | 23:03 | 23:26 |
| Minutos desde el anterior | — | 30 | 12 | 12 | 12 | 25 | 23 |

De C1 a C6, 114 minutos frente a los 145 estimados (unos 105 con el factor
0,72 de la 10.3b). C6 incluye la aprobación de los textos de las tarjetas.

Hallazgos:

1. Hallazgo 6 de la 10.3a, corregido en `12975d0` para los 13 listados que
   usan `buildDateRangeFilter`.
2. Quedan 4 copias locales que cortan el último día con `lte` a las
   `T23:59:59`, sin milisegundos: cuellos de botella, campañas y órdenes de
   trabajo (Producción, 10.6) y movimientos de caja. Se reemplazan por la
   función compartida en su sub-entrega.
3. Regla de negocio pendiente: los filtros usan el día de la zona del
   servidor, que en Vercel es UTC. Un movimiento de las 20:00 de Lima cuenta
   como del día siguiente, y las listas de entradas y salidas lo muestran con
   esa fecha (`formatDate` sobre un instante; la convención pide
   `formatDateTime`). Los reportes usan la misma hora, así que pasar a los
   días de Lima es transversal: un grupo de `fix` propio o la entrega 11, con
   la decisión del responsable.
4. Una fecha que no existe en la URL (`2026-02-30`) se ve vacía en
   `DateRangeFields`, pero `parseDateParam` filtra desde el 2 de marzo; el día
   32 y `2026-7-5` se ignoran. Solo llega con una URL escrita a mano; se
   resuelve junto con el punto 3.
5. Pagos a proveedores carga todos los pagos, sin paginar. Entrega 11.
6. «Todavía no hay … registradas» aparece también cuando un filtro no
   encuentra nada, en varias áreas (Clientes dice «No se encontraron clientes
   con los filtros aplicados»). Propuesta de texto para la entrega 11.
7. Método: la prueba de enlaces superó los 5 segundos de Vitest con la suite
   completa por importar en frío seis páginas; `preloadPages` las importa en
   un `beforeAll`, como hace `definePageSuite`.
8. Método: `purchases/new/page.tsx` mezcla LF y CRLF y el detalle de compra
   es CRLF; se editaron por bytes, sin tocar los finales de línea
   (`tmp/e10-diff/c4-103c-main.py`).

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e103c-huella`) y etiquetas `e103c/`
  (`tmp/e10-diff/e103c-*.js`, generados por `c-e103c-guiones.py` desde los de
  la 10.3b), guardada en el `localStorage` de staging y recargada en cada
  documento. Plan en `tmp/e10-diff/plan-verificacion-10-3c.md`.
- Ninguna tarea escribe datos: las listas son las mismas en las dos fases.
  El rango de las capturas y las tareas es julio de 2026: 15 entradas, 1
  salida, 5 compras y 1 pago.
- Teclas reales en las fechas, con el foco puesto con `focus()` (en T29 del
  «antes», con un clic en el día), y botones pulsados por su referencia de
  accesibilidad: el panel del navegador era más
  estrecho que la emulación de 1281 px y las capturas de pantalla no servían
  para apuntar.
- 1281 × 800 y el preset móvil (376 px), con el puntero en el margen del
  shell; la barra lateral se expande al pasar por encima, así que el puntero
  no se acerca a ella.

Publicación y medición:

- «Antes» el 2026-10-21, de 20:26 a 20:37 UTC, sobre `a49f41b` (`buildId`
  `Zg8lJ1dGECoVlNtxdnaID`, CSS servido de 112.979 bytes, `f9a5f2e3…`): 16
  capturas y 5 controles, sello `5668ccd5…`, igual en Python.
- Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-3c.md`).
- Push de 8 commits (de `2d9ca08` a `7ea09c3`): CI #94 en verde (3m 7s).
  Vercel desplegó `7ea09c3` (`pending` a las 20:40:09 y `success` a las
  20:42:02 UTC) y cambió el `buildId` (`SmOLZpQDrlir0Wb_vTqWn`). El CSS
  servido es el predicho byte a byte, el mismo del «antes».
- El panel del navegador se cerró después del push y perdió el acceso a
  Vercel, el `localStorage` y la base del navegador de staging; el
  responsable volvió a entrar. Los hashes del «antes» estaban en
  `tmp/e10-diff/registro-10-3c.tsv`, no los registros de cada elemento
  (hallazgo 10).
- «Después» el 2026-10-21, de 21:45 a 21:56 UTC: 16 capturas y 5 controles,
  sello `46ae70d1…`, igual en Python. La huella se reinstaló con el mismo
  código, y el control de materiales dio el hash del «antes» antes de seguir.
  Evidencia en `tmp/e10-diff/antes-10-3c.json` y `despues-10-3c.json`.

Huella: las 21 como se predijo.

- Los 5 controles (materiales, proveedores, auditoría, la sección
  «Listados» de la galería y pedidos con un rango) dan el mismo hash. En
  pedidos, la consulta corta ahora con `lt`, pero la columna es `date`: las
  mismas filas y el mismo HTML.
- Registrar salida, nueva compra y el detalle de compra solo cambian la raíz:
  con `main` en lugar de `div` en el registro de la raíz del «después», el
  hash es exactamente el del «antes». El `textHash` y el número de elementos
  no cambian.
- Las cuatro listas a 1281 px:
  - la barra es un formulario de búsqueda con su nombre («Filtros de
    entradas», «… de salidas», «… de compras» y «… de pagos a
    proveedores»), las filas de campos predichas y el rango en un
    `fieldset` (dos elementos más; uno más en compras y pagos, que pierden
    la rejilla que agrupaba las fechas);
  - en entradas, la quinta columna de `auto-fit` queda vacía y se colapsa:
    los cuatro campos ocupan 264 px cada uno, y la predicción decía cinco
    columnas;
  - las tablas tienen las mismas filas; en compras siguen las seis «Anular»;
  - en pagos, «Limpiar filtros» pasa a la variante `clear` (fondo cian);
  - con el rango invertido, «Hasta» queda con `aria-invalid`, el borde
    destructivo y el mensaje en dos líneas: la barra crece 48 px y la tabla,
    que sigue diciendo «Todavía no hay entradas registradas.», baja con
    ella.
  - Pagos sin filtro y con el rango dan el mismo hash en las dos fases: la
    misma fila, y la huella no registra el valor de los campos.
- A 376 px, la barra tiene una columna, Desde y Hasta van uno debajo del
  otro y no hay desbordamiento.
- El inicio pasa de 5 a 8 tarjetas en el orden por flujo; los 35 elementos
  nuevos son los de las tres tarjetas (12, 12 y 11).

Tareas (ADMIN), con los mismos pasos en las dos fases. Los tiempos dependen
de la red y del servidor de staging:

| Tarea | Antes (`a49f41b`) | Después (`7ea09c3`) |
|---|---|---|
| T29 Filtrar entradas por julio | GET nativo con documento nuevo; 15 filas (DOMContentLoaded a 961 ms) | Igual: la misma URL y 15 filas (739 ms) |
| T30 Rango invertido escrito en compras | Se envía y la lista dice «Todavía no hay compras registradas.» | «Hasta» muestra el mensaje en cuanto el rango queda invertido; «Filtrar» no envía (evento `invalid`), el foco va a «Hasta» y la lista no cambia |
| T31 Por URL | Invertido: sin aviso y lista vacía. `2026-02-30`: el campo se ve vacío (el HTML trae ese valor) y 23 entradas | Invertido: «Hasta» con el error y lista vacía. `2026-02-30`: vacío también en el HTML y 23 entradas (hallazgo 4) |
| T32 Salidas de julio: otra fecha en Desde sin filtrar, «Limpiar filtros», Atrás y Adelante | Desde se quedaba en lo escrito en los tres pasos (en Atrás, la URL decía 01/07 y el campo 05/07) | Vacío, 01/07 y 31/07, vacío; el foco se queda en «Limpiar filtros» |
| T33 Detalle desde una lista filtrada y volver | Compras: «Volver a compras» y la miga llevan el filtro. Entradas: «Ver compra» sin `returnTo`, Atrás vuelve con el filtro | Igual |
| T34 Registrar salida desde salidas filtradas y volver sin guardar | «Volver a salidas» (sin `referrer` interno, hallazgo 11) y «Cancelar» pierden el filtro | Igual (el formulario es de la entrega 11) |
| T35 Inicio de Inventario | 5 tarjetas | 8 tarjetas en el orden por flujo |

El hallazgo 6 (las 23:59:59.999xxx) no se puede ver en staging sin escribir
un movimiento a esa hora: su evidencia es la de PGlite. Se verificó solo con
ADMIN: el responsable no pidió probar WORKSHOP_MASTER, porque
`inventory-links.test.ts` y los snapshots cubren lo que ve. El «antes» llevó
11 minutos de medición y el «después» 11, sin contar la preparación ni las
esperas.

Hallazgos de la verificación:

9. Lo que se escribe en las fechas antes de que React hidrate la página se
   pierde: `DateRangeFields` es un campo controlado y la hidratación impone
   su estado inicial. En T30 las teclas llegaron antes del `replace` con que
   Next termina de hidratar y los dos campos quedaron vacíos; con la página
   hidratada, funcionó. Los campos sueltos del «antes» conservaban lo
   escrito. Afecta a todas las pantallas con `DateRangeFields`, también a los
   reportes de la 10.2. El responsable decidió registrarlo para un `fix`
   aparte o la entrega 11.
10. Método: al cerrarse, el panel del navegador perdió el acceso a Vercel, el
    `localStorage` y la base del navegador de staging. La evidencia en `tmp`
    eran los hashes, no los registros de cada elemento, así que las
    diferencias de las listas se explicaron con la estructura del «después»
    y no con un diff por registros. Para la próxima: guardar también los
    registros en `tmp`.
11. Método: «Volver a…» del encabezado usa `router.back()` solo si el
    documento tiene un `referrer` interno; las páginas cargadas desde la
    herramienta no lo tienen y usan su destino fijo.
12. Predicción: dijo cinco columnas en la barra de entradas a 1281 px; con
    `auto-fit`, la columna vacía se colapsa y quedan cuatro más anchas.

El capítulo de Inventario del manual suma el inicio, Entradas, Salidas,
Compras y Pagos a proveedores, escritos con lo verificado, y las reglas
comunes explican el rango que llega invertido en la dirección y que el
inicio solo muestra lo que cada rol puede abrir.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-24 y comparados con git:

- El cierre `9c708a1` se publicó en `staging`: CI #95 en verde (3m 10s), y
  Vercel lo desplegó (`success` a las 01:32:12 UTC del 2026-10-24).
- PR #27, abierto a las 01:36:51 UTC y fusionado con merge commit a las
  01:40:06 UTC del 2026-10-24: 9 commits, de `2d9ca08` a `9c708a1`, y 35
  archivos (+4.023 −644). Su CI, el #96, sobre `9c708a1`, terminó en verde
  (2m 54s).
- El merge commit `cb43290` tiene como padres `28d12a7` (`main`) y `9c708a1`
  (`staging`), y su árbol es el de `9c708a1` (`fc172155`): `main` y `staging`
  tienen el mismo contenido. CI #97 en verde (3m 7s).
- Vercel desplegó `cb43290` en producción al primer intento (estado «Vercel»
  `pending` a las 01:40:10 UTC y `success` a las 01:41:18 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.4a — Productos, estados e inicio de Comercial

Fecha: del 2026-10-23 al 2026-10-26 (Lima). Estado: cerrada el 2026-10-26
(Lima). El paso 0 (`c5301c6`) registró la integración de la 10.3c en
`main`. 8 commits, de `f817b90` a `5b28b1e`, el registro `6ee389c` y el
cierre `fd08d33` (CI #99 en verde). Integrada en `main` con el PR #28
(merge commit `3545faf`, CI #101 en verde).

| Commit | Tipo | Cambio |
|---|---|---|
| c5301c6 | docs | Paso 0: integración de la 10.3c en `main`. |
| f817b90 | test | Caracterización del cambio de estado de clientes; del alta, la edición y el cambio de estado de productos; del cambio de estado de categorías de producto, y de 5 casos de página que los datos generados no pintaban. |
| c8a5a9d | fix | Activar e inactivar cliente, producto y categoría fijan el estado pedido. |
| 404a761 | fix | Editar un producto conserva su categoría aunque esté inactiva. |
| 6c8dc59 | fix | Mensajes en español en los esquemas de clientes, productos y categorías. |
| 3a86b25 | feat | Productos en panel lateral con `FormActionState`; corrige la desviación del alta y la edición. |
| 3e8f328 | feat | Inactivar producto pide confirmación; el listado usa `FilterBar` y pierde el `<main>` anidado. |
| bee5b97 | feat | Inactivar cliente y categoría de producto pide confirmación. |
| 5b28b1e | feat | El inicio de Comercial enlaza pagos de cliente y comprobantes de venta y pierde el `<main>` anidado. |
| 6ee389c | docs | Registro de la sub-entrega, `CLAUDE.md` e inventario. |
| fd08d33 | docs | Cierre: publicación y verificación en staging, hallazgos y manual de Comercial. |

Decisiones del responsable (2026-10-23), tras la auditoría:

- D1. La 10.4 se parte en tres: 10.4a (productos, estados e inicio), 10.4b
  (listados con fechas y `Badge`) y 10.4c (pedidos, la superficie amplia).
  Recalibrada, sumaba unas 16 horas frente a las 5 del plan. Los listados
  van antes que pedidos para que el piloto se verifique con la lista final.
- D2. Los importes del pedido se corrigen en la 10.4c con la regla de
  redondeo de la base, en una función pura que comparten la vista previa y
  la acción (hallazgo 6).
- D3. La edición conserva el cliente, los productos y la categoría actuales
  aunque estén inactivos; uno nuevo debe estar activo, también en el alta de
  pedido. La categoría se corrige aquí; el pedido, en la 10.4c.
- D4. El descarte de la superficie amplia es «Cancelar» y el aviso al
  recargar. Bloquear también los enlaces del shell con `onNavigate` se
  decide antes de la entrega 11.
- D5. El inicio de Comercial tiene seis tarjetas en el orden del flujo de
  venta.
- D6. Comercial adopta `Badge` con el mapeo de la galería, sacado de
  `StatusBadge`, que Mantenimiento y Mermas siguen usando hasta la 10.5 y la
  10.7 (10.4b).
- D7. El hallazgo 9 de la 10.3c (lo que se teclea en `DateRangeFields`
  antes de hidratar) se corrige al empezar la 10.4b, antes de sumar cuatro
  listas más.
- Tras C1, el mensaje de Zod en inglés va en un `fix` propio después de C3
  y abarca los tres esquemas de Comercial con formulario en la 10.4a
  (cliente, producto y categoría); el de pedidos va con su formulario en la
  10.4c.
- Los textos de las tres confirmaciones (C5 y C6) y de las dos tarjetas
  nuevas (C7) se aprobaron en su commit.

Auditoría (sobre `9c708a1`):

- La 10.4 abarca 13 páginas de Comercial con `<main>` anidado. Todas admiten
  ADMIN y SELLER, salvo el alta y la edición de producto (solo ADMIN); el
  maestro de taller no entra a Comercial. En la 10.4a: el inicio, la lista
  de productos (`q`, `category`, `unit`, `status`, `page` y `pageSize`), su
  alta y su edición, y los cambios de estado de las listas de productos,
  clientes y categorías de producto.
- Las acciones de productos y los cambios de estado de clientes y
  categorías no tenían pruebas. Los tres cambios de estado leían el estado y
  escribían el contrario, sin confirmar, y volvían a la lista sin sus
  filtros. El de clientes lo pueden usar ADMIN y SELLER; los otros dos, solo
  ADMIN.
- La edición de un producto ofrecía su categoría actual aunque estuviera
  inactiva, pero la acción la rechazaba: el mismo patrón que el hallazgo 4
  de la 10.3a.
- Pagos de cliente y Comprobantes de venta solo se enlazaban desde el inicio
  de Reportes, que es solo de ADMIN: el vendedor podía abrirlas y no llegaba
  a ellas desde ninguna pantalla. Ningún rol veía enlaces que lo rechazaran.
- Para la 10.4c, la auditoría también encontró los hallazgos 5 a 10.

Diseño:

- Productos como Proveedores: `products/layout.tsx` con la ranura `@panel`,
  `(.)new` y `(.)[id]/edit` sobre `RouteSheet`; `product-edit-values.ts`
  comparte los valores de la edición entre la página y el panel; las
  acciones devuelven `FormActionState` y autorizan con
  `getAuthorizedSession(["ADMIN"])`; la página pasa el aviso con su clave
  literal y la lista lleva el `returnTo` a «Nuevo producto» y «Editar».
- Los tres cambios de estado reciben el estado pedido y lo fijan con un
  `updateMany` que lleva el contrario en el `where`; devuelven
  `StatusToggleState` a un botón por entidad sobre `ConfirmActionButton`
  (`ProductStatusButton`, `ClientStatusButton`,
  `ProductCategoryStatusButton`). Inactivar confirma con la consecuencia
  comprobada en las consultas:
  - producto: deja de ofrecerse en pedidos, rutas de fabricación, recetas
    técnicas nuevas, campañas y órdenes de trabajo, y en los filtros de
    producto de Producción y de su reporte; no cuenta en Productos activos;
  - cliente: deja de ofrecerse al registrar pedidos o cambiar el cliente de
    uno y en el filtro de clientes del reporte de ventas y cobranzas; no
    cuenta en Clientes activos;
  - categoría: deja de ofrecerse al registrar productos o cambiar la
    categoría de uno; los productos que ya la usan la conservan.

  Activar se ejecuta al pulsar. Los botones de categoría conservan su
  variante `outline` pequeña.
- La validación de la categoría recibe la actual del producto: la acepta
  aunque esté inactiva mientras no se cambie, y rechaza una que no existe.
- Cada límite de largo, lista y campo obligatorio de los tres esquemas tiene
  su mensaje. El tipo de documento del cliente pasa a
  `z.union([...], { error })`: con `.or(...)` Zod responde «Invalid input» y
  no el mensaje de la rama (sonda `tmp/e10-diff/zod-probe.mjs`).
- El inicio suma «Pagos de cliente» y «Comprobantes de venta»: clientes,
  productos, pedidos, proformas, pagos y comprobantes. Pierde también el
  comentario de un borrador antiguo. `commercial-links.test.ts`, como
  `inventory-links.test.ts`, abre con ADMIN y con SELLER cada enlace de
  Comercial del inicio, las listas y los detalles de pedido y proforma, y
  exige una tarjeta para cada lista del área.

Evidencia:

1. Prueba roja antes de cada arreglo: `tmp/e10-diff/rojo-104a-c2.txt` (12),
   `rojo-104a-c3.txt` (1; sus 2 contrarias pasan antes y después),
   `rojo-104a-c3b.txt` (11 de 14) y `rojo-104a-c7.txt` (la tarjeta de cada
   lista, con los dos roles).
2. Caracterización antes de cambiar: 41 casos de acciones y 5 de página en
   `f817b90`, sin cambiar los 92 snapshots existentes.
3. Los cambios de snapshots se comprobaron con scripts contra copias
   previas (`verify_104a_c2.py`, `verify_104a_c4.py`, `verify_104a_c5.py` y
   `verify_104a_c6.py`):
   - las llamadas de las acciones solo cambian la autorización y, en los
     cambios de estado, la lectura del nombre cuando no cambia ninguna fila;
   - las de las páginas no cambian;
   - el formulario de producto solo cambia por el patrón de `Field`,
     comparado etiqueta por etiqueta y atributo por atributo;
   - las listas conservan su texto visible y sus controles, salvo los campos
     ocultos de cada fila y el guion de React que reenvía formularios con
     acción de función.

   Los de C4 a C6 se probaron en negativo: fallan con una etiqueta, un
   atributo, un texto, una opción o un mensaje cambiados.
4. Mutaciones (`tmp/e10-diff/mut_104a_c*.txt`): 19 de 19, 13 de 13, 6 de 6,
   11 de 11, 19 de 19, 12 de 12, 16 de 16 y 6 de 6; en total, 102 de 102,
   con las contrarias de C2 y C3.
5. CSS compilado igual en cada commit (112.980 bytes) salvo C5, que solo
   quita la rejilla de la barra vieja de productos (112.829 bytes): el
   anterior sin esa regla es idéntico byte a byte (`css_104a_c5.py`).
6. `npm run check` terminó con código 0 después de cada commit, de 152 a 160
   archivos de prueba y de 2.476 a 2.603 pruebas. `npm run
   refactor:inventory` analiza 677 archivos: 143 páginas (15 en ranuras, 10
   que interceptan), 106 formularios JSX (eran 109) y 48 archivos de
   acciones.

Tiempo entre commits según sus horas (Lima). Incluye la preparación, la
revisión del responsable y sus pausas; el paso 0 incluye el plan desde el
«aprobado»:

| Commit | Paso 0 | f817b90 | c8a5a9d | 404a761 | 6c8dc59 | 3a86b25 | 3e8f328 | bee5b97 | 5b28b1e |
|---|---|---|---|---|---|---|---|---|---|
| Hora | 21:22 | 21:37 | 21:48 | 22:06 | 22:26 | 22:44 | 22:58 | 07:19 | 19:46 |
| Minutos desde el anterior | — | 15 | 11 | 18 | 20 | 18 | 14 | — | — |

De `f817b90` a `3e8f328`, 96 minutos frente a unos 130 estimados (factor
0,74, como la 10.3b). `bee5b97` y `5b28b1e` llegaron tras pausas largas (la
noche y el día siguiente) y no calibran.

Hallazgos:

1. Los tres cambios de estado escribían el contrario de lo que leían.
   Corregido en `c8a5a9d`.
2. La edición de un producto con su categoría inactiva no se podía guardar.
   Corregido en `404a761`.
3. Los esquemas de cliente, producto y categoría daban el mensaje de Zod en
   inglés: los formularios no limitan el largo. Corregido en `6c8dc59`;
   quedan el de pedidos (10.4c) y los de las demás áreas, en su
   sub-entrega.
4. El vendedor no llegaba a Pagos de cliente ni a Comprobantes de venta.
   Corregido en `5b28b1e`.
5. Para la 10.4c: un pedido cuyo cliente o algún producto se inactivó no se
   puede guardar al editarlo. La página solo ofrece activos y
   `SearchableSelect` deja el campo visible vacío y obligatorio. Además, el
   alta y la edición no comprueban que existan ni que estén activos: un id
   inexistente rompe en la clave foránea.
6. Para la 10.4c (dinero): el pedido calcula el subtotal y el monto estimado
   con números de JavaScript sin redondear, y la base redondea cada uno por
   su cuenta. Con Postgres real (PGlite, `tmp/e10-diff/e104-demo/`), dos
   líneas de 1,25 × S/ 10,25 guardan 12,81 + 12,81 y un monto de 25,63; la
   proforma suma los subtotales (25,62) y el reporte de ventas, el monto.
   Compras (entrega 11) y reparaciones (10.5) tienen el mismo patrón.
7. Entrega 11: `updateOrderAction` decide si el pedido se puede modificar
   fuera de la transacción y sin bloquear la fila, como cancelar (H11). El
   bloqueo solo ordena a quien lo toma: va con editar, cancelar, generar
   proforma y crear la orden de trabajo.
8. El día UTC (hallazgo 3 de la 10.3c) también afecta a los pedidos: después
   de las 19:00 de Lima, elegir «hoy» como entrega da «no puede ser anterior
   a la fecha del pedido», y el pedido queda con la fecha del día siguiente.
9. Proformas, comprobantes y pagos de cliente no paginan, como pagos a
   proveedores. Entrega 11.
10. El filtro de cliente del reporte de ventas y cobranzas solo ofrece
    clientes activos: las ventas de un cliente inactivo no se pueden
    filtrar.
11. Método: un guion de prueba negativa recibió `Errno 22` al escribir un
    `.snap` (Windows). El archivo quedó intacto, comprobado con las pruebas y
    el verificador, y los guiones siguientes escriben con reintentos.
12. Método: la etiqueta de una mutación de C6 se corrigió después de
    ejecutarla, para que describa lo que muta; la mutación no cambió.

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e104-huella`) y etiquetas `e104/`
  (`tmp/e10-diff/e104-*.js`, generados por `c-e104-guiones.py`), guardada en
  el `localStorage` de staging y recargada en cada documento. Plan en
  `tmp/e10-diff/plan-verificacion-10-4a.md`.
- Por el hallazgo 10 de la 10.3c, los registros de cada captura del «antes»
  se exportaron a `tmp/e10-diff/e104-registros/` y se comprobaron con su
  hash (`e104-registros.py`).
- Las tareas escriben datos autorizados por el responsable en cada turno:
  «PRUEBA E104 antes» con `CPR00000010` y `CLI00000008` en el «antes», y
  «PRUEBA E104 despues» con `CPR00000011` y `CLI00000009` en el «después».
  Las capturas 2, 7 y 8 se repiten al final (`-fin`).
- 1281 × 800 y el preset móvil (376 px). El marco de los clics medía 800 px
  para los 1281 de la emulación: los clics por referencia caían fuera y cada
  coordenada se calculó con `getBoundingClientRect` (hallazgo 18).
- La categoría se eligió con `form_input`: las teclas no llegan a un
  `select` nativo en este panel. El nombre y el precio, con teclas reales.

Publicación y medición:

- «Antes» sobre `9c708a1` (CSS servido de 112.979 bytes, `f9a5f2e3…`): las
  15 capturas el 2026-10-25, de 04:38 a 04:42 UTC. El aviso para seguir
  llegó el día 26: el repaso de las 15, de 11:48 a 11:52 UTC, dio los mismos
  hashes, y las tareas y las 3 finales siguieron hasta las 12:02. Sello de 14
  capturas `9a724237…`, igual en Python.
- Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-4a.md`).
- Push de 10 commits (de `c5301c6` a `6ee389c`): CI #98 en verde (de 12:14:08
  a 12:17:24 UTC del 2026-10-26). Vercel desplegó `6ee389c` (`pending` a las
  12:14:09 y `success` a las 12:15:09 UTC). El CSS servido es el predicho
  byte a byte: 112.828 bytes, `6228f316…`.
- El aviso del push llegó a las 00:14 UTC del 2026-10-27: el «después» se
  tomó en el día UTC 27, con la excepción aprobada por el responsable
  (hallazgo 13).
- «Después» el 2026-10-27, de 00:26 a 00:41 UTC: 22 capturas (4 controles,
  11 pantallas, 4 paneles nuevos y 3 finales). Sello de 18 capturas
  `170373e9…`, igual en Python. Evidencia en `tmp/e10-diff/antes-10-4a.json`,
  `despues-10-4a.json`, `registro-10-4a.tsv` (55 filas) y
  `resultado-10-4a.md`.

Huella: 21 de 22 como se predijo, y la del control de pedidos explicada.

- Proveedores, materiales y la sección «Listados» de la galería dan el mismo
  hash que el día 25. Pedidos tiene un elemento más: su filtro «Producto»
  ofrece «PRUEBA E104 antes», que creó el «antes»; sin esa `option`, el
  registro de hoy da exactamente el hash y el `textHash` del día 25
  (hallazgo 15).
- Clientes, 371 elementos, y categorías de producto, 366, como se predijo:
  cada fila pierde su `form` y sus dos campos ocultos, y el texto visible es
  el mismo (hallazgo 14).
- Productos, 341 elementos (342 ± 1 predichos), con el mismo texto visible
  que `products-fin` del «antes»; sin `form` por fila, con `role="search"`,
  «Filtros de productos» y «Nuevo producto» y «Editar» con `returnTo`. Con
  filtros, 293 (294 ± 1) y el mismo texto visible; los `select` conservan el
  filtro.
- El inicio pasa a 6 tarjetas con sus destinos; el alta y la edición
  muestran los asteriscos de obligatorio y la ayuda del precio.
- Los 4 paneles (alta y edición, a 1281 y a 376 px) se abren sobre la lista
  con `returnTo` y el foco en el nombre; a 376 px ocupan la pantalla sin
  desbordar. Esc sin cambios los cierra sin preguntar y devuelve el foco al
  enlace que los abrió.
- Las finales de categorías y clientes dan el hash de sus capturas
  iniciales: los datos de prueba quedaron como estaban.

Tareas (ADMIN), con los mismos pasos en las dos fases:

| Tarea | Antes (`9c708a1`) | Después (`6ee389c`) |
|---|---|---|
| T36 Alta desde la lista filtrada, con nombre duplicado y después correcto | Página completa. El error sale en el formulario y en un toast, y el formulario pierde todo lo escrito; el foco queda en `body`. Al guardar vuelve a la lista sin filtros con `?toast=product-created` | Panel sobre la lista. El error queda en el formulario, sin toast, con todo lo escrito y el foco en el nombre. Al guardar, un aviso (con «Puede no aparecer con los filtros activos del listado.») y el panel se cierra sobre la lista filtrada |
| T37 Inactivar la categoría de prueba y cambiar el precio de su producto | La categoría se inactiva sin confirmar; la edición falla con «Selecciona una categoría activa.» y el precio escrito se pierde | La categoría pide confirmación; la edición guarda (hallazgo 2) |
| T38 Inactivar el producto desde la lista con «Activo» | Sin confirmar; vuelve sin el filtro y la fila sigue a la vista | Confirmación con nombre y consecuencia; «Cancelar» devuelve el foco al botón; al confirmar, un aviso, la fila sale de la lista, el filtro se conserva y el foco va a la tabla |
| T39 Inactivar y activar el cliente; activar la categoría | Sin confirmar; la página vuelve arriba | El cliente confirma al inactivar; activar actúa al pulsar; se conservan el desplazamiento y el foco en el botón de la fila |
| T40 Inicio de Comercial | 4 tarjetas; pagos y comprobantes existían sin enlace | 6 tarjetas con sus destinos |
| T41 Descartar lo escrito | Página completa: «Cancelar» es un enlace y sale sin preguntar; Esc y el clic fuera no hacen nada | En el panel, los tres piden descartar; «Descartar cambios» cierra sin crear nada (hallazgo 16) |

Se verificó solo con ADMIN: el responsable no pidió probar SELLER, porque
`commercial-links.test.ts` y los snapshots cubren lo que ve.

Hallazgos de la verificación:

13. El «antes» y el «después» no cayeron en el mismo día UTC: el aviso del
    push llegó doce horas después del push, ya en el día 27. El responsable
    aprobó tomar el «después» ese día como excepción: el repaso del día 26
    dio los mismos hashes que el 25 en las 15 capturas, y los controles del
    día 27 dieron los del 25.
14. Predicción: «texto igual» se midió con el `textHash`, que lleva una
    entrada vacía por elemento y cambia al quitar `form` e `input` aunque el
    texto que se ve sea el mismo. Se compara el texto visible
    (`tmp/e10-diff/e104-visible.py` y el mismo cálculo en el navegador).
15. El filtro «Producto» de pedidos ofrece también los productos
    inactivos, así que el control de pedidos cambia con los productos de
    prueba. La próxima predicción lo cuenta, o el control se toma antes de
    crear datos. Si ese filtro debe ocultarlos es una decisión de negocio.
16. Predicción: dijo que «Cancelar» de la pregunta de descarte devuelve el
    foco al campo; vuelve al último elemento enfocado de la ventana, como
    documenta *Form surfaces* en `CLAUDE.md`: al campo, o al «Cancelar» del
    pie si la pregunta salió por él. Tampoco previó la segunda línea del aviso con la
    lista filtrada. El manual se corrigió.
17. Método: el panel del navegador se cerró tres veces; perdió dos veces el
    acceso a Vercel y la última, también el `localStorage` y la base del
    navegador de staging. Las comparaciones del «después» se hicieron contra
    los registros de `tmp`, y los guiones se recargaron comprobando su
    SHA-256 contra `e104-cargar.js`.
18. Método: con el panel más estrecho que la emulación, el marco de los
    clics escala 1,6 veces el CSS; una sonda de `mousedown` confirmó la
    escala. Las capturas de pantalla no sirven para apuntar.
19. Método: la rueda del ratón sobre un campo numérico enfocado cambia su
    valor (el precio pasó a 0,99 en el «antes» y se corrigió antes de
    guardar).

El capítulo de Comercial del manual describe el inicio, clientes, productos
y categorías de producto con lo verificado, y las reglas comunes suman
clientes, productos y categorías de producto a la confirmación al inactivar.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-27 (UTC) y comparados con git:

- El cierre `fd08d33` se publicó en `staging`: CI #99 en verde (3m 4s), y
  Vercel lo desplegó (`success` a las 01:42:53 UTC del 2026-10-27).
- PR #28, abierto a las 01:50:46 UTC y fusionado con merge commit a las
  01:57:13 UTC del 2026-10-27: 11 commits, de `c5301c6` a `fd08d33`, y 46
  archivos (+7.216 −903). Su CI, el #100, sobre `fd08d33`, terminó en verde
  (2m 38s).
- El merge commit `3545faf` tiene como padres `cb43290` (`main`) y `fd08d33`
  (`staging`), y su árbol es el de `fd08d33` (`64c7c1db`): `main` y `staging`
  tienen el mismo contenido. CI #101 en verde (2m 47s).
- Vercel desplegó `3545faf` en producción al primer intento (estado «Vercel»
  `pending` a las 01:57:16 UTC y `success` a las 01:58:20 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.4b — Listados de Comercial con fechas y `Badge`

Fecha: del 2026-10-26 al 2026-10-27 (Lima). Estado: cerrada el 2026-10-27
(Lima). El paso 0 (`0a9cd58`) registró la integración de la 10.4a en
`main`. 5 commits, de `77d93f4` a `9ba917b`, el registro `9473952` y el
cierre `052e41d` (CI #103 en verde). Integrada en `main` con el PR #29
(merge commit `745229c`, CI #105 en verde).

| Commit | Tipo | Cambio |
|---|---|---|
| 0a9cd58 | docs | Paso 0: integración de la 10.4a en `main`. |
| 77d93f4 | fix | `DateRangeFields` conserva las fechas elegidas antes de hidratar (D7 de la 10.4). |
| 625d2b3 | test | Caracterización de las listas de pedidos, proformas, pagos de cliente y comprobantes, de los detalles de pedido y proforma con estados reales y de los enlaces «Editar» y «Generar proforma». |
| 42faf2f | feat | Etiquetas de estado con `Badge` (`StateBadge`) en Comercial y en la galería. |
| 391e452 | feat | Pedidos y proformas con `FilterBar` y `DateRangeFields`, sin el `<main>` anidado. |
| 9ba917b | feat | Pagos de cliente y comprobantes con `FilterBar` y `DateRangeFields`, sin el `<main>` anidado. |
| 9473952 | docs | Registro de la sub-entrega, `CLAUDE.md` e inventario. |
| 052e41d | docs | Cierre: publicación y verificación en staging, hallazgos y manual de las listas de Comercial. |

Decisiones del responsable (2026-10-26), tras la auditoría; aprobó las
cuatro recomendadas:

- D1. `Badge` también en los detalles de pedido y proforma, solo la
  etiqueta: su `<main>` queda para la 10.4c y la entrega 11. `StatusBadge`
  sale de Comercial.
- D2. El mapeo sale de `StatusBadge`: `StateBadge` usa sus mismas tablas
  de etiquetas y de clases de tono, y `StatusBadge` no cambia.
- D3. D7 se corrige pasando al estado, al montar, lo que muestra cada
  campo, y no con campos no controlados.
- D4. D7 se verifica en staging con un iframe del mismo origen: las fechas
  se ponen en el DOM antes de que el campo tenga `__reactFiber` y, tras
  hidratar, se miden el aviso del rango y una tecla real en «Hasta»; además,
  un intento con teclas reales inmediatas.

Auditoría (sobre `fd08d33`):

- Las cuatro listas admiten ADMIN y SELLER. Sus parámetros: pedidos `q`,
  `client`, `product`, `status`, `from`, `to`, `page` y `pageSize`;
  proformas `q`, `client`, `order`, `status`, `balance`, `from` y `to`;
  pagos `q`, `client`, `order`, `method`, `type`, `from` y `to`, y
  comprobantes `q`, `type`, `status`, `from` y `to`. Ninguna usa otro nombre
  de fecha, las cuatro filtran una columna `date` con `buildDateRangeFilter`
  y solo pedidos pagina.
- Los destinos de sus enlaces y sus acciones de fila admiten los dos
  roles: ningún rol veía un enlace que lo rechazara y ninguna lista quedaba
  sin tarjeta. La prueba de enlaces no abría «Editar» ni «Generar
  proforma»: los datos generados dan a cada pedido una proforma activa.
- Clientes, productos y categorías ya usaban `Badge`. `StatusBadge` quedaba
  en tres listas y dos detalles de Comercial.
- Los datos generados no pintaban ningún estado real ni las acciones que
  dependen de él: «Sin proforma», «Editar», «Generar proforma» y «Cancelar»
  en pedidos; «Anular» y «Sin comprobante» en proformas; un comprobante
  anulado.
- D7, con el React 19.2.4 de Next: al hidratar, React no pisa el valor del
  DOM, pero el estado del componente sigue con el de la URL y el siguiente
  render lo escribe en el campo. La sonda
  `tmp/e10-diff/explore-hydration-104b.test.ts` lo reprodujo antes de
  editar.

Diseño:

- `DateRangeFields`: al montar, un `useLayoutEffect` compara el valor de
  cada campo con el `defaultValue` que pintó React y, si difiere, lo pasa
  al estado. Solo si difiere (hallazgo 2).
- `StateBadge`, al final de `status-badge.tsx`: cada clase de tono pasa a
  su variante (info, success, default y destructive), un estado sin tono
  usa `outline` y las búsquedas usan `Object.hasOwn`. La galería lo muestra
  en Presentación y en la tabla «lado a lado», cuyas filas no cambiaron: el
  mapeo escrito a mano era el mismo.
- Las barras se llaman «Filtros de pedidos», «Filtros de proformas»,
  «Filtros de pagos de cliente» y «Filtros de comprobantes de venta», con
  su ruta de `navigationHrefs` como acción y como «Limpiar filtros», los
  mismos nombres, textos y opciones, y `DateRangeFields` con `id="fecha"`.
  En comprobantes, «Desde» y «Hasta» eran dos columnas sueltas de la
  rejilla y ahora son el rango. Las acciones de fila (cancelar, anular,
  registrar pago) son de la entrega 11 y no cambian.

Evidencia:

1. Prueba roja antes del arreglo: `tmp/e10-diff/rojo-104b-c1.txt` (2 de
   9; sus 2 contrarias pasan antes y después).
2. Caracterización antes de cambiar: 14 casos de página y 2 de enlaces en
   `625d2b3`, con rango invertido y fechas que no existen en las cuatro
   listas; las 42 entradas existentes no cambian (`verify_104b_c2.py`).
3. Los cambios de snapshots se comprobaron con scripts contra copias
   previas:
   - en C3, 19 resultados cambian solo en la etiqueta: sin el
     `data-variant` quedan iguales, y las 50 etiquetas llevan la variante
     del mapeo (`verify_104b_c3.py`); la entrada de `StatusBadge` de las
     primitivas no cambia;
   - en C4 y C5, 21 resultados de lista cambian solo en la barra y en el
     `<main>` (`verify_104b_lists.py`): fuera de la barra el HTML es
     idéntico; el texto visible solo suma la leyenda «Rango de fechas» y,
     con el rango invertido, el aviso; los demás controles conservan sus
     atributos, y las fechas cambian como manda `DateRangeFields`.

   Los tres se probaron en negativo.
4. Mutaciones (`tmp/e10-diff/mut_104b_c*.txt`): 6 de 6 (y las 2
   equivalentes anunciadas sobreviven), 16 de 16, 7 de 7, 7 de 7 y 8 de 8;
   en total, 44 de 44.
5. CSS compilado igual de C1 a C4 (112.829 bytes). En C5 salen
   `md:col-span-6` y `md:col-span-5`, como predijo
   `tmp/e10-diff/probe-sources.mjs`: el anterior sin esas dos reglas es
   idéntico byte a byte (112.745 bytes, `css_104b_c5.py`).
6. `npm run check` terminó con código 0 después de cada commit, de 2.603 a
   2.626 pruebas en 160 archivos; en C2, al segundo intento (hallazgo 6).
   `npm run refactor:inventory` analiza 677 archivos: 143 páginas y 102
   formularios JSX (eran 106).

Tiempo entre commits según sus horas (Lima). Incluye la preparación, la
revisión del responsable y sus pausas:

| Commit | Paso 0 | 77d93f4 | 625d2b3 | 42faf2f | 391e452 | 9ba917b |
|---|---|---|---|---|---|---|
| Hora | 21:55 | 22:09 | 06:21 | 06:35 | 07:02 | 07:10 |
| Minutos desde el anterior | — | 14 | — | 14 | 27 | 8 |

`77d93f4`, `42faf2f`, `391e452` y `9ba917b` suman 63 minutos frente a 140
estimados en bruto (104 con el factor 0,74 de la 10.4a). `625d2b3` llegó
tras la noche y no calibra.

Hallazgos:

1. Hallazgo 9 de la 10.3c (D7 de la 10.4), corregido en `77d93f4` para las
   14 pantallas que ya usaban `DateRangeFields` y las cuatro listas nuevas.
2. Método: la primera versión del arreglo llamaba siempre a `setFrom` con
   lo que mostraba el campo, y 4 pruebas de cambio de URL fallaron. Una
   sonda (`tmp/e10-diff/explore-d7-cola.test.ts`) mostró que, tras cambiar
   la URL, un render dejaba «Desde» vacío y el siguiente volvía a poner la
   fecha vieja: la actualización con el mismo valor no se descarta, queda
   en la cola con prioridad síncrona y React la vuelve a aplicar después.
3. El filtro «Estado» de pedidos ofrece Registrado, Aprobado y Cancelado,
   pero crear una orden de trabajo deja el pedido en `en_produccion`: un
   pedido en producción no se puede filtrar por su estado. Decisión de
   negocio.
4. Pagos de cliente muestra el tipo y el método como se guardan
   («amortizacion», «efectivo»), y sus filtros, con el texto
   («Amortización», «Efectivo»). Propuesta de texto para la entrega 11.
5. El detalle de proforma no recibe `returnTo`: desde proformas, pagos o
   comprobantes filtrados, «Volver a proformas» pierde los filtros y, desde
   pagos o comprobantes, vuelve a proformas. Va con ese detalle (entrega
   11).
6. Método: el primer `npm run check` de C2 falló porque «el excel combinado
   de mantenimiento se recorta a 5000 filas» (`route.test.ts`) tardó 6,5 s
   con la suite completa, y el límite de Vitest es 5 s. Sola tarda 2,5 s y
   el segundo intento pasó sin cambios. El límite no se cambió: ajustarlo es
   decisión del responsable.
7. Método: el verificador de C4 escribía de memoria el texto del aviso y
   falló; ahora lo lee del código. Una mutación de C4 (el `<main>` de
   vuelta) se detectaba solo porque rompía la compilación; se rehízo
   cambiando la apertura y el cierre, y la detectan 5 aserciones.

Siguen pendientes: el filtro «Producto» de pedidos ofrece también los
productos inactivos (hallazgo 15 de la 10.4a, decisión de negocio); el día
UTC de los filtros y de las fechas de pedido, y la fecha que no existe en
la URL (hallazgos 3 y 4 de la 10.3c); proformas, pagos y comprobantes sin
paginar (entrega 11), y las 4 copias locales que cortan a las `T23:59:59`.

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e104b-huella`) y etiquetas `e104b/`
  (`tmp/e10-diff/e104b-*.js`, generados por `c-e104b-guiones.py`), cargada
  en el `localStorage` de staging y comprobada con su SHA-256
  (`e104b-guiones.sha256`) en las dos fases. Plan en
  `tmp/e10-diff/plan-verificacion-10-4b.md`.
- Los registros de cada captura de las dos fases se exportaron a
  `tmp/e10-diff/e104b-registros/` y se comprobaron con su hash
  (`e104b-registros.py`).
- 1281 × 800 y el preset móvil (376 px). Las fechas se teclearon tecla a
  tecla (hallazgo 11) y los `select` se eligieron con `form_input`. Cada
  coordenada de clic se calculó con `getBoundingClientRect` y se confirmó
  con una sonda de `mousedown` (hallazgo 10).
- El D7 se reprodujo con la restauración de formularios de Chrome
  (hallazgo 8): fechas elegidas con la página hidratada, un `unload` vacío
  para que la página no quede en la caché de ida y vuelta, una navegación de
  documento a otra página y **Atrás**. El guion comprueba que vuelve un
  documento nuevo (`back_forward`) con las fechas restauradas. Ninguna tarea
  escribió datos ni exportó.

Publicación y medición:

- «Antes» sobre `fd08d33` (CSS servido de 112.828 bytes, `6228f316…`), el
  2026-10-28 UTC, de 01:53 a 02:10: 17 capturas (13 y 4 controles) y las
  tareas. Sello de 13 capturas `2f12aa4c…`, igual en Python. Predicción
  escrita antes del push (`tmp/e10-diff/prediccion-10-4b.md` y su `.json`:
  número de elementos y hash del texto visible de cada captura).
- Push de 7 commits (de `0a9cd58` a `9473952`): CI #102 en verde (3m 24s, de
  02:07:26 a 02:10:50 UTC). Vercel desplegó `9473952` (`pending` a las
  02:07:26 y `success` a las 02:09:06 UTC). El CSS servido es el predicho
  byte a byte: 112.744 bytes, `ef3c3e19…`.
- «Después» el mismo día UTC, de 02:16 a 02:34: 17 capturas y las tareas.
  Sello de 13 capturas `f1e4d33c…`, igual en Python. Evidencia en
  `tmp/e10-diff/antes-10-4b.json`, `despues-10-4b.json`,
  `registro-10-4b.tsv` (34 filas), `tareas-10-4b.md`,
  `tareas-antes-10-4b.json` y `resultado-10-4b.md`.

Huella: 15 de 17 como se predijo, y los dos controles restantes explicados.

- Las cuatro listas (a 1281 y a 376 px), los dos detalles y las dos
  secciones de la galería dan el número de elementos y el hash del texto
  visible predichos: +1 en pedidos, proformas y pagos, y +2 en comprobantes
  y en el rango invertido (la leyenda «Rango de fechas» y el aviso), +12 en
  la sección de presentación de la galería y 0 en los detalles y en
  listados. Clientes y productos dan el hash completo del «antes».
- Por elemento:
  - en pedidos, la raíz pasa de `main` a `div` y el envoltorio de las fechas, a `fieldset` con su `legend`;
  - las 9 etiquetas pasan a `Badge`: `inline-flex`, 20 px de alto, 11 px y en mayúsculas;
  - todo lo que hay bajo la barra baja un `dy` constante de 22 px, y las columnas se mueven 1,2 px por el ancho nuevo de las etiquetas;
  - en comprobantes, la barra pasa a `rounded-xl` y las etiquetas de `Field` cambian su separación;
  - en el detalle de pedido solo cambia la etiqueta (285 de 286 registros iguales).
- Entradas y máquinas (controles) tienen el mismo número de elementos y el
  mismo texto visible. Solo difieren 13 y 11 registros de la barra lateral
  del shell: los enlaces de la sección de origen y de destino, con la
  transición del enlace activo a medias en el «antes» (14 y 12 elementos
  animados, frente a 1). Desde el `h1` de la página todo es idéntico, y el
  shell no cambió entre `fd08d33` y `9473952` (hallazgo 13).

Tareas (ADMIN), con los mismos pasos en las dos fases:

| Tarea | Antes (`fd08d33`) | Después (`9473952`) |
|---|---|---|
| T43 D7 en compras | Al volver con Atrás, las fechas restauradas se ven, pero «Hasta» no tiene `min` ni aviso; «Filtrar» envía el rango invertido y la lista dice «Todavía no hay compras registradas.» | Al volver, las mismas fechas, «Hasta» con `min`, `aria-invalid` y el aviso; «Filtrar» da el evento `invalid`, no envía y el foco va a «Hasta» |
| T43 D7 en pedidos | — (la lista no tenía `DateRangeFields`) | Igual que en compras |
| T44 Filtrar pedidos por estado y rango | GET a `?q=&client=&product=&status=registrado&from=2026-07-01&to=2026-07-31`, con PED00000002 | Igual |
| T45 Rango invertido escrito en proformas | Sin aviso; se envía y la lista dice «Todavía no hay proformas registradas.» | El aviso aparece al teclear «Hasta»; no se envía y el foco va a «Hasta» |
| T46 Por URL en pagos | Invertido: sin aviso y lista vacía. `2026-02-30`: el campo se ve vacío, el HTML trae ese valor y salen 5 pagos | Invertido: aviso y lista vacía. `2026-02-30`: vacío también en el HTML y los mismos 5 pagos |
| T47 Comprobantes: Desde sin filtrar, Limpiar, Atrás y Adelante | «Desde» se queda en lo escrito en los tres pasos | Vacío, 01/07 y vacío; el foco se queda en «Limpiar filtros» |
| T48 Etiquetas de estado | `StatusBadge`: 12 px, minúsculas, 26 px de alto | `Badge`: 11 px, mayúsculas, 20 px; el mismo texto y el mismo tono |

Un intento con teclas inmediatas tras cargar compras no ganó la carrera a
la hidratación: React vio las teclas a los 1,9 s. Se verificó solo con
ADMIN: el responsable no pidió probar SELLER, porque
`commercial-links.test.ts` y los snapshots cubren lo que ve.

Hallazgos de la verificación:

8. El método del D4 (un iframe del mismo origen) era imposible: el ERP
   manda `X-Frame-Options: DENY`. El responsable aprobó cambiarlo por la
   restauración de formularios al volver con Atrás, que además es lo que le
   pasa a un usuario real: con el código anterior, el rango invertido
   restaurado se enviaba; con el arreglo, se bloquea.
9. Método: el camino importa. La primera captura de pedidos del «después»
   tenía un elemento más: tras cargar el documento, el HTML del servidor
   trae en el formulario «Cancelar» de la fila editable el `input` oculto
   `$ACTION_ID_…` que Next añade a una acción de servidor, y React lo
   conserva al hidratar; pintado en el cliente con una navegación suave, no
   está. Con el mismo camino que el «antes» dio lo predicho (373, 344 y 374
   a 376 px). La primera versión quedó en `despues-documento__*`.
10. Método: el marco de los clics cambia con el tamaño del panel. Fue de
    673 × 883, que no escala igual en los dos ejes (x × 0,525; y × 1,104),
    y luego de 800 × 500, que sí (0,6245). Dos clics calculados con el marco
    anterior cayeron en la tabla, sin efecto. Las capturas de pantalla
    siguen sin servir para apuntar: una ampliación mostró una fila y no la
    barra.
11. Método: la acción `type` no llena un campo de fecha. Hay que usar `key`
    tecla a tecla, empezando por ← ←: un clic hacia el centro del campo
    puede enfocar el mes.
12. Método: una salida grande de `javascript_tool` se guarda en disco, así
    que los registros de cada fase se exportaron en una sola llamada
    (`e104b-importar.py`), sin copiar trozos de base64. Una salida que cabe
    vuelve en la respuesta: para guardarla, se exporta todo junto.
13. Método: la página del panel estuvo oculta (`visibilityState`) dos veces
    aunque el panel figuraba como mostrado. Se pidió dejar la ventana a la
    vista antes de medir. Las transiciones de la barra lateral de los dos
    controles quedaron a medias en el «antes».
14. Predicción: dijo que, en los detalles, lo de debajo de una etiqueta
    podía subir unos píxeles. En el detalle de proforma, una fila de la
    tabla de comprobantes crece 1,2 px.

El capítulo de Comercial del manual suma las listas de pedidos, proformas,
pagos de cliente y comprobantes de venta y las etiquetas de estado, escritos
con lo verificado. Las reglas comunes suman esas listas a las renovadas y
explican que las fechas elegidas mientras la página carga, o recuperadas al
volver con Atrás, también se validan.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-28 (UTC) y comparados con git:

- El cierre `052e41d` se publicó en `staging`: CI #103 en verde (2m 17s), y
  Vercel lo desplegó (`success` a las 02:44:45 UTC del 2026-10-28).
- PR #29, abierto a las 02:56:01 UTC y fusionado con merge commit a las
  02:59:20 UTC del 2026-10-28: 8 commits, de `0a9cd58` a `052e41d`, y 28
  archivos (+4.780 −845). Su CI, el #104, sobre `052e41d`, terminó en verde
  (3m 3s).
- El merge commit `745229c` tiene como padres `3545faf` (`main`) y `052e41d`
  (`staging`), y su árbol es el de `052e41d` (`2a784fa8`): `main` y `staging`
  tienen el mismo contenido. CI #105 en verde (2m 58s).
- Vercel desplegó `745229c` en producción al primer intento (estado «Vercel»
  `pending` a las 02:59:23 UTC y `success` a las 03:01:05 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.4c — Pedidos, la superficie amplia de Comercial

Fecha: del 2026-10-28 al 2026-10-29 (Lima). Estado: cerrada el 2026-10-29
(Lima). El paso 0 (`93901b0`) registró la integración de la 10.4b en `main`.
7 commits, de `2fd79f2` a `7d03553`, el registro `9a79d36` (CI #106 en
verde) y el cierre `24fe030` (CI #107 en verde). Integrada en `main` con el
PR #30 (merge commit `3ed8001`, CI #109 en verde). Plan en
`tmp/e10-diff/plan-10-4c.md`.

| Commit | Tipo | Cambio |
|---|---|---|
| 93901b0 | docs | Paso 0: integración de la 10.4b en `main`. |
| 2fd79f2 | test | Caracterización del alta y la edición de pedidos (`orders/actions.test.ts`) y de sus páginas con clientes, productos e importes reales. |
| 386ca5e | fix | Importes del pedido con la regla de redondeo de la base (D2 de la 10.4, hallazgo 6 de la 10.4a). |
| 782bd17 | fix | Editar un pedido conserva su cliente y sus productos aunque estén inactivos; uno nuevo debe existir y estar activo (D3 de la 10.4). |
| 3cd7c84 | fix | Mensajes en español, límites de columna y fecha válida en el esquema de pedidos. |
| 8626f18 | feat | Alta y edición con `FormActionState`: superficie amplia en página completa, errores por línea, sin SweetAlert, con `returnTo` y sin `<main>` anidado. |
| 5f58a7c | feat | Confirmar el descarte del formulario de pedidos (D4 de la 10.4). |
| 7d03553 | feat | Detalle de pedido sin `<main>` anidado. |
| 9a79d36 | docs | Registro de la sub-entrega, `CLAUDE.md` e inventario. |
| 24fe030 | docs | Cierre: publicación y verificación en staging, hallazgos y manual del alta y la edición de pedidos. |

Decisiones del responsable (2026-10-28), tras la auditoría; aprobó las
cinco recomendadas:

- E1 (D2, dinero). Una función pura, `src/lib/order-amounts.ts`, para la
  vista previa y las dos acciones: cantidad y precio se redondean a 2
  decimales como `numeric` (mitad lejos del cero, sobre el texto decimal y
  no sobre el binario), el subtotal es `round2(cantidad × precio)` y el
  monto, la suma de los subtotales redondeados. Aritmética entera exacta con
  `BigInt`. La acción envía a Prisma las cadenas redondeadas: lo que se
  envía es lo que se guarda.
- E2 (D3 y hallazgo 5 de la auditoría). La edición ofrece el cliente y los
  productos actuales aunque estén inactivos, marcados «Inactivo» en la
  descripción de la opción, y la acción los acepta mientras no cambien. Uno
  nuevo, en el alta o en la edición, debe existir y estar activo, con su
  mensaje junto al campo.
- E3. Mensajes de Zod en español, los límites de las columnas (cantidad,
  precio, subtotal y monto) y la fecha `aaaa-mm-dd` real, en el mismo `fix`.
- E4. Página completa con `FormActionState`, `ActionForm` y `Field`, errores
  por línea con claves `items.<posición>.<campo>`, `SearchableSelect` con
  `id`, `aria-invalid` y `aria-describedby` opcionales (y una muestra con
  error en la galería), sin el aviso de SweetAlert y «Observación» con
  tilde.
- E5 (D4). «Cancelar» con cambios pide confirmar y recargar avisa
  (`beforeunload`); los enlaces del shell no se bloquean.

Auditoría (sobre `052e41d`):

- Alta, edición y detalle admiten ADMIN y SELLER. Las tres tenían un
  `<main>` anidado. El alta no recibía `returnTo` y la edición lo recibía
  de la lista, pero lo ignoraba.
- El formulario (`src/components/commercial/order-form.tsx`) avisaba dos
  veces de un error (SweetAlert y la alerta del formulario) y solo pintaba
  junto a su campo el cliente y la fecha: los errores de las líneas y el
  producto repetido quedaban en «Revisa los datos del pedido.». Seis
  etiquetas no estaban asociadas a su control, y React 19 vaciaba la fecha
  y las observaciones tras un error.
- Las acciones no tenían pruebas, autorizaban con `requireRole` y
  redirigían (la desviación conocida). No comprobaban que el cliente y los
  productos existieran y estuvieran activos: un id inexistente daba 500 en
  la clave foránea.
- Importes en coma flotante sin redondear, mientras la base redondea cada
  columna por su cuenta: 1,25 × 10,25 en dos líneas mostraba y guardaba
  25,63 de monto con subtotales de 12,81.
- La sonda de Zod (`tmp/e10-diff/zod-probe-104c.mjs`) dio mensajes en
  inglés con un POST armado, una cantidad de `1e12` que pasaba Zod y
  desbordaba la columna (500) y una fecha que no existe que caía en «no
  puede ser anterior a la fecha del pedido».

Diseño:

- `calculateOrderAmounts` devuelve las líneas y el total como cadenas
  `x.xx`. Las acciones envían esas cadenas, y la vista previa del formulario
  usa la misma función.
- `validateOrder` reúne las cuatro reglas comunes de alta y edición: el
  esquema, la fecha de entrega, los productos repetidos (marca la segunda
  aparición) y el cliente y los productos activos, que lee antes de la
  transacción. La edición sigue decidiendo fuera de ella (hallazgo 7 de la
  10.4a, entrega 11).
- `lineKey` arma la clave de cada error con la posición de la línea en el
  formulario, aunque se descarte una línea sin producto: `flatten` de Zod
  aplana las rutas anidadas.
- El formulario pasa a `src/modules/commercial/orders/order-form.tsx`. Cada
  línea tiene ids con su `key`, el subtotal va en un `<output>` y las
  líneas vuelven de `state.values` tras un error. Sin ventana alrededor, usa
  `useDiscardGuard({ onLeave })`: «Cancelar» es un enlace que, con un clic
  izquierdo sin teclas de modificador, pasa por `requestClose`; mientras
  guarda no sale ni pregunta, y al guardar sale sin preguntar
  (`closeAfterSave`). Elegir una opción, agregar o quitar una línea marcan
  el cambio a mano porque no disparan `input`. Los textos de la
  confirmación los elige el formulario según sea alta o edición.
- Las acciones de pedidos no entran en `action-access.test.ts`: como las
  demás de Comercial, sus rechazos se caracterizan en su propio
  `actions.test.ts`. `cancelOrderAction` no cambia (entrega 11).

Evidencia:

1. Pruebas rojas antes de cada arreglo: `tmp/e10-diff/rojo-104c-c2.txt` y
   `rojo-104c-c2-pagina.txt` (importes), `rojo-104c-c3.txt` (inactivos) y
   `rojo-104c-c4.txt` (esquema).
2. Los valores esperados de los importes salen de Postgres, calculados con
   PGlite (`tmp/e10-diff/e104c-demo/casos-importes.mjs`); entre ellos,
   1,25 × 1,02 = 1,28, donde `toFixed` da 1,27. Una comparación fuera de la
   suite (`comparar-importes.mjs`), sobre 2.000 líneas y 500 pedidos
   aleatorios, dio 0 diferencias con la función nueva y 1.203 y 436 con la
   fórmula anterior.
3. Los cambios de snapshots se comprobaron con scripts contra copias
   previas (`verify_104c_c1.py` a `verify_104c_c5.py`, probados en negativo
   con `verify_104c_c5_neg.py` y sus equivalentes), y el de C7 con el
   reemplazo de `<main>` por `<div>`: en cada commit cambia solo lo
   anunciado.
4. Mutaciones (`tmp/e10-diff/mut_104c_c*.txt`): 20 de 20, 13 de 13, 15 de
   15, 14 de 14, 23 de 23, 14 de 14 y 1 de 1; en total, 100 de 100.
5. CSS compilado igual en los 7 commits (112.745 bytes).
6. `npm run check` terminó con código 0 después de cada commit, de 2.626
   pruebas en 160 archivos a 2.750 en 165; en C6, al segundo intento
   (hallazgo 6). `npm run refactor:inventory` analiza 684 archivos: 143
   páginas y 101 formularios JSX (eran 102: el de pedidos usa `ActionForm`).

Tiempo de preparación: de un commit al `npm run check` en verde del
siguiente (Lima). Las esperas al responsable quedan fuera:

| Commit | 2fd79f2 | 386ca5e | 782bd17 | 3cd7c84 | 8626f18 | 5f58a7c | 7d03553 |
|---|---|---|---|---|---|---|---|
| Hora del commit | 05:46 | 05:59 | 06:12 | 06:23 | 13:12 | 20:28 | 21:34 |
| Check en verde | 05:45 | 05:58 | 06:11 | 06:21 | 06:50 | 13:44 | 20:34 |
| Minutos de preparación | 11 | 12 | 12 | 9 | 27 | 32 | 6 |

Suman 109 minutos frente a 250 estimados en bruto (150 con el factor 0,6
del plan): un factor de 0,44, como el 0,45 de la 10.4b.

Hallazgos:

1. La página de edición muestra el formulario de un pedido anulado sin
   proforma, y la acción lo rechaza al guardar. Va con la regla de qué
   pedidos se editan (entrega 11).
2. «Cantidad» tiene `min="1"` en el navegador y el esquema acepta
   cualquier positivo: 0,5 m de baranda no se puede pedir desde la
   pantalla. Decisión de negocio; no se cambió.
3. Cantidades, precios, subtotales o montos fuera de la columna daban 500,
   y una fecha que no existe, el mensaje de la fecha anterior. Corregidos
   en `3cd7c84`.
4. Los errores de las líneas y el del producto repetido no se mostraban
   junto a su campo. Corregido en `8626f18`.
5. Tras un error, quitar una línea anterior a la del error deja los
   mensajes desalineados hasta el siguiente envío: las claves llevan la
   posición del envío. Se registra; no se corrige.
6. Método: el primer `npm run check` de C6 falló con «Failed to start forks
   worker» en `form-dialog.test.ts` (164 archivos): es la infraestructura de
   Vitest, no una prueba. El segundo intento pasó sin cambios.
7. Método: la muestra con error de `SearchableSelect` en la galería cambió
   los ids de `useId` de sus hermanas, como avisa *Pitfalls*; el verificador
   de C5 los aceptó solo en la galería.
8. Método: varias mutaciones no probaban nada y se rehicieron. Algunas eran
   equivalentes (C1 P4, C2 L5, L8 y F1): se cambiaron, o se añadió el caso
   que faltaba («sin productos activos»). Otras rompían la sintaxis (C4 S4 y
   S6): se cambiaron por `.max(Infinity, …)`. Tres sobrevivieron y dieron
   pruebas nuevas: el error del cliente en C5, y en C6 los textos de
   descarte (que pasaron al formulario) y el seguimiento del foco (la prueba
   quita el foco antes de «Cancelar», como Safari).
9. Método: los heredocs de Bash se comen las barras invertidas; los guiones
   se escribieron con Write o Edit.

Siguen pendientes: `updateOrderAction` decide fuera de la transacción
(hallazgo 7 de la 10.4a, entrega 11); el día UTC (hallazgo 8); los
hallazgos 3 a 5 de la 10.4b, y el filtro «Producto» con inactivos
(hallazgo 15 de la 10.4a).

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e104c-huella`) y etiquetas `e104c/`
  (`tmp/e10-diff/e104c-*.js`, generados por `c-e104c-guiones.py`), cargada
  en el `localStorage` de staging y comprobada con su SHA-256
  (`e104c-guiones.sha256`) en las dos fases. Plan en
  `tmp/e10-diff/plan-verificacion-10-4c.md`.
- Los registros de cada captura se exportaron a
  `tmp/e10-diff/e104c-registros/` y se comprobaron con su hash
  (`e104c-registros.py`).
- 1281 × 800 y el preset móvil (376 px).
- Cada captura se tomó tras cargar el documento, para seguir el mismo
  camino en las dos fases (hallazgo 9 de la 10.4b).
- Las tareas usaron clics reales por `ref`, fechas con teclas y opciones
  de `SearchableSelect` con un clic en la opción. `e104c-form.js` leyó el
  formulario y, para saber si recargar preguntaría, despachó un
  `beforeunload` sintético.
- La predicción salió de los snapshots de página (`pred_104c_snap.py`:
  elementos y textos propios entre `2fd79f2` y HEAD), aplicados a los
  textos visibles del «antes» de staging (`pred_104c_visible.py`).
- Datos de prueba, con autorización del responsable:
  - el «antes» creó el cliente CLI00000010 «Cliente prueba 10.4c» y lo
    inactivó, y creó los pedidos PED00000007 (T51) y PED00000008 (T49);
  - el «después» creó PED00000009 y cambió la observación de PED00000007.
  - No se exportó nada.

Publicación y medición:

- «Antes» sobre `052e41d` (CSS servido de 112.744 bytes, `ef3c3e19…`), el
  2026-10-29 UTC: 12 capturas de 03:09 a 03:11 y luego las tareas.
  Predicción escrita antes del push (`tmp/e10-diff/prediccion-10-4c.md` y su
  `.json`: número de elementos y hash del texto visible de cada captura).
- Push de 9 commits (de `93901b0` a `9a79d36`): CI #106 en verde (2m 36s, de
  03:19:50 a 03:22:26 UTC). Vercel desplegó `9a79d36` (`pending` a las
  03:19:51 y `success` a las 03:21:06 UTC). El CSS servido no cambió, como
  se predijo.
- «Después» el mismo día UTC: 12 capturas de 03:22 a 03:24 y las tareas
  hasta las 03:28. Evidencia en `tmp/e10-diff/registro-10-4c.tsv`
  (24 filas), `tareas-antes-10-4c.md` y `resultado-10-4c.md`.

Huella: 10 de 12 como se predijo y 2 explicadas por los datos de prueba.

- **Alta y edición, a 1281 y a 376 px:** +2 elementos (los asteriscos de
  «Cantidad» y «Precio unitario»), con el hash del texto visible predicho:
  `c632b82c…` y `8ea32518…`, con «Observación» con tilde.
- **Alta con `returnTo`:** el mismo hash que el alta, porque la huella no
  registra los `href`.
- **Detalle:** solo cambia un registro (`main` → `div`), con el `textHash`
  completo igual.
- **Galería, sección de campos:** +11 elementos y los 4 textos de la
  muestra «Búsqueda con error».
- **Clientes, productos y categorías:** idénticos byte a byte.
- **Lista filtrada de pedidos y proformas:** suman 1 y 3 elementos.
  Emparejando registros (`__resumen`), los 301 y los 326 del «antes» son
  idénticos. Solo se añaden `option "Cliente prueba 10.4c"` y, en
  proformas, `option "PED00000007"` y `option "PED00000008"`: sus filtros
  listan también los clientes inactivos y todos los pedidos (hallazgo 12).

Tareas (ADMIN), con los mismos pasos en las dos fases:

| Tarea | Antes (`052e41d`) | Después (`9a79d36`) |
|---|---|---|
| T49 Pedido de dos líneas de 1,25 × S/ 10,25 desde la lista filtrada | Vista previa 25,63. PED00000008 guarda 12,81 + 12,81 y monto **25,63**. Vuelve a la lista sin filtros | Vista previa 25,62. PED00000009 guarda 12,81 + 12,81 y monto **25,62**. Vuelve a la lista con el rango, con un solo aviso y «Puede no aparecer con los filtros activos del listado.» |
| T50 Entrega anterior a la fecha del pedido | Toast de error y alerta. Se vacían la fecha y las observaciones. Foco en `body` y ningún campo inválido | Sin toast. El error bajo la fecha, con `aria-invalid` y el foco en ella. Fecha y observaciones conservadas. No guarda |
| T51 Editar un pedido de cliente inactivo | El buscador de cliente sale vacío y el cliente no está entre las opciones. «Completa este campo» bloquea el envío | El cliente con «Inactivo» en la descripción. Guarda y conserva el cliente |
| T52 Cancelar con cambios en la edición | Sale sin preguntar. Recargar no pregunta | Recargar preguntaría. «¿Descartar los cambios del pedido?»: seguir editando conserva el texto y devuelve el foco al enlace; descartar vuelve a la lista con el rango sin guardar |
| T53 Cancelar sin cambios desde la lista filtrada | El alta y la edición vuelven a la lista sin filtros | Las dos vuelven con el rango, sin preguntar |

En la edición, las etiquetas asociadas a su control pasan de 2 de 8 a 9 de
9. Se verificó solo con ADMIN: el responsable no pidió SELLER, y
`actions.test.ts` y `commercial-links.test.ts` cubren sus permisos.
Ctrl + clic en «Cancelar» no se probó con un clic real, porque abriría una
pestaña; lo cubre `order-form.test.ts`.

Hallazgos de la verificación:

10. El aviso doble de error del formulario viejo era un toast de la
    fachada, no un SweetAlert como decía la auditoría. El arreglo es el
    mismo: el error queda dentro del formulario.
11. En el «antes», T51 no llegaba a la acción: el `required` del buscador
    de cliente, vacío porque el cliente inactivo no estaba entre las
    opciones, bloqueaba el envío. El `id_cliente` oculto sí conservaba el
    cliente.
12. Predicción: los datos de prueba entran en los filtros que listan
    inactivos (cliente) y todos los pedidos (pedido de proformas). El plan
    eligió proformas como control sin verlo.
13. Método: la página del panel figuró como `hidden` en casi todo el
    «antes», aunque el panel estaba a la vista. La huella de la lista dio el
    mismo hash en una toma oculta y en otra visible: el único elemento
    animado queda fuera de la huella.
14. Método: la confirmación sigue en el DOM durante su animación de salida.
    Una lectura a los 800 ms la dio por abierta; poco después ya no
    existía y el foco estaba en el enlace.

El capítulo de Comercial del manual suma el alta y la edición de pedidos,
escritos con lo verificado, y las reglas comunes los cuentan entre las
pantallas renovadas.

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-29 (UTC) y comparados con git:

- El cierre `24fe030` se publicó en `staging`: CI #107 en verde (3m 12s), y
  Vercel lo desplegó (`success` a las 12:22:21 UTC del 2026-10-29).
- PR #30, abierto a las 12:35:54 UTC y fusionado con merge commit a las
  12:39:47 UTC del 2026-10-29: 10 commits, de `93901b0` a `24fe030`, y 31
  archivos (+8.837 −729). Su CI, el #108, sobre `24fe030`, terminó en verde
  (3m 26s).
- El merge commit `3ed8001` tiene como padres `745229c` (`main`) y `24fe030`
  (`staging`), y su árbol es el de `24fe030` (`ca4cf6fa`): `main` y `staging`
  tienen el mismo contenido. CI #109 en verde (3m 24s).
- Vercel desplegó `3ed8001` en producción al primer intento (estado «Vercel»
  `pending` a las 12:39:50 UTC y `success` a las 12:41:46 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.5a — Máquinas, repuestos e inicio de Mantenimiento

Fecha: 2026-10-29 (Lima). Estado: cerrada el 2026-10-29 (Lima). El paso 0
(`56c3c20`) registró la integración de la 10.4c en `main`. 8 commits, de
`34ecade` a `a898729`, el registro `55c6b47` (CI #110 en verde) y el cierre
`1a3a018` (CI #111 en verde). Después del cierre, el arreglo del hallazgo 1
(`543bf58`, CI #112 en verde). Integrada en `main` con el PR #31 (merge
commit `1cd778b`, CI #114 en verde). Plan en `tmp/e10-diff/plan-10-5.md`.

| Commit | Tipo | Cambio |
|---|---|---|
| 56c3c20 | docs | Paso 0: integración de la 10.4c en `main`. |
| 34ecade | test | Caracterización de las acciones de máquinas y repuestos (75 casos) y de 3 casos de página que los datos generados no pintaban. |
| 78dcdc0 | fix | Editar un repuesto conserva su proveedor actual aunque esté inactivo (D2, hallazgo 4 de la 10.3a). |
| a072d7c | fix | Mensajes en español y límite de `costo_unitario` en los esquemas de máquina y repuesto. |
| b806662 | feat | Máquinas en panel lateral con `FormActionState`, `FilterBar` y sin `<main>` anidado; se retira `updateMachineStatusAction` (D4). |
| 923bc5d | feat | Inactivar máquina pide confirmación; el cambio de estado fija el estado pedido. |
| c850ca0 | feat | Repuestos en panel lateral con `FormActionState`, `FilterBar` y sin `<main>` anidado; la alta rápida de proveedor sin toasts (D3). |
| ad805da | feat | Inactivar repuesto pide confirmación; el cambio de estado fija el estado pedido; se retira `updateSparePartStatusAction`. |
| a898729 | feat | Las tarjetas del inicio de Mantenimiento siguen los roles de su destino. |
| 55c6b47 | docs | Registro de la sub-entrega, `CLAUDE.md`, la nota de `StatusBadge` (D8) e inventario. |
| 1a3a018 | docs | Cierre: publicación y verificación en staging, hallazgos y capítulo de Mantenimiento del manual. |
| 543bf58 | fix | Después del cierre: elegir o limpiar una opción de `SearchableSelect` dispara `input`, así que un panel o una ventana lo cuentan como cambio (hallazgo 1). |

Decisiones del responsable (2026-10-29), tras la auditoría; aprobó las ocho
recomendadas:

- D1. La 10.5 se parte en 10.5a (máquinas, repuestos e inicio) y 10.5b
  (fallas, preventivos y reparaciones), en ese orden: las dos primeras son
  los catálogos de los que dependen las demás. Recalibradas, unas 6 y 6,7
  horas frente a las 8 del plan.
- D2. Editar un repuesto conserva su proveedor actual aunque esté inactivo,
  marcado «Inactivo» en su opción; uno nuevo debe existir y estar activo.
- D3. El hallazgo 5 de la 10.3b (la alta rápida de proveedor sin bloqueo)
  va a la entrega 11, con Postgres real y dos transacciones. En la 10.5a la
  alta rápida solo cambia de presentación: su error queda dentro del
  formulario.
- D4. Se retiran `updateMachineStatusAction` y la clave
  `machine-status-updated`: un POST público sin pantalla.
- D5. Las decisiones fuera de la transacción de fallas, preventivos y
  reparaciones se corrigen en la 10.5b, con bloqueo de fila.
- D6. Reparaciones será una superficie amplia en página completa con líneas
  dinámicas (10.5b).
- D7. El cambio de estado de fallas, preventivos y reparaciones pasa a un
  componente compartido, `RowStatusSelect` (10.5b).
- D8. `StatusBadge` ya no lo usa Mantenimiento ni Mermas: se corrige la
  documentación aquí y el componente se retira en la entrega 11.

Auditoría (sobre `24fe030`):

- El inicio admite ADMIN y maestro de taller; las listas de máquinas y
  fallas también (el maestro de taller solo consulta máquinas); repuestos,
  reparaciones, preventivos, reincidencias y las altas y ediciones de
  máquina y repuesto, solo ADMIN. Las 12 páginas tenían un `<main>`
  anidado.
- Ninguna acción de Mantenimiento tenía pruebas, salvo los roles de
  `action-access.test.ts`. El alta y la edición de máquinas y repuestos
  autorizaban con `requireRole` y redirigían (la desviación conocida) y
  avisaban dos veces de un error (toast y alerta).
- Los cambios de estado de máquinas y repuestos leían el estado y escribían
  el contrario, sin confirmar.
- La sonda de Zod (`tmp/e10-diff/zod-probe-105.ts`) dio mensajes en inglés
  con un POST armado y un costo de `1e12` que pasaba el esquema y
  desbordaba la columna (500). Fallas, preventivos y reparaciones tienen los
  mismos defectos y otros de fecha; van en la 10.5b.
- El maestro de taller veía en el inicio cuatro tarjetas que lo llevaban a
  «acceso denegado».
- Para la 10.5b, la auditoría también encontró los hallazgos 2, 3, 6 a 8,
  11 y 12 del plan: decisiones fuera de la transacción, importes de
  reparación en coma flotante, fechas que no existen aceptadas, líneas de
  repuesto incompletas ignoradas, el selector de estado en fallas cerradas,
  el día UTC y tres reglas de negocio que no se tocan.

Diseño:

- Máquinas y repuestos como Productos: `layout.tsx` con la ranura `@panel`,
  `(.)new` y `(.)[id]/edit` sobre `RouteSheet`; `machine-edit-values.ts` y
  `spare-part-edit-values.ts` comparten los valores de la edición entre la
  página y el panel; las acciones devuelven `FormActionState` y autorizan
  con `getAuthorizedSession(["ADMIN"])`; las páginas pasan el aviso con su
  clave literal y las listas llevan el `returnTo` al alta y a «Editar». Las
  parejas de campos van en dos columnas según el ancho del formulario
  (`@md:grid-cols-2`), porque el panel es angosto.
- El cambio de estado de máquina recibe el estado pedido: «Inactivar» pide
  `inactiva` desde operativa, en mantenimiento o fuera de servicio, y
  «Activar» pide `operativa` solo desde `inactiva`, con un `updateMany` que
  lleva el estado de partida en el `where`. El de repuesto, como los demás
  booleanos. Inactivar confirma con la consecuencia comprobada en el código:
  - máquina: no se registran fallas sobre ella ni se asigna a etapas de
    producción, y no cuenta como operativa en el inicio;
  - repuesto: deja de ofrecerse al registrar reparaciones; las que ya lo
    usan lo conservan.
- La validación del proveedor lee su estado con `findUnique` y acepta el
  actual del repuesto aunque esté inactivo; `buildSparePartProviderOptions`
  marca «Inactivo» en la descripción de la opción.
- El combobox del proveedor tiene un `id` estable (`id_proveedor`) y su
  error asociado. La alta rápida deja su error en su recuadro y, con éxito,
  elige el proveedor nuevo y lo dice en una línea `role="status"`.
- Cada tarjeta del inicio declara los roles del `requireRole` de su destino.
  `maintenance-links.test.ts`, como el de Inventario, abre con ADMIN y con
  el maestro de taller cada enlace del inicio y de las listas de máquinas y
  fallas, y fija las tarjetas de cada rol.

Evidencia:

1. Pruebas rojas antes de cada arreglo: `tmp/e10-diff/rojo-105a-a2.log`
   (proveedor inactivo), `rojo-105a-a3.log` (6 de 10, esquemas) y
   `rojo-105a-a8.log` (las tarjetas con el maestro de taller). Una
   expectativa explícita del resultado acompaña al snapshot donde el caso es
   nuevo: un snapshot nuevo se escribe con lo que hace el código.
2. Caracterización antes de cambiar: 75 casos de acciones y 3 de página en
   `34ecade`, sin tocar los snapshots existentes.
3. Las llamadas de las acciones se compararon con script contra el commit
   anterior (`cmp_105a_a4_calls.py` y `cmp_105a_a6_calls.py`): en el alta y
   la edición solo cambia la autorización (30 de 30 y 44 de 44). Las de las
   páginas no cambian; su HTML solo cambia por el patrón de `Field`,
   `FilterBar`, el `returnTo` y el `<main>`.
4. Mutaciones (`tmp/e10-diff/mut_105a_a*.txt`): 18 de 18, 7 de 7, 9 de 9,
   13 de 14, 12 de 12, 16 de 17, 12 de 12 y 5 de 5; en total, 92 de 94
   (hallazgos 3 y 4).
5. CSS compilado igual en los 8 commits (112.745 bytes).
6. `npm run check` terminó con código 0 después de cada commit, de 2.829
   pruebas en 167 archivos a 2.883 en 175. `npm run refactor:inventory`
   analiza 709 archivos: 149 páginas (21 en ranuras, 14 que interceptan) y
   97 formularios JSX (eran 101).

Tiempo de preparación: del commit anterior al `npm run check` en verde
(Lima). Las esperas al responsable quedan fuera:

| Commit | 34ecade | 78dcdc0 | a072d7c | b806662 | 923bc5d | c850ca0 | ad805da | a898729 |
|---|---|---|---|---|---|---|---|---|
| Hora del commit | 17:36 | 17:46 | 18:05 | 18:22 | 19:20 | 19:36 | 19:44 | 19:57 |
| Check en verde | 17:25 | 17:42 | 17:53 | 18:20 | 18:30 | 19:35 | 19:43 | 19:50 |
| Minutos de preparación | 13 | 6 | 7 | 15 | 8 | 15 | 7 | 6 |

Suman 77 minutos frente a 217 estimados en bruto (160 con el factor 0,74
del plan): un factor de 0,35. Las dos migraciones al panel (A4 y A6) se
llevan casi el 40 %.

Hallazgos:

1. En un panel, elegir una opción de `SearchableSelect` sin escribir no
   dispara `input`: el panel no queda con cambios y «Cancelar» cierra sin
   preguntar. Pasa con el proveedor del repuesto y con cualquier
   `SearchableSelect` dentro de un `RouteSheet` o un `FormDialog`. El
   arreglo es exponer `markDirty` en `FormSurfaceControls`, un componente
   compartido: se propone aparte, antes de la 10.5b, que usa
   `SearchableSelect` en fallas y preventivos. Corregido después del cierre
   en `543bf58`, con otro arreglo que el propuesto (véase «Arreglo del
   hallazgo 1»).
2. La tarjeta «Máquinas» del inicio dice «Acceso: ADMIN.», y el maestro de
   taller la ve y puede abrir la lista en modo consulta. Es un texto de la
   interfaz; no se cambió.
3. La marca «Inactivo» del proveedor no se ve en el HTML del servidor: la
   lista del `SearchableSelect` está cerrada. La mutación que la quita del
   panel de edición sobrevive; la cubre la prueba de
   `buildSparePartProviderOptions`.
4. Método: una mutación de A4 es equivalente (el respaldo `operativa` del
   formulario: las tres páginas pasan el estado inicial), y la primera de A3
   también lo era (subir el tope medio céntimo: en coma flotante
   `MAX_COST + 0.005` es menor que `9999999999.995`); se cambió por una que
   acepta lo que la base redondearía por encima.
5. Método: en A6 la base del guion de mutaciones falló porque faltaba
   declarar el alta y la edición en `rechazanConResultado`. El guion lo
   mostró («Sin mutar: FALLA») y las mutaciones se repitieron tras
   corregirlo.
6. Método: `count_104a_metrics.py` no detecta los cambios de estado que
   voltean comparando una cadena (máquinas, recetas técnicas y operadores)
   ni el de repuestos, que delegaba en otra acción: la fila de la línea base
   seguía en 2 con los de máquinas y repuestos sin corregir. Medidos a mano,
   quedan 4, todos fuera de Mantenimiento: rutas de fabricación y etapas
   (que el script sí cuenta), recetas técnicas y operadores.
7. Método: un heredoc de Bash con un literal de plantilla de JavaScript
   cortó el comando; los guiones de edición se escribieron con Write
   (`tmp/e10-diff/edit_105a_*.py`).

Siguen pendientes: `updateOrderAction` decide fuera de la transacción
(hallazgo 7 de la 10.4a, entrega 11); el día UTC (hallazgo 8 de la 10.4a);
los hallazgos 3 a 5 de la 10.4b; el filtro «Producto» con inactivos
(hallazgo 15 de la 10.4a), y los hallazgos 1, 2 y 5 de la 10.4c.

#### Publicación, CI y verificación en staging

Método:

- Huella v5 con su propia base (`e105-huella`) y etiquetas `e105/`
  (`tmp/e10-diff/e105-*.js`, generados por `c-e105-guiones.py` a partir de
  los de la 10.4c), cargada en el `localStorage` de staging y comprobada con
  su SHA-256 (`e105-guiones.sha256`). Plan en
  `tmp/e10-diff/plan-verificacion-10-5a.md`.
- 1281 × 800 y el preset móvil (376 px). Cada captura se tomó tras cargar el
  documento con `navigate`, así que el alta y la edición del «después» son
  la página completa, como en el «antes».
- Las tareas usaron clics reales por `ref`, `form_input` para los `select` y
  la opción de `SearchableSelect` con un clic.
- La predicción se escribió antes del push, sobre los cambios de cada commit
  y los snapshots de página (`tmp/e10-diff/prediccion-10-5a.md`); el
  «después» se comparó registro a registro con `__resumen`.
- Datos de prueba, con autorización del responsable:
  - el «antes» creó el proveedor PVE00000010 «Proveedor prueba 10.5a» y el
    repuesto REP00000004 «Repuesto prueba 10.5a» (S/ 10,00) con ese
    proveedor, e inactivó el proveedor;
  - en cada fase, T57 inactivó y volvió a activar MAQ00000006 «Taladro de
    banco» y REP00000004, que terminan en su estado de partida;
  - el «después» actualizó la descripción de REP00000004.
  - No se exportó nada.
- Solo ADMIN: el responsable decidió omitir T59, el inicio con el maestro
  de taller; lo cubre `maintenance-links.test.ts`.

Publicación y medición:

- «Antes» sobre `24fe030` (CSS servido de 112.744 bytes, `ef3c3e19…`), el
  2026-10-30 UTC: 14 capturas de 01:26 a 01:28 y luego las tareas.
- Push de 10 commits (de `56c3c20` a `55c6b47`): CI #110 en verde (2m 51s,
  de 01:47:56 a 01:50:47 UTC). Vercel desplegó `55c6b47` (`pending` a las
  01:47:56 y `success` a las 01:49:55 UTC). El CSS servido no cambió, como
  se predijo.
- «Después» el mismo día UTC: 14 capturas de 01:51 a 01:53 y las tareas
  hasta las 02:10. Evidencia en `tmp/e10-diff/registro-10-5a.tsv` (28 filas)
  y `e105-antes-notas.md`. Los registros completos de cada captura quedaron
  en la IndexedDB del navegador, donde se compararon; no se exportaron.

Huella: 14 de 14 como se predijo.

- **Listas de máquinas y repuestos:** de 352 a 342 y de 345 a 336
  elementos. Emparejando registros, se quitan el `main`, la tarjeta
  «Filtros de búsqueda» (el único texto que desaparece) y los dos `form` de
  fila con sus `input` ocultos; cambian los estilos de la barra por los de
  `FilterBar` y `Field`, y lo de abajo sube 38,3 px. En repuestos se añade
  además `option "Proveedor prueba 10.5a"`: el filtro de proveedores lista
  también los inactivos (predicho).
- **Alta y edición, a 1281 y a 376 px:** +3 elementos, los asteriscos de
  obligatorio; `main` → `div` y la separación de `Field` en las etiquetas.
- **Galería:** un solo registro distinto en cada sección, el texto de la
  nota de `StatusBadge`, con la misma altura.
- **Inicio con ADMIN y los tres controles (fallas, reparaciones y
  reincidencias):** idénticos byte a byte.

Tareas (ADMIN), con los mismos pasos en las dos fases:

| Tarea | Antes (`24fe030`) | Después (`55c6b47`) |
|---|---|---|
| T54 Editar un repuesto con su proveedor inactivo | «El proveedor seleccionado no existe o esta inactivo.» con toast y alerta. No guarda y la descripción escrita se pierde | La opción dice «Inactivo». Guarda con un solo aviso y «Puede no aparecer con los filtros activos del listado.»; la lista conserva su filtro |
| T55 Registrar una máquina con nombre y tipo repetidos | Página completa. Toast y alerta. React vacía los campos y el tipo vuelve a «prensa». Foco en `body` | Panel sobre la lista filtrada. El error en la alerta y junto al nombre, con `aria-invalid` y el foco. Sin toast. Los seis campos se conservan |
| T56 Cancelar con cambios | Sale sin preguntar a la lista sin el filtro | «¿Descartar la máquina nueva?»: seguir conserva lo escrito; descartar cierra el panel y la lista conserva el filtro |
| T57 Inactivar y activar una máquina y un repuesto | Se aplica al pulsar, sin confirmar, y vuelve a la lista sin el filtro | Confirmación con el nombre y la consecuencia y el botón destructivo; un aviso; la lista conserva el filtro y el foco pasa a «Activar». Activar se ejecuta al pulsar |
| T58 Alta rápida con la razón social de un proveedor inactivo | Toast «No se pudo registrar el proveedor» con el mensaje | El mismo mensaje dentro del recuadro, sin toast. Lo escrito se conserva |

Hallazgos de la verificación:

8. Al abrir el proveedor de un repuesto, el buscador toma el nombre elegido
   como búsqueda y la lista solo muestra esa opción; para ver las demás hay
   que borrar el texto. Es el comportamiento de `SearchableSelect` de
   siempre; se registra.
9. Método: dos clics usaron referencias adivinadas en lugar de las de
   `find`: uno no tuvo efecto y el otro escribió en la descripción del
   panel de alta, que se borró antes de seguir. Nada se envió. Un clic en
   «Inactivar» justo después de cargar la página llegó antes de hidratar y
   no hizo nada; se repitió.
10. Método: la confirmación sigue en el DOM durante su animación de salida
    (como el hallazgo 14 de la 10.4c); una lectura a los 1,5 s ya la dio
    cerrada. Antes del «después», la pestaña estaba en el `/login` de
    producción, donde no se tocó nada; la sesión de staging seguía válida.
11. Método: un cambio de ancho del panel del navegador quitó la emulación
    de 1281 × 800 durante las tareas, con las capturas ya hechas.

El manual suma el capítulo de Mantenimiento (inicio, máquinas y
repuestos), escrito con lo verificado, y las reglas comunes cuentan esas
pantallas entre las renovadas.

#### Arreglo del hallazgo 1

Después del cierre, `543bf58` (`fix`) corrigió el hallazgo 1 sin tocar
`FormSurfaceControls`: `SearchableSelect` dispara un `input` que burbujea
desde su `input` oculto cuando la opción cambia (elegida con clic o Enter, o
limpiada), como un `select` nativo; volver a elegir la misma no cuenta. Así
`RouteSheet` y `FormDialog`, que marcan los cambios con el `onInput` de su
contenido, se enteran, y «Cancelar» pregunta antes de descartar. Nada más
cambia de comportamiento.

- Prueba roja antes del arreglo (`tmp/e10-diff/rojo-hallazgo1.log`): 4 de
  17 casos fallan, 3 de `searchable-select.test.ts` (clic, Enter y Limpiar)
  y 1 de `spare-part-form.test.ts` (elegir un proveedor sin escribir, en el
  panel); el contrario, volver a elegir la misma opción, ya pasaba.
- Mutaciones (`tmp/e10-diff/mut_hallazgo1.txt`): 4 de 4 detectadas (sin el
  aviso, sin burbujeo, avisar aunque no cambie y avisar con otro evento).
- `npm run check` terminó con código 0: de 2.883 pruebas en 175 archivos a
  2.888 en 176. CSS compilado igual (112.745 bytes).
- `CLAUDE.md` ya lo documenta en «Wide surface in a full page»: elegir una
  opción deja de pedir `markDirty` a mano.
- Publicado en `staging`: CI #112 en verde (2m 35s); Vercel lo desplegó
  (`success` a las 03:09:06 UTC del 2026-10-30).

#### Integración en `main`

Datos leídos de la API de GitHub el 2026-10-30 (UTC) y comparados con git:

- El cierre `1a3a018` se publicó en `staging`: CI #111 en verde (3m 22s), y
  Vercel lo desplegó (`success` a las 02:48:30 UTC del 2026-10-30). Después
  llegó `543bf58` (CI #112, véase arriba).
- PR #31, abierto a las 03:11:26 UTC y fusionado con merge commit a las
  03:14:28 UTC del 2026-10-30: 12 commits, de `56c3c20` a `543bf58`, y 62
  archivos (+9.807 −1.005). Su CI, el #113, sobre `543bf58`, terminó en
  verde (2m 18s).
- El merge commit `1cd778b` tiene como padres `3ed8001` (`main`) y `543bf58`
  (`staging`), y su árbol es el de `543bf58` (`0e297ee2`): `main` y `staging`
  tienen el mismo contenido. CI #114 en verde (3m 18s).
- Vercel desplegó `1cd778b` en producción al primer intento (estado «Vercel»
  `pending` a las 03:14:31 UTC y `success` a las 03:15:53 UTC). La
  sub-entrega no trae migraciones.

### Sub-entrega 10.5b — Fallas, preventivos y reparaciones

Fecha: del 2026-10-29 al 2026-10-30 (Lima). Estado: registrada; falta la
verificación en staging. El paso 0 (`68b3258`) registró la integración de la
10.5a en `main` y el arreglo del hallazgo 1. 10 commits, de `7c8e1a4` a
`69f1b71`, y este registro. Plan en `tmp/e10-diff/plan-10-5.md`, con los
hallazgos de cada paso.

| Commit | Tipo | Cambio |
|---|---|---|
| 68b3258 | docs | Paso 0: integración de la 10.5a en `main` y arreglo del hallazgo 1. |
| 7c8e1a4 | test | Caracterización de las acciones de fallas, preventivos y reparaciones (94 casos) y casos de página con un registro en cada estado. |
| 03dbb97 | fix | Importes de reparación con la regla de la base; el núcleo en centésimos pasa a `decimal-cents.ts`, compartido con pedidos. |
| 40b46a3 | fix | Decidir dentro de la transacción con bloqueo de fila (D5, hallazgo 2). |
| 08e3889 | fix | Fechas reales, límites de columna, mensajes en español y líneas completas (hallazgos 6 y 7). |
| 30dc16d | feat | Fallas en panel lateral con `FormActionState`, para ADMIN y maestro de taller. |
| 423a11a | feat | Preventivos en panel lateral, con `FilterBar` y `DateRangeFields`; opciones y estado sin máquinas compartidos. |
| 8a6a747 | feat | `RowStatusSelect`, sobre `ConfirmActionButton`, y su muestra en la galería (D7). |
| 72153f8 | feat | Cambio de estado de fallas, preventivos y reparaciones con resultado; fallas cerradas con «Sin accion» (hallazgo 8). |
| ea8969c | feat | Filtros compartidos en reparaciones y reincidencias sin `<main>`. |
| 69f1b71 | feat | Reparaciones como superficie amplia con líneas dinámicas, vista previa y resultado (D6). |
| este | docs | Registro de la sub-entrega, `CLAUDE.md` e inventario. |

Ajustes al plan, aprobados por el responsable:

- D5: fallas y preventivos usan bloqueo de fila y no compare-and-set. Su
  bitácora dice «de X a Y» y tienen mensajes distintos para «no existe» y
  «cerrada»: con compare-and-set habría que leer antes, fuera de la
  transacción. Se añade `lockPreventiveMaintenanceRow`, que el plan no
  preveía.
- `createPreventiveMaintenanceAction` no bloquea: solo comprueba que la
  máquina exista y ninguna acción borra máquinas. Son 5 acciones con bloqueo.
- B7 y B8 se parten en dos commits cada una.
- `RowStatusSelect` no duplica `ConfirmActionButton`: se apoya en él, que suma
  `disabled` (`aria-disabled`, conserva el foco) y `onError`, y pinta siempre
  la misma estructura para no remontar el botón.
- Pedir el estado que ya tiene responde «ya estaba en ese estado» sin escribir
  ni registrar bitácora, y «Guardar» queda desactivado; antes reescribía y, en
  reparaciones, volvía a tocar la falla y la máquina.
- Texto nuevo en reparaciones: decía «hasta 3 repuestos».
- Sin máquinas, el estado vacío del alta de falla enlazaba «Registrar
  maquina» también al maestro de taller, que no puede abrirla: se muestra solo
  a ADMIN.

Diseño:

- Orden de los bloqueos: reparación, falla, máquina. Ninguna operación los
  toma al revés. `updateRepairStatusAction` bloquea la reparación y sus
  `update` toman la falla y la máquina; `createRepairAction` bloquea la falla;
  `createFailureAction`, la máquina.
- Las decisiones dentro de la transacción devuelven el problema desde el
  callback en lugar de lanzarlo: nada se escribió antes, y no hace falta una
  clase de error.
- `decimal-cents.ts` tiene `toCents`, `divideRounded`, `multiplyCents` y
  `formatCents`. `repair-amounts.ts` redondea cantidad, costo y mano de obra,
  calcula el subtotal sobre lo redondeado y suma los subtotales; la acción
  envía esas cadenas. Valores esperados de PGlite
  (`tmp/e10-diff/e105b-demo/casos-reparacion.mjs`).
- `form-options.ts` y `no-machines-state.tsx`, en `src/modules/maintenance`,
  comparten entre fallas, preventivos y reparaciones las fechas por defecto,
  las opciones de máquina y repuesto y el estado sin máquinas.
- Los errores de línea de reparación usan `items.<posición>.<campo>`, con la
  posición del formulario enviado; una línea vacía del todo no se guarda y un
  repuesto repetido se marca en cada línea que lo usa. El subtotal y el total
  los comprueba la acción, que conoce el costo.
- La vista previa usa el costo cargado con la página; la acción lee el
  vigente al guardar.
- Los confirm de fila viven en `failure-status-select`,
  `preventive-status-select` y `repair-status-select`, con las consecuencias
  comprobadas en el código. Un preventivo pendiente con fecha pasada se
  muestra «Vencido» sin estar guardado así: `storedValue` hace que guardarlo
  cuente como cambio.

Evidencia:

1. Pruebas rojas antes de cada arreglo: `tmp/e10-diff/rojo-105b-b2.log` (17
   fallos, con un doble en coma flotante para que fallaran por los importes),
   `rojo-105b-b3.log` (10) y `rojo-105b-b4.log` (51).
2. Las llamadas se compararon con script contra el commit anterior:
   `cmp_105b_b3_calls.txt` (85 de 85 resultados iguales),
   `cmp_105b_b5_calls.txt`, `cmp_105b_b6_calls.txt`, `cmp_105b_b7_calls.txt` y
   `cmp_105b_b8_calls.txt`: solo cambian la autorización y el final de la
   transacción, salvo los casos previstos.
3. Mutaciones (`tmp/e10-diff/mut_105b_b*.txt`): 21 de 21, 14 de 14, 16 de 16,
   23 de 23, 18 de 18, 22 de 22, 16 de 16, 22 de 22, 6 de 6 y 28 de 28; en
   total, 186 de 186 (véanse los hallazgos 6 a 10 sobre las que sobrevivieron
   primero).
4. CSS compilado igual en cada commit salvo dos: `423a11a` añade
   `@md:grid-cols-3` y `69f1b71` añade `items-baseline` y retira
   `md:grid-cols-[1fr_160px]`. De 112.745 a 112.786 bytes.
5. `npm run check` terminó con código 0 después de cada commit, de 2.888
   pruebas en 176 archivos a 3.225 en 190. `npm run refactor:inventory` analiza
   744 archivos: 153 páginas (25 en ranuras, 16 que interceptan) y 89
   formularios JSX (eran 97).

Tiempo de preparación: del primer guion o prueba de cada paso al
`npm run check` en verde (Lima). Las esperas al responsable y la lectura previa
quedan fuera:

| Commit | 7c8e1a4 | 03dbb97 | 40b46a3 | 08e3889 | 30dc16d | 423a11a | 8a6a747 | 72153f8 | ea8969c | 69f1b71 |
|---|---|---|---|---|---|---|---|---|---|---|
| Inicio | 22:32 | 06:37 | 06:59 | 07:15 | 21:08 | 21:32 | 21:56 | 22:07 | 22:23 | 22:30 |
| Check en verde | 22:47 | 06:46 | 07:04 | 07:23 | 21:25 | 21:45 | 22:04 | 22:16 | 22:26 | 22:47 |
| Minutos | 15 | 9 | 5 | 8 | 17 | 13 | 8 | 9 | 3 | 17 |

Suman 104 minutos frente a 340 estimados en bruto (170 con el factor 0,5 del
plan): un factor de 0,31.

Hallazgos:

1. Crear una reparación ya «anulada» no toca la falla ni la máquina. Es una
   regla de negocio, de la familia del hallazgo 12 de la auditoría: se fija en
   las pruebas y no se cambia.
2. Una reparación ejecutada deja la máquina «operativa» aunque se haya
   inactivado o dado de baja; programada u observada, «en reparación». También
   de esa familia; no se cambia sin decisión del responsable.
3. Las reparaciones guardadas antes de `03dbb97` conservan su total: los
   detalles pueden sumar 25,62 y el total 25,63. Corregirlas pide una migración
   de datos; la lista muestra lo guardado.
4. La tarjeta «Recomendacion» del alta de fallas dice que las reparaciones se
   implementarán en la siguiente subfase, y ya existen. Es copia; no se cambió.
5. Los mensajes «No se puede modificar una reparacion finalizada o anulada.» y
   similares siguen sin tilde; ahora se ven en la fila. Es copia; no se cambió.
6. Método: la mutación G1 de B1 sobrevivió porque los datos tenían una falla
   reparada y una anulada y los dos indicadores valían 1. Se añadió otra
   reparada.
7. Método: la mutación D6 de B4 sobrevivió porque `toDateInputValue("")`
   devuelve `""`: el `!value ||` sobraba en preventivo y reparación, y se quitó.
8. Método: la descripción de una opción y el costo de un repuesto no llegan al
   HTML del servidor, como el hallazgo 3 de la 10.5a: O3 de B6 y P1 de B8b
   sobrevivieron y `form-options.test.ts` los cubre directamente.
9. Método: S5 y C6 de B7a sobrevivieron por huecos reales de la prueba, y A3 y
   F6 de B8b también (un repetido tras una línea vacía; quitar la última línea).
10. Método: A4 de B8b era equivalente (tras validar, una línea tiene los dos
    campos o ninguno) y se rehízo; F4 mostró que `markDirty` sobraba al quitar
    una línea, porque solo se quita lo que antes se agregó, y se retiró.
11. Método: un heredoc largo de Bash se cortó en B6, como en la 10.5a (hallazgo
    7); los guiones se escribieron con Write. En B8b un comparador caracter a
    caracter de `difflib` sobre el CSS tardó más de dos minutos; se compara por
    reglas.

Siguen pendientes: `updateOrderAction` decide fuera de la transacción
(hallazgo 7 de la 10.4a, entrega 11); el día UTC (hallazgo 8 de la 10.4a,
también las fechas por defecto de fallas y el `fecha_realizada` del preventivo);
los hallazgos 3 a 5 de la 10.4b, el 15 de la 10.4a y los 1, 2 y 5 de la 10.4c;
la alta rápida de proveedor sin bloqueo (entrega 11); el texto «Acceso: ADMIN.»
de la tarjeta Máquinas (hallazgo 2 de la 10.5a); las reglas del hallazgo 12 de
la auditoría; y una prueba de carrera real con Postgres para los bloqueos
(entrega 11), porque las unitarias fijan el protocolo, no la carrera.

## Secuencia de próximas entregas

Orden vigente desde el 2026-09-28 (detalle y motivos en la sección 16 del plan).
Pista A: estructura sin cambios de comportamiento. Pista B: experiencia de usuario.
Desde el 2026-10-09, entre la entrega 7 y la pista B va un bloque de
estabilización: los defectos conservados por las entregas anteriores, en cuatro
grupos de `fix` agrupados por invariante, cada uno con prueba que falla primero.

| # | Pista | Entrega | Estado |
|---|---|---|---|
| 0 | Base | Validación, inventario, CI y configuración de Claude Code | Cerrada (CI #19 verde, staging Ready) |
| 1 | Fix | Stock atómico en compras y anulación | Cerrada (CI #21 verde, staging verificado) |
| 2 | A | Contratos: resultado de acciones y autorización centralizada | Cerrada (CI #25 verde, staging verificado) |
| 3 | A | Conversión y formatos compartidos | Cerrada (CI #29 verde, staging verificado con ADMIN) |
| 4 | A | Consultas fuera de las páginas, por área | Cerrada (CI #36 verde en main, staging verificado) |
| 5 | A | Exportaciones por reporte | Cerrada (CI #39 verde en main, verificada en producción) |
| 6 | A | Órdenes de trabajo y costeo por caso de uso | Cerrada (CI #43 verde en main, staging verificado con ADMIN) |
| 7 | A | Fachada de notificaciones | Cerrada (CI #47 verde en main, staging verificado con ADMIN: 14 de 14 URLs idénticas) |
| G1 | Fix | Reglas dentro de la transacción y bloqueo de fila (H1, H3, H4, H8, H9, H10) | Cerrado (CI #51 verde en main; H3, H1 y H4 reproducidos antes y no después en staging) |
| G2 | Fix | Kárdex, lecturas y cálculo (H2, H5, H6, H7) | Cerrado (CI #55 verde en main; H7 y H2 reproducidos antes y no después en staging) |
| G3 | Fix | Puente de notificaciones (F1, F2, F3) y la clave sin emisor | Cerrado (CI #59 verde en main; 23 de 23 observaciones como se predijo en staging) |
| G4 | Fix | Divergencias entre pantalla y exportación de la entrega 5 (D1, D2, fechas, forma y alias) y prefetch de las exportaciones | Cerrado (CI #63 verde en main; 18 de 18 observaciones como se predijo en staging, D1 reproducido antes y no después) |
| 8 | B | Base visual y galería | Cerrada (CI #69 verde en main; 10 de 10, 24 de 24 y 26 de 26 huellas contra la predicción en staging) |
| 9 | B | Piloto Clientes y categoría en ventanas | Cerrada (CI #75 verde en main; 15 de 18 huellas como se predijo y 3 desviaciones explicadas; T1 a T5 medidas antes y después en staging) |
| 10 | B | Catálogos, listados y resto de dominios | En curso (plan aprobado el 2026-10-15: 8 sub-entregas; 10.1 cerrada, con CI #79 verde en main y 17 de 17 huellas explicadas en staging; 10.2 cerrada, con CI #84 verde en main y 16 de 16 huellas como se predijo en staging; 10.3 partida en dos, 10.3a cerrada, con CI #89 verde en main y 7 de 7 huellas como se predijo en staging; la 10.3b, partida a su vez en 10.3b y 10.3c, cerrada, con CI #93 verde en main, 10 de 10 huellas como se predijo en staging y los hallazgos 4 y 13 de la 10.3a corregidos; la 10.3c, cerrada, con CI #97 verde en main, 21 de 21 huellas como se predijo en staging y el hallazgo 6 de la 10.3a corregido; la 10.4, partida en 10.4a, 10.4b y 10.4c; la 10.4a, cerrada, con CI #101 verde en main, 22 huellas del «después» (21 como se predijo y la del control de pedidos explicada por un dato de prueba) y los hallazgos 1 a 4 corregidos; la 10.4b, cerrada, con CI #105 verde en main, 17 huellas del «después» (15 como se predijo y los 2 controles explicados por la barra lateral) y el hallazgo 9 de la 10.3c corregido; la 10.4c, cerrada, con CI #109 verde en main, 12 huellas del «después» (10 como se predijo y 2 explicadas por los datos de prueba) y D2 y D3 de la 10.4 corregidos; la 10.5, en curso, partida en 10.5a y 10.5b; la 10.5a, cerrada, con CI #114 verde en main, 14 de 14 huellas como se predijo y los hallazgos 4 de la 10.3a y 1 de la 10.5a corregidos; la 10.5b, registrada, con los hallazgos 2, 3, 6, 7 y 8 de la auditoría corregidos, pendiente de verificación en staging) |
| 11 | — | Operaciones críticas con integración e idempotencia; consolidación | Pendiente |

## Línea base de métricas (rama `staging`, commit `42f4308`)

Medido el 2026-09-28 sobre el código versionado, excluyendo `src/generated`.
Actualizar la columna "Actual" al cerrar cada entrega (comando `/verificar`).

| Métrica | Línea base | Actual | Entrega que la mueve |
|---|---|---|---|
| Archivo más grande (`api/reports/export/[report]/route.ts`) | 1.499 líneas | 199 | 5 |
| `production/work-orders/actions.ts` | 1.055 líneas | 240 | 6 |
| `costs/costings/[id]/page.tsx` | 1.026 líneas | 110 | 6 |
| Páginas con Prisma directo | 117 | 0 | 4, 5 y 6 |
| Archivos de `src/modules` con `auth()` directo | 23 | 0 | 2 |
| Acciones de `src/modules` que comparan el rol a mano | 41 | 0 | 2 |
| Definiciones de la forma de estado de formulario | 18 | 2 (`ActionErrorState` y `FormActionState`, el contrato de la pista B) | 2 y 9 |
| Definiciones locales de `toNumber` | 52 | 1 | 3 |
| Definiciones locales de `formatMoney` | 49 | 1 | 3 |
| Definiciones locales de `formatDate` | 52 | 1 | 3 |
| Archivos que importan `sweetalert2` o `react-toastify` | 2 | 2, solo la fachada y el proveedor (regla de ESLint) | 7 |
| Entradas del catálogo de notificaciones dentro del puente `?toast=` | 124 | 0 | 7 |
| Claves `?toast=` caracterizadas (texto, severidad y HTML) | 0 / 124 | 128 / 128 | 7, G3, 9 y 10 |
| Claves emitidas sin entrada / entradas sin emisor no declaradas, comprobado por prueba | sin control | 0 / 0 | 7 |
| Archivos de prueba / pruebas aprobadas | 18 / 203 | 190 / 3.225 | todas |
| Escrituras de stock no atómicas en compras | 2 | 0 | 1 |
| Cargas de `usuario` completo en reportes y exportación | 15 | 0 | 5 |
| Comparaciones de rol a mano en la exportación | 1 | 0 | 5 |
| Acciones de órdenes de trabajo y costos caracterizadas | 0 / 15 | 15 / 15 | 6 |
| Fórmulas de costeo repetidas entre el detalle y las acciones | 3 | 0 | 6 |
| Cargas de `usuario` completo en órdenes de trabajo y costos | 5 | 0 | 6 |
| Operaciones que leen, validan y escriben una orden, un costeo o un costo indirecto sin bloquear su fila | 14 | 0 | G1 |
| Acciones de avance y salida de inventario caracterizadas | 0 / 4 | 4 / 4 | G1 |
| Escrituras del kárdex que anotan un stock leído antes de escribir | 2 | 0 | G2 |
| Defectos del puente `?toast=` fijados por la caracterización / entradas declaradas sin emisor | 3 / 1 | 0 / 0 | G3 |
| Reportes cuyo enlace de exportación filtra distinto que su pantalla | 4 de 9 | 0 de 9 | G4 |
| Nombres de parámetro que la exportación acepta sin que ninguna pantalla los genere | 17 | 0 | G4 |
| Enlaces a `/api/` con `next/link` (su prefetch ejecuta la ruta) | 6 | 0 | G4 |
| Colores literales en los `.tsx` de la interfaz | 25 | 0 (regla de ESLint) | 8 |
| Colores literales en las hojas, fuera de `tokens.css` | 27 | 0 (prueba) | 8 |
| Reglas / selectores del adaptador `industrial-dark` | 49 / 134 | 25 / 40 | 8 y 11 |
| Variables de color definidas dos veces (`:root` y `.dark`) | 37 | 0 | 8 |
| Familias de fuentes que el build descarga de Google | 3 | 0 (regla de ESLint) | 8 |
| Copias locales de `FieldError` | 16 | 6 | 9 y 10 |
| Páginas con un `<main>` dentro del `<main>` del shell | 113 | 60 | 9 y 10 |
| Combinaciones de clases distintas en los formularios GET (43 al medir la línea base) | 27 | 11 (15 formularios) | 9 y 10 |
| Acciones de alta y edición de Clientes y categorías de producto caracterizadas | 0 / 4 | 4 / 4 | 9 |
| Funciones de `useActionState` que redirigen al negar el permiso (desviación conocida) | 30 | 10 | 10 |
| Acciones de activar e inactivar que leen el estado y escriben el contrario | 11 | 2 | 10 |
| Utilidades CSS sin consumidores sacadas de documentación o del gestor viejo | 7 | 0 | 10 |
| Pantallas de reportes que consultan con el rango invertido / que ofrecen exportar un rango que la ruta rechaza | 10 / 9 | 0 / 0 | 10 |
| Pantallas con rango de fechas sin `DateRangeFields` | 27 | 7 | 10 |
| Archivos de acciones de inventario sin caracterizar (materiales, alertas, proveedores y materiales de proveedor) | 4 | 0 | 10 |
| Altas que deciden el kárdex o la alerta con los números del formulario y no con la fila escrita | 1 | 0 | 10 |
| Listados que cortan el último día con `lte` (con `buildDateRangeFilter` o con una copia local) | 17 | 4 (copias locales) | 10 |
| Enlaces de Inventario que un rol ve y su pantalla rechaza / pantallas de Inventario sin ningún enlace en la app | 4 / 3 | 0 / 0 | 10 |
| Acciones de Comercial sin caracterizar: el cambio de estado de clientes; el alta, la edición y el cambio de estado de productos; el de categorías | 5 | 0 | 10 |
| Listas de Comercial sin tarjeta en su inicio (el vendedor no llegaba a ellas) / enlaces de Comercial que un rol ve y su pantalla rechaza | 2 / 0 | 0 / 0 | 10 |
| Pantallas con `DateRangeFields` que pierden las fechas elegidas antes de hidratar | 14 | 0 | 10 |
| Pantallas de Comercial con `StatusBadge` | 5 | 0 | 10 |
| Archivos de acciones de Mantenimiento sin caracterizar (máquinas, repuestos, fallas, preventivos y reparaciones) | 5 | 0 | 10 |
| Acciones de fallas, preventivos y reparaciones que deciden fuera de la transacción | 5 | 0 | 10 |
| Acciones de fallas, preventivos y reparaciones que lanzan en lugar de devolver el error | 6 | 0 | 10 |
| Enlaces de Mantenimiento que un rol ve y su pantalla rechaza | 4 | 0 | 10 |

Actualizado en la entrega 2 (2026-09-30) con `/verificar` sobre `5de9193`. Las dos
filas nuevas se midieron sobre `58edb6c`; entre `42f4308` y ese commit, en `src`
solo cambiaron `inventory/purchases/actions.ts` y su prueba, que no tienen ninguno
de esos patrones, por lo que son también su línea base.

Actualizado en la entrega 3 (2026-10-01) sobre `e5a1652`. Las demás filas no
cambian: páginas con Prisma directo 117, `auth()` directo 0 y `sweetalert2` 2,
medidos de nuevo; las otras no las toca esta entrega.

Actualizado en la entrega 4 (2026-10-05) sobre `fbe2ec7`: páginas con Prisma
directo 19 y pruebas 75 / 869. Las demás filas no cambian: los tres archivos
más grandes (1.476, 1.046 y 1.004 líneas), `auth()` directo 0, copias locales de
conversión y formato 0 y `sweetalert2` 2, medidos de nuevo.

Actualizado en la entrega 5 (2026-10-05) sobre `6fc7c11`: `route.ts` 186 líneas (el
archivo más grande pasa a ser `production/work-orders/actions.ts`, 1.046, de la
entrega 6), páginas con Prisma directo 9 y pruebas 86 / 977. Las dos filas nuevas
se midieron sobre `e6c8c29`, su línea base. Las demás no cambian: `auth()` directo
0, copias locales de conversión y formato 0 y `sweetalert2` 2, medidos de nuevo.

Actualizado en la entrega 6 (2026-10-07) con `/verificar` sobre `ffcc683`:
`work-orders/actions.ts` 240 líneas, detalle de costeo 110, páginas con Prisma
directo 0 (ni `prisma.` ni `@/lib/db`) y pruebas 91 / 1.212. Las tres filas nuevas
se midieron sobre `108ba00`, su línea base. Las demás no cambian: `auth()` directo
0, copias locales de conversión y formato 0 y `sweetalert2` 2, medidos de nuevo.
Los tres archivos más grandes de `src` son ahora pruebas y el arnés (1.079, 966 y
901 líneas); los más grandes de producción, las páginas de reporte de
mantenimiento (696), detalle de orden de trabajo (643) y resumen mensual de caja
(614).

Actualizado en la entrega 7 (2026-10-07) sobre `3bef5c9`: pruebas 95 / 1.390 y
las tres filas nuevas de notificaciones, medidas sobre `27342e3`, su línea base
(desde `7c90ac2` solo cambió `SEGUIMIENTO.md`). La fila de `sweetalert2` pasa a
contar declaraciones `import` de `sweetalert2` o `react-toastify`: eran y son 2
(`lib/notifications.ts` y el proveedor de toasts), y desde esta entrega una
regla de ESLint lo impone. Las demás no cambian: páginas con Prisma directo 0,
`auth()` directo 0 y copias locales de conversión y formato 0, medidos de nuevo.

Actualizado en el grupo 1 de fixes (2026-10-09) sobre `bab22eb`: pruebas 98 /
1.552 y dos filas nuevas medidas sobre `40de6b7`, su línea base: 14 operaciones
decidían sin bloquear su fila (los 7 casos de uso de órdenes de trabajo, el
recálculo y la generación del costeo, la anulación de un costo indirecto, las 3
acciones de avance y la salida de inventario) y ninguna de esas 4 acciones tenía
pruebas. Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0,
copias locales de conversión y formato 0 e `import` de las librerías de
notificaciones 2, medidos de nuevo. Los tres archivos más grandes de `src` son
pruebas y el arnés (1.156, 1.148 y 901 líneas); los de producción no cambian
(696, 643 y 614).

Actualizado en el grupo 2 de fixes (2026-10-10) sobre `a662913`: pruebas 99 /
1.568 y una fila nueva medida sobre `b9b896f`, su línea base: de las 6
escrituras de `stock_anterior` en el kárdex, la entrega y la devolución de
material eran las 2 que anotaban un stock leído antes de escribir; las otras 4
lo toman de la propia escritura (alta y anulación de compras), de una lectura
con el material bloqueado (salida de inventario) o parten de cero (material
nuevo). Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0,
copias locales de conversión y formato 0 e `import` de las librerías de
notificaciones 2, medidos de nuevo. Los tres archivos más grandes de `src` son
pruebas y el arnés (1.335, 1.161 y 901 líneas); los de producción no cambian
(696, 643 y 614).

Actualizado en el grupo 3 de fixes (2026-10-10) sobre `7453c57`: pruebas 99 /
1.580, claves caracterizadas 123 / 123 (el registro tiene 123 entradas: 93
éxitos, 29 advertencias y 1 error) y una fila nueva medida sobre `a564ed7`, su
línea base: F1, F2 y F3, fijados por la caracterización de la entrega 7, y
`work-order-materials-consumed` en `CLAVES_SIN_EMISOR`. El código sigue
emitiendo 103 `toast=` en 47 archivos. Las demás no cambian: páginas con
Prisma directo 0, `auth()` directo 0, copias locales de conversión y formato 0
e `import` de las librerías de notificaciones 2, medidos de nuevo. Los tres
archivos más grandes de `src` y los de producción no cambian (1.335, 1.161 y
901; 696, 643 y 614).

Actualizado en el grupo 4 de fixes (2026-10-12) sobre `4b5fbd3`: pruebas 101 /
1.650, `route.ts` 199 líneas (186 antes: la firma y el comentario de
`extractReportDateRange`) y tres filas nuevas medidas sobre `6414798`, su
línea base: mantenimiento, rentabilidad, personal y auditoría exportaban con
otro filtro que su pantalla (98 de los 134 enlaces de la batería del
diferencial), y la exportación aceptaba 17 nombres que ninguna pantalla
genera: 15 en los exportadores de personal, rentabilidad y auditoría, y
`from` y `to` en la validación de la ruta de los otros 6 reportes; y 6
enlaces a `/api/` usaban `next/link`: los dos botones de exportación de
personal, rentabilidad y auditoría. Las demás
no cambian: páginas con Prisma directo 0, `auth()` directo 0, copias locales
de conversión y formato 0 e `import` de las librerías de notificaciones 2,
medidos de nuevo. Los tres archivos más grandes de `src` y los de producción
no cambian (1.335, 1.161 y 901; 696, 643 y 614).

Actualizado en la entrega 8 (2026-10-14) sobre `aada765`: pruebas 116 /
1.847 y ocho filas nuevas medidas sobre `3d10c09`, su línea base. Los 27
colores literales de las hojas bajan a 18 en `b30aa08`, porque 9 estaban en
las reglas `industrial-dark` sin consumidores, y a 0 en `667eb70`; los 25 de
los componentes, a 0 en `9102e3b`. Las tres últimas filas no se mueven en
esta entrega: las cuentan para las entregas 9 y 10, que adoptan los
componentes nuevos en las pantallas. Las demás no cambian: páginas con Prisma
directo 0, `auth()` directo 0, copias locales de conversión y formato 0 e
`import` de las librerías de notificaciones 2, medidos de nuevo. Los tres
archivos más grandes de `src` y los de producción no cambian (1.335, 1.161 y
901; 696, 643 y 614).

Actualizado en la entrega 9 (2026-10-15) sobre `5261489`:

- Pruebas: 125 / 1.972 al registrarla, y 125 / 1.975 con el fix de la
  verificación (`498533d`), que no mueve ninguna otra fila.
- La forma de estado de formulario pasa de 1 a 2, a propósito.
  `FormActionState` (`src/lib/action-result.ts`) es el contrato de la pista B,
  con `values` y `operationId`, y convive con `ActionErrorState`
  (`src/lib/errors.ts`) mientras los demás formularios no migren.
- Claves caracterizadas: 125 / 125, por las dos de la ventana de categorías.
  Las 4 claves del piloto ya no viajan por `?toast=`: las da el formulario con
  el resultado de la acción, y el registro las reconoce por el acceso al
  catálogo con su clave literal. El puente sigue caracterizando todas las
  entradas del catálogo.
- `FieldError` baja a 14, el `<main>` anidado a 109 y los formularios GET a 42,
  con 26 combinaciones de clases: son las pantallas de Clientes y de categorías.
- La fila nueva se midió sobre `1812fff`, su línea base: ni las acciones de
  Clientes ni las de categorías tenían pruebas.

Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0, copias
locales de conversión y formato 0 e `import` de las librerías de notificaciones
en 2 archivos, medidos de nuevo. Los tres archivos más grandes de `src` miden
1.335, 1.176 (el arnés, +15) y 901 líneas. Los de producción miden 696, 643 y
632: `commercial/products/actions.ts` (606 antes, +26 por el contrato de las
categorías) supera al resumen mensual de caja (614).

Actualizado en la sub-entrega 10.1 (2026-10-16) sobre `0f968ad`:

- Pruebas: 135 / 2.108. Claves caracterizadas: 129 / 129, por las cuatro
  de las ventanas de los catálogos de inventario.
- `FieldError` baja a 12, el `<main>` anidado a 105 y los formularios GET a
  41, con 25 combinaciones de clases.
- Las tres filas nuevas se midieron sobre `62640e1`, su línea base. La
  desviación cuenta las funciones de `useActionState` que autorizan con
  `requireRole`: quedan 24, en 12 archivos. Los toggles que voltean el
  estado cuentan las funciones con `nextStatus = !` en `src/modules`:
  quedan 8, en 7 archivos. Las utilidades sin consumidores son las 4 que
  generaba el Markdown y las 3 que solo usaba el gestor de catálogos
  anterior.

Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0,
copias locales de conversión y formato 0 e `import` de las librerías de
notificaciones en 2 archivos, medidos de nuevo.

Actualizado en la sub-entrega 10.2 (2026-10-17) sobre `9d70f59`:

- Pruebas: 135 / 2.189.
- El `<main>` anidado baja a 102 (rentabilidad, personal y auditoría) y los
  formularios GET a 31, con 22 combinaciones de clases: las 10 barras de los
  reportes pasan a `FilterBar`.
- Las dos filas nuevas se midieron sobre `d3de58e`, su línea base, y la
  caracterización `37cc40c` fija ese comportamiento. Las pantallas con rango
  de fechas se cuentan por nombre de parámetro, como en el plan de la
  entrega 10: quedan 16 con `from`/`to` y 1 con `desde`/`hasta`.

Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0,
copias locales de conversión y formato 0, `FieldError` 12 e `import` de las
librerías de notificaciones en 2 archivos, medidos de nuevo.

Actualizado en el cierre de la 10.2 (2026-10-18) sobre `a4a5f9c`: pruebas
136 / 2.194 (la prueba de `DateRangeFields` en jsdom), y `npm run
refactor:inventory` analiza 622 archivos. Las demás filas no cambian: el
`fix` solo toca `DateRangeFields`.

Actualizado en la sub-entrega 10.3a (2026-10-18) sobre `c5e6f6b`:

- Pruebas: 143 / 2.286.
- La desviación baja a 22 (alta y edición de materiales) y los toggles que
  voltean el estado a 7: queda uno por archivo en 6 archivos, salvo uno con
  dos. `FieldError` baja a 11.
- El `<main>` anidado baja a 98 (la lista, el alta y la edición de
  materiales y las alertas) y los formularios GET a 30, con 21 combinaciones
  de clases: la barra de materiales pasa a `FilterBar`.
- Las dos filas nuevas se midieron sobre `49cf5f5`, su línea base: de los
  cuatro archivos de acciones de inventario sin caracterización quedan los
  de proveedores y materiales de proveedor (10.3b), y el alta de material
  era la única que decidía el kárdex y la alerta con los números del
  formulario.

Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0,
copias locales de conversión y formato 0, escrituras del kárdex con
`stock_anterior:` 6 e `import` de las librerías de notificaciones en 2
archivos, medidos de nuevo.

Actualizado en el cierre de la 10.3a (2026-10-19) sobre `9f484d2`: pruebas
143 / 2.289 (los 3 casos nuevos de `FilterBar` en jsdom), y `npm run
refactor:inventory` sigue analizando 637 archivos. Las demás filas no
cambian: el `fix` solo toca `FilterBarFields`.

Actualizado en la sub-entrega 10.3b (2026-10-19) sobre `2c0e3b5`:

- Pruebas: 151 / 2.451.
- La desviación baja a 18 (alta y edición de proveedores y de
  asociaciones) y los cambios de estado que voltean el estado a 5, en 4
  archivos (dos en productos). `FieldError` baja a 9.
- El `<main>` anidado baja a 92 (lista, alta y edición de proveedores y
  de asociaciones) y los formularios GET a 28, con 19 combinaciones de
  clases: las dos barras pasan a `FilterBar`.
- Los archivos de acciones de inventario sin caracterizar bajan a 0.

Las demás no cambian: páginas con Prisma directo 0, `auth()` directo 0,
copias locales de conversión y formato 0, pantallas con rango de fechas
sin `DateRangeFields` 17 (la 10.3c las mueve) e `import` de las librerías
de notificaciones en 2 archivos, medidos de nuevo.

El cierre de la 10.3b (2026-10-20) no cambia código: las métricas son las
de `2c0e3b5`.

Actualizado en la sub-entrega 10.3c (2026-10-21) sobre `3272901`:

- Pruebas: 152 / 2.476.
- El `<main>` anidado baja a 84 (las cuatro listas, el inicio, registrar
  salida, nueva compra y el detalle de compra) y los formularios GET a 24,
  con 16 combinaciones de clases: las cuatro barras pasan a `FilterBar`.
- Las pantallas con rango de fechas sin `DateRangeFields` bajan a 13.
- Las dos filas nuevas se midieron sobre `2d9ca08`, su línea base: 13
  listados cortaban el último día con `buildDateRangeFilter` y 4 con una
  copia local que corta a las `T23:59:59` (cuellos de botella, campañas,
  órdenes de trabajo y movimientos de caja); el maestro de taller veía 3
  tarjetas y «Ver compra» que lo rechazaban, y entradas, salidas y pagos a
  proveedores no tenían enlace.

Las demás no cambian: páginas con Prisma directo 0, copias locales de
`FieldError` 9 e `import` de las librerías de notificaciones en 2 archivos,
medidos de nuevo.

El cierre de la 10.3c (2026-10-21) no cambia código: las métricas son las
de `3272901`.

Actualizado en la sub-entrega 10.4a (2026-10-24) sobre `5b28b1e`:

- Pruebas: 160 / 2.603.
- La desviación baja a 16 (alta y edición de productos), en 8 archivos, y
  los cambios de estado que voltean el estado a 2, en 2 archivos (rutas de
  fabricación y etapas, 10.6). `FieldError` baja a 8.
- El `<main>` anidado baja a 80 (el inicio de Comercial y la lista, el alta
  y la edición de productos) y los formularios GET a 23, con 15
  combinaciones de clases: la barra de productos pasa a `FilterBar`.
- Las dos filas nuevas se midieron sobre `9c708a1`, su línea base: 5
  acciones de Comercial sin pruebas, y Pagos de cliente y Comprobantes de
  venta sin tarjeta en el inicio de Comercial (solo las enlazaba el inicio de
  Reportes, que es de ADMIN); ningún rol veía enlaces de Comercial que lo
  rechazaran.
- La desviación y los cambios de estado que voltean se cuentan con
  `tmp/e10-diff/count_104a_metrics.py`, que sobre `9c708a1` da las 18 y las
  5 registradas.

Las demás no cambian: páginas con Prisma directo 0, pantallas con rango de
fechas sin `DateRangeFields` 13 e `import` de las librerías de
notificaciones en 2 archivos, medidos de nuevo.

El cierre de la 10.4a (2026-10-26) no cambia código: las métricas son las
de `5b28b1e`.

Actualizado en la sub-entrega 10.4b (2026-10-27) sobre `9ba917b`:

- Pruebas: 160 / 2.626.
- El `<main>` anidado baja a 76 (las listas de pedidos, proformas, pagos de
  cliente y comprobantes) y los formularios GET a 19, con 13 combinaciones
  de clases: las cuatro barras pasan a `FilterBar`.
- Las pantallas con rango de fechas sin `DateRangeFields` bajan a 9.
- Las dos filas nuevas se midieron sobre `fd08d33`, su línea base: las 14
  pantallas que usaban `DateRangeFields` (los nueve reportes, auditoría
  incluida, el historial de exportaciones y cuatro listas de Inventario)
  perdían las fechas elegidas antes de hidratar, y `StatusBadge` se usaba
  en las listas de pedidos, proformas y comprobantes y en los detalles de
  pedido y proforma.

Las demás no cambian: la desviación 16, los cambios de estado que voltean
2, las copias locales de `FieldError` 8 y el `import` de las librerías de
notificaciones en 2 archivos, medidos de nuevo.

El cierre de la 10.4b (2026-10-27) no cambia código: las métricas son las
de `9ba917b`.

Actualizado en la sub-entrega 10.4c (2026-10-28) sobre `7d03553`:

- Pruebas: 165 / 2.750.
- La desviación baja a 14, en 7 archivos (alta y edición de pedidos;
  `count_104a_metrics.py`).
- El `<main>` anidado baja a 73 (alta, edición y detalle de pedido),
  contado con `git grep -l "<main"` en las `page.tsx` de `src/app` menos
  el login: 77 sobre `052e41d`.

Las demás no cambian: los cambios de estado que voltean 2, las copias
locales de `FieldError` 8 (el formulario de pedidos no tenía copia) y el
`import` de las librerías de notificaciones en 2 archivos, medidos de
nuevo, y los formularios GET 19, porque la sub-entrega no toca ninguno.

El cierre de la 10.4c (2026-10-29) no cambia código: las métricas son las
de `7d03553`.

Actualizado en la sub-entrega 10.5a (2026-10-29) sobre `a898729`:

- Pruebas: 175 / 2.883.
- La desviación baja a 10, en 5 archivos (alta y edición de máquinas y
  repuestos; `count_104a_metrics.py`).
- El `<main>` anidado baja a 67 (las listas, altas y ediciones de máquinas
  y repuestos) y los formularios GET a 17, con 11 combinaciones de clases:
  las dos barras pasan a `FilterBar`.
- Las copias locales de `FieldError` bajan a 6 (los formularios de máquina y
  repuesto).
- Las claves caracterizadas pasan a 128 / 128: se retira
  `machine-status-updated` (D4).
- Las dos filas nuevas se midieron sobre `24fe030`, su línea base: ninguno
  de los 5 archivos de acciones de Mantenimiento tenía pruebas propias, y el
  inicio mostraba al maestro de taller 4 tarjetas que lo rechazaban.

Las demás no cambian: los cambios de estado que voltean 2 según el script,
que no contaba los de máquinas y repuestos (hallazgo 6 de la 10.5a), y el
`import` de las librerías de notificaciones en 2 archivos, medidos de nuevo.

Actualizado en la sub-entrega 10.5b (2026-10-30) sobre `69f1b71`:

- Pruebas: 190 / 3.225.
- El `<main>` anidado baja a 60 (las listas y altas de fallas, preventivos y
  reparaciones, y reincidencias) y los formularios GET a 15, con 11
  combinaciones de clases (`count_105b_get_forms.py`).
- Las pantallas con rango de fechas sin `DateRangeFields` bajan a 7:
  preventivos y reparaciones.
- Los 3 archivos de acciones que faltaban en Mantenimiento quedan
  caracterizados. Las dos filas nuevas se midieron sobre `68b3258`, su línea
  base.

Las demás no cambian, medidas de nuevo: la desviación en 10, porque estas
acciones lanzaban y no usaban `useActionState`; las copias locales de
`FieldError` en 6; y los cambios de estado que voltean en 2.

Método de medición, para que `/verificar` y la línea base cuenten lo mismo:

- Las definiciones de `toNumber`, `formatMoney` y `formatDate` cuentan
  `function <nombre>` con cuerpo en todo `src`, incluida la definición
  compartida de `src/lib`. Las dos firmas de sobrecarga de `formatMoney`, sin
  cuerpo, no cuentan. Desde la entrega 3 hay 0 fuera de `src/lib`, que es lo que
  mide `/verificar`, y una regla de ESLint lo mantiene.
- Contar con grep o ripgrep. En PowerShell, `Select-String -Path` interpreta
  `[id]` y `[report]` como comodines y omite esos archivos sin avisar.
- Hasta la entrega 6, `sweetalert2` contaba los archivos que lo mencionan (uno
  era un comentario de `lib/security-headers.ts`). Desde la entrega 7 la fila
  cuenta declaraciones `import` de `sweetalert2` o `react-toastify`, también
  por subruta: las pruebas nombran ambas librerías en `vi.mock` y un `grep` de
  menciones da 6 archivos.
- Las operaciones sin bloqueo cuentan las funciones que leen un registro,
  validan con lo leído y escriben sobre él o sus hijos. Desde el grupo 1 cada
  una llama a una ayuda de `lib/row-locks.ts` dentro de su transacción: 14
  llamadas en el código de producción, una por operación.
- Las escrituras del kárdex cuentan los `stock_anterior:` de
  `movimiento_inventario` en el código de producción (6 desde el grupo 2) y,
  entre ellas, las que toman el valor de una lectura hecha antes de la
  escritura sin bloquear el material.
- Los enlaces a `/api/` con `next/link` cuentan las aperturas de `<Link>` cuyo
  `href` es una llamada a `buildReportExportHref` o una URL que empieza por
  `/api/`; desde el grupo 4 lo impone una regla de ESLint.
- Los reportes que exportan con otro filtro se miden con la paridad: la
  página real, su enlace «Exportar Excel» y la ruta deben dar el mismo `where`
  en la consulta principal (`screen-parity.test.ts` para los casos fijos y el
  diferencial del grupo 4 para la batería). Los nombres aceptados sin
  pantalla cuentan los parámetros que leen los exportadores y la validación
  de la ruta y que ninguna versión de la página del reporte genera (`git log
  -S` sobre la página).
- Las cargas de `usuario` completo cuentan la relación `usuario: true` bajo un
  `include`. Un `grep` de `usuario: true` también encuentra `id_usuario` y la
  columna `usuario` dentro de un `select`, que no cargan la fila completa.
- Los colores literales de los `.tsx` usan el patrón de la regla de ESLint
  (`colorLiteralPattern` en `eslint.config.mjs`: clases de la paleta de
  Tailwind, `bg-white` y `bg-black`, hexadecimales y funciones de color). Los
  de las hojas usan el de `tokens.test.ts` fuera de los bloques que definen
  tokens (`:root`, `.dark` y `@theme`) y sin contar `tokens.css`;
  `tmp/e8-diff/count_sheet_literals.py` los cuenta en cualquier commit.
- El adaptador `industrial-dark` cuenta sus reglas de primer nivel y sus
  selectores que empiezan por `.industrial-dark`.
- Los `<main>` anidados cuentan los `page.tsx` del grupo `(dashboard)` que
  contienen `<main`: todos se renderizan dentro del `<main>` de
  `dashboard-shell.tsx`.
- Los formularios GET cuentan los `<form>` sin `action` de función ni
  `method="POST"`, fuera de la galería y de las líneas de comentario, y sus
  `className` distintos (`tmp/e8-diff/audit_filters_c12.py`): 41 son barras
  de filtros y 2 piden parámetros (el mes del resumen de caja y la cantidad a
  fabricar de los requerimientos). El mensaje de `aada765` y la nota de la
  galería de ese commit decían 46 y 28: la auditoría contaba 4 menciones de
  `<form>` en comentarios de `submit-button.tsx` y `dialog.tsx`. La nota se
  corrigió en un commit aparte.

Las reglas de negocio permanecen en su implementación actual en la entrega 0.
La diferencia entre tarifa diaria y horaria sigue siendo una decisión pendiente
antes de unificar los cálculos de Personal y Costos.
