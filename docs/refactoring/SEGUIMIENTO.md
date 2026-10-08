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

## Secuencia de próximas entregas

Orden vigente desde el 2026-09-28 (detalle y motivos en la sección 16 del plan).
Pista A: estructura sin cambios de comportamiento. Pista B: experiencia de usuario.

| # | Pista | Entrega | Estado |
|---|---|---|---|
| 0 | Base | Validación, inventario, CI y configuración de Claude Code | Cerrada (CI #19 verde, staging Ready) |
| 1 | Fix | Stock atómico en compras y anulación | Cerrada (CI #21 verde, staging verificado) |
| 2 | A | Contratos: resultado de acciones y autorización centralizada | Cerrada (CI #25 verde, staging verificado) |
| 3 | A | Conversión y formatos compartidos | Cerrada (CI #29 verde, staging verificado con ADMIN) |
| 4 | A | Consultas fuera de las páginas, por área | Cerrada (CI #36 verde en main, staging verificado) |
| 5 | A | Exportaciones por reporte | Cerrada (CI #39 verde en main, verificada en producción) |
| 6 | A | Órdenes de trabajo y costeo por caso de uso | Cerrada (CI #43 verde en main, staging verificado con ADMIN) |
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
| Archivo más grande (`api/reports/export/[report]/route.ts`) | 1.499 líneas | 186 | 5 |
| `production/work-orders/actions.ts` | 1.055 líneas | 240 | 6 |
| `costs/costings/[id]/page.tsx` | 1.026 líneas | 110 | 6 |
| Páginas con Prisma directo | 117 | 0 | 4, 5 y 6 |
| Archivos de `src/modules` con `auth()` directo | 23 | 0 | 2 |
| Acciones de `src/modules` que comparan el rol a mano | 41 | 0 | 2 |
| Definiciones de la forma de estado de formulario | 18 | 1 | 2 |
| Definiciones locales de `toNumber` | 52 | 1 | 3 |
| Definiciones locales de `formatMoney` | 49 | 1 | 3 |
| Definiciones locales de `formatDate` | 52 | 1 | 3 |
| Archivos que importan `sweetalert2` | 2 | 2 | 7 |
| Archivos de prueba / pruebas aprobadas | 18 / 203 | 91 / 1.212 | todas |
| Escrituras de stock no atómicas en compras | 2 | 0 | 1 |
| Cargas de `usuario` completo en reportes y exportación | 15 | 0 | 5 |
| Comparaciones de rol a mano en la exportación | 1 | 0 | 5 |
| Acciones de órdenes de trabajo y costos caracterizadas | 0 / 15 | 15 / 15 | 6 |
| Fórmulas de costeo repetidas entre el detalle y las acciones | 3 | 0 | 6 |
| Cargas de `usuario` completo en órdenes de trabajo y costos | 5 | 0 | 6 |

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
- Las cargas de `usuario` completo cuentan la relación `usuario: true` bajo un
  `include`. Un `grep` de `usuario: true` también encuentra `id_usuario` y la
  columna `usuario` dentro de un `select`, que no cargan la fila completa.

Las reglas de negocio permanecen en su implementación actual en la entrega 0.
La diferencia entre tarifa diaria y horaria sigue siendo una decisión pendiente
antes de unificar los cálculos de Personal y Costos.
