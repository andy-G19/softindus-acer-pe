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
| 10.3 | Inventario | ADMIN | Proveedores, materiales y materiales de proveedor; atender alerta; listados | 5 h |
| 10.4 | Comercial | ADMIN y SELLER; productos, solo ADMIN | Productos y pedidos; inactivar con confirmación; listados con `Badge` | 5 h |
| 10.5 | Mantenimiento | ADMIN; fallas, también WORKSHOP_MASTER | Máquinas, repuestos, fallas, preventivos y reparaciones; cambios de estado | 8 h |
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
| Proveedores | Inventario | ADMIN | Páginas, desviación | Panel lateral | 10.3 | Pendiente |
| Materiales | Inventario | ADMIN | Páginas, desviación; el alta escribe el kárdex inicial y la alerta de stock | Panel lateral | 10.3 | Pendiente |
| Materiales de proveedor | Inventario | ADMIN | Páginas, desviación | Panel lateral | 10.3 | Pendiente |
| Productos | Comercial | ADMIN | Páginas, desviación | Panel lateral | 10.4 | Pendiente |
| Pedidos | Comercial | ADMIN, SELLER | Páginas con líneas, desviación | Superficie amplia | 10.4 | Pendiente |
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
| 10.3 | Inactivar proveedor, material y material de proveedor; atender alerta de stock |
| 10.4 | Inactivar cliente, producto y categoría de producto |
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

Fecha: 2026-10-17. Estado: hecha en local; la publicación y la verificación
en staging se registran en el cierre. El paso 0 (`23f2827`) registró la
integración de la 10.1 en `main`. 10 commits, de `871fb5a` a `9d70f59`, más
este registro:

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
| este | docs | Registro de la sub-entrega, `CLAUDE.md`, inventario y capítulo de Reportes del manual. |

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
| 10 | B | Catálogos, listados y resto de dominios | En curso (plan aprobado el 2026-10-15: 8 sub-entregas; 10.1 cerrada, con CI #79 verde en main y 17 de 17 huellas explicadas en staging; 10.2 hecha en local, falta la verificación en staging) |
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
| Claves `?toast=` caracterizadas (texto, severidad y HTML) | 0 / 124 | 129 / 129 | 7, G3, 9 y 10 |
| Claves emitidas sin entrada / entradas sin emisor no declaradas, comprobado por prueba | sin control | 0 / 0 | 7 |
| Archivos de prueba / pruebas aprobadas | 18 / 203 | 135 / 2.189 | todas |
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
| Copias locales de `FieldError` | 16 | 12 | 9 y 10 |
| Páginas con un `<main>` dentro del `<main>` del shell | 113 | 102 | 9 y 10 |
| Combinaciones de clases distintas en los formularios GET (43 al medir la línea base) | 27 | 22 (31 formularios) | 9 y 10 |
| Acciones de alta y edición de Clientes y categorías de producto caracterizadas | 0 / 4 | 4 / 4 | 9 |
| Funciones de `useActionState` que redirigen al negar el permiso (desviación conocida) | 30 | 24 | 10 |
| Acciones de activar e inactivar que leen el estado y escriben el contrario | 11 | 8 | 10 |
| Utilidades CSS sin consumidores sacadas de documentación o del gestor viejo | 7 | 0 | 10 |
| Pantallas de reportes que consultan con el rango invertido / que ofrecen exportar un rango que la ruta rechaza | 10 / 9 | 0 / 0 | 10 |
| Pantallas con rango de fechas sin `DateRangeFields` | 27 | 17 | 10 |

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
