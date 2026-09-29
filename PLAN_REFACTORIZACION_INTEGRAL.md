# Plan de refactorización integral de SOFTINDUS

Estado: ejecución secuencial iniciada el 2026-09-25. La base técnica de la fase 0 está implementada y validada localmente; la comprobación en CI desde una copia limpia queda pendiente de publicar los cambios. El alcance y los resultados de cada entrega se registran en [el seguimiento](docs/refactoring/SEGUIMIENTO.md). Las fases posteriores siguen pendientes. El 2026-09-28 se ajustó la secuencia: el orden vigente está en la [sección 16](#16-ajustes-de-secuencia-2026-09-28).

## 1. Objetivo y alcance

Hacer que el ERP sea más sencillo de usar, mantener y ampliar, con comportamiento consistente entre módulos. El resultado debe permitir cambiar un componente, una regla visual o un mecanismo transversal desde su lugar responsable y propagar esa mejora a sus consumidores.

Incluye arquitectura, componentes, formularios en ventanas, eventos, notificaciones, confirmaciones, estilos, navegación, errores, permisos, validación, consultas, reportes, pruebas y documentación. Se conserva el stack actual y se migra por funcionalidades completas.

Los cambios de reglas de negocio se documentarán y entregarán separados de las extracciones de código. La planificación no requiere desplegar, modificar bases de datos ni actualizar dependencias mayores.

## 2. Diagnóstico comprobado

| Evidencia de la revisión | Consecuencia para el plan |
|---|---|
| 127 páginas; 117 contienen llamadas a Prisma | Separar progresivamente consultas y composición de interfaz. La cifra describe acoplamiento, no demuestra por sí sola un fallo. |
| Exportaciones: 1.499 líneas; acciones de órdenes de trabajo: 1.055; detalle de costeo: 1.026 | Priorizar separación por responsabilidad y flujo. |
| Ya existen `components/ui`, permisos, logger, errores, formatos y validadores | Evolucionar esas bases y evitar crear sistemas paralelos. |
| `lib/notifications.ts` encapsula Toastify y SweetAlert2; los mensajes de redirección viven en `NotificationQueryBridge` | Separar catálogo de mensajes, presentación y compatibilidad con redirecciones. |
| Algunos formularios muestran alerta y toast para el mismo error | Definir un único responsable de comunicar cada resultado. |
| `globals.css` contiene variables semánticas, adaptaciones de librerías y reglas que sobrescriben colores bajo `.industrial-dark` | Completar los tokens y retirar sobrescrituras gradualmente. |
| El progreso de navegación modifica globalmente `window.fetch` | Revisar su alcance y migrar a estados explícitos de navegación y envío. |
| Hay llamadas a `revalidatePath` repetidas en acciones de distintos módulos | Crear políticas de invalidación por operación con dependencias explícitas. |
| El workflow de CI existe localmente, pero está ignorado y no versionado | Recuperar validación reproducible desde una copia limpia. |
| La revisión anterior de esta tarea ejecutó 203 pruebas en 18 archivos con éxito; lint produjo 0 errores y 8 advertencias en temporales | Usar como línea base; todavía falta comprobar build, tipos, integración y recorridos completos en la fase inicial. |
| Planillas interpreta `operario.tarifa` por día y costeo por hora | Resolver la unidad antes de unificar esas reglas. |

Los números corresponden a la revisión de esta conversación. No se verificó el estado remoto de CI ni se realizó una auditoría funcional exhaustiva de todos los módulos.

## 3. Arquitectura y límites de responsabilidad

| Ubicación | Responsabilidad objetivo |
|---|---|
| `src/app` | Rutas, layouts, composición, carga, errores de ruta y adaptación HTTP. |
| `src/modules/<dominio>/<funcionalidad>` | Componentes específicos, consultas, acciones y operaciones del negocio. |
| `src/components/ui` | Primitivas visuales compartidas. |
| `src/components/forms`, `table`, `navigation`, `feedback` | Patrones reutilizables de interacción. |
| `src/lib` | Infraestructura común: conexión, autorización, logger, errores y formatos. |
| `src/styles` | Tokens, base, patrones compartidos, impresión y adaptadores temporales de terceros. |

Para una funcionalidad que lo necesite: `actions.ts`, `queries.ts`, `service.ts`, `schema.ts`, `types.ts`, `components/` y pruebas cercanas al comportamiento probado. Los archivos se crean cuando tienen una responsabilidad real. Los schemas actuales pueden seguir en su ubicación durante la transición; su traslado no será requisito previo.

Reglas de dependencia:

- Las páginas llaman consultas autorizadas y componen componentes.
- Las Server Actions autentican y autorizan, validan entradas, llaman operaciones y adaptan su resultado.
- Los servicios reciben un actor verificado y comprueban reglas y acceso a los recursos; realizan transacciones sin depender de React, toasts o redirecciones.
- Las consultas de servidor devuelven los datos mínimos necesarios. Los objetos internos de Prisma no se exponen íntegros al navegador.
- Una operación que toca varios dominios tiene un orquestador explícito y un propietario de la transacción. Las funciones internas reciben el cliente transaccional cuando corresponda.
- Los módulos consumen interfaces públicas de otros módulos. Se evitan dependencias circulares y wrappers genéricos que solo renombren métodos de Prisma.
- Se conservan las comprobaciones de permisos en el servidor aunque un botón esté oculto en la interfaz.

## 4. Sistema visual compartido

Completar los tokens existentes: fondo, superficie, texto, borde, primario, éxito, advertencia, peligro, información, foco, espaciado, tipografía, radios, sombras, capas y movimiento.

Separar la hoja global por responsabilidad sin cambiar arbitrariamente la prioridad de sus reglas. Sustituir colores literales y sobrescrituras como `.industrial-dark .bg-white` conforme se migren sus consumidores. Mantener la identidad actual; el selector de temas es una ampliación opcional.

Componentes a normalizar:

| Familia | Contrato común |
|---|---|
| Botones | Jerarquía visual, tamaños, iconos, estados pendientes y deshabilitados; texto accesible en acciones con solo icono. |
| Campos | Etiqueta, ayuda, obligatorio, error asociado, solo lectura, deshabilitado y formatos. |
| Feedback | Alertas persistentes, notificaciones temporales, confirmaciones y estados vacíos. |
| Ventanas | Modal, panel lateral, encabezado, área desplazable y pie de acciones. |
| Listados | Barra de filtros, tabla, acciones por fila, paginación, carga y resultados vacíos. |
| Presentación | Cabeceras, tarjetas, indicadores, separadores y etiquetas de estado. |

Crear una galería de componentes para desarrollo con los estados normales, de carga, error, teclado y móvil. Puede ser una ruta local protegida o un entorno de desarrollo específico; no exige añadir otra herramienta al inicio.

La semántica de los estados pertenece al dominio: dos entidades con estados llamados “cerrado” no necesariamente comparten sus reglas. El componente de etiqueta comparte apariencia, mientras cada módulo define significado y transiciones.

## 5. Formularios como ventanas y paneles

| Presentación inicial | Usos propuestos |
|---|---|
| Modal breve | Categorías, tipos de proveedor, restablecer contraseña, pago simple y devolución puntual. |
| Panel lateral amplio | Clientes, proveedores, materiales, productos, operarios y máquinas. |
| Superficie amplia | Compras y pedidos con líneas, órdenes complejas y operaciones con varias secciones que requieren comparar datos. |

Validar cada clasificación en el piloto según cantidad de campos, tablas, dependencia entre datos y frecuencia de uso. Una superficie amplia puede ser una ventana expandida cuando conserve buena legibilidad. En móvil, los formularios se presentan a pantalla completa.

Comportamiento compartido:

- Abrir desde el listado sin perder filtros, página, orden ni posición de desplazamiento.
- Usar el mismo formulario en ventana y ruta directa, sin duplicar validación ni operación de guardado.
- Mantener URL para altas y ediciones relevantes. Probar rutas interceptadas y paralelas en Clientes; el acceso directo o la recarga puede renderizar la página completa del mismo formulario.
- Definir un destino de regreso seguro cuando no exista un listado previo. Validar cualquier `returnTo` como ruta interna permitida.
- Mantener visibles Guardar y Cancelar; mostrar “Guardando…” durante el envío y evitar doble envío desde la interfaz.
- Conservar datos y enfocar el primer campo inválido al fallar. Los errores generales permanecen dentro del formulario.
- Tras éxito confirmado, actualizar el listado, cerrar y mostrar un aviso único. Si el registro no coincide con los filtros activos, explicar dónde encontrarlo sin borrar los filtros.
- Diferenciar “guardado correcto, actualización del listado fallida” de “guardado fallido”, para no inducir a repetir operaciones ya confirmadas.
- Proteger cambios pendientes al cerrar, navegar o salir; documentar las limitaciones del navegador. Evaluar borradores de servidor para formularios extensos en una entrega separada.
- Permitir Cancelar, cierre y teclado; el intento de cierre con cambios requiere decidir si descartarlos. Gestionar foco, lectores de pantalla y movimiento reducido.
- Evitar cadenas de ventanas apiladas. Las altas auxiliares preservan el formulario principal y seleccionan el registro recién creado.

La apertura del formulario no cambia su autorización: URL directa, consulta y mutación deben respetar los mismos permisos.

## 6. Centralización de eventos y estado

Centralizar significa establecer contratos, responsables y canales claros. El estado de un campo o un clic local sigue en su componente; los datos del listado pertenecen al servidor y los filtros compartibles a la URL.

| Tipo | Ejemplo | Responsable y mecanismo |
|---|---|---|
| Interacción local | Abrir formulario, cambiar pestaña | Estado React y callbacks del componente. |
| Resultado de operación | Cliente creado o datos inválidos | Respuesta tipada de la acción; el controlador del formulario la consume. |
| Navegación y sesión | Transición iniciada, inactividad | Adaptadores compartidos y suscripciones con limpieza. |
| Hecho de negocio | Pago registrado, material entregado | Servicio de servidor, con datos del actor y operación. |
| Actualización de vistas | Cambió stock o saldo | Política de invalidación de servidor asociada a la operación. |

Definir un catálogo tipado por dominio para los eventos realmente necesarios, con nombre estable, identificador de operación y carga mínima. Usar discriminantes verificables y evitar cadenas sueltas distribuidas por la aplicación.

Decisiones de diseño:

- Preferir resultados y llamadas explícitas cuando emisor y receptor tienen una relación directa.
- Usar un canal compartido solo para consumidores independientes. No hacer pasar cada clic por un bus global.
- Mantener stock, saldos, correlativos y auditoría obligatoria en la transacción del servidor. Un listener del navegador no ejecuta esas reglas.
- Emitir señales de éxito después de confirmar la transacción. Un fallo de una notificación no convierte un guardado correcto en un error de negocio.
- Una señal en memoria no garantiza entrega tras terminar una petición. Si aparecen efectos asíncronos que deben sobrevivir fallos, diseñar un registro transaccional de eventos pendientes y un consumidor con reintentos e idempotencia como ampliación explícita.
- No usar eventos para replicar una segunda copia global de todos los datos de Prisma.

Revisar el progreso actual: trasladar el estado pendiente de formularios a sus controladores y medir navegación mediante su adaptador. Retirar el parche global de `fetch` cuando exista cobertura equivalente. Conservar o aislar el puente entre la instrumentación y el árbol de componentes si sus límites de empaquetado lo requieren.

## 7. Notificaciones, alertas y confirmaciones

| Situación | Presentación propuesta |
|---|---|
| Campo inválido | Mensaje junto al campo, sin toast duplicado. |
| Error del formulario | Alerta persistente dentro de la ventana y datos conservados. |
| Operación correcta | Un aviso temporal después de confirmar el guardado. |
| Acción con consecuencias importantes | Confirmación con entidad, consecuencia y verbo concreto. |
| Operación pendiente | Estado del botón o sección afectada. |
| Sesión vencida o servicio no disponible | Mensaje persistente y ruta clara para recuperar el trabajo. |

Evolucionar `lib/notifications.ts` hacia una fachada común: notificar, confirmar y comunicar errores, sin importar directamente librerías desde cada módulo. Extraer el catálogo hoy embebido en `NotificationQueryBridge` a definiciones tipadas por módulo, reunidas en un registro común.

Usar identificadores de operación para evitar duplicados sin ocultar dos operaciones legítimas consecutivas del mismo tipo. El catálogo decide severidad y mensaje; ningún texto de éxito se interpreta como prueba de autorización o de una operación realmente ejecutada.

Mantener el puente `?toast=` como adaptador de compatibilidad mientras existan páginas antiguas. Los formularios en ventanas usarán el resultado de la acción. Retirarlo cuando no tenga consumidores y comprobar Atrás, Adelante y recarga.

Recomendación inicial de dependencias: conservar Toastify detrás de la fachada y construir confirmaciones/modal/panel sobre los componentes accesibles de la base Radix/shadcn existente. Retirar SweetAlert2 solamente después de migrar todos sus consumidores y verificar paridad.

Un centro persistente de notificaciones con leídas/no leídas es una funcionalidad adicional: requiere modelo de datos, destinatarios, permisos, caducidad y política de lectura. Dejarlo como ampliación; las alertas operativas existentes pueden normalizar su presentación en este plan.

## 8. Contratos de acciones, errores y validación

Establecer un resultado discriminado: éxito con datos mínimos, código de mensaje e identificador de operación; fallo con código, mensaje seguro y errores por campo. Los fallos inesperados generan una referencia de diagnóstico y detalle redactado en el logger.

Las ventanas reciben resultados sin redirección obligatoria. Los flujos de página pueden tener un adaptador que redirija después del éxito. No capturar redirecciones del framework como errores de negocio.

Reutilizar Zod, `authz.ts`, `errors.ts` y `logger.ts`. Unificar el tratamiento de duplicados, recurso inexistente, falta de permisos, conflicto de estado, validación y fallo interno, respetando mensajes específicos de cada operación.

Consolidar fechas, cantidades, moneda, porcentajes, parámetros de búsqueda y valores vacíos. Distinguir fechas civiles de instantes y conservar la zona horaria de negocio. Revisar precisión y redondeo de importes antes de cambiar cálculos; las reglas nuevas llevan pruebas con valores históricos representativos.

## 9. Navegación, consultas, tablas y reportes

- Evolucionar el registro de rutas existente para enlaces, regreso, breadcrumbs y menús. La visibilidad del menú deriva de permisos, pero no reemplaza autorización en servidor.
- Compartir estructura de filtros y paginación con estado en URL. Mantener componentes de tabla composables, con columnas y acciones del módulo.
- Extraer consultas de páginas, limitar columnas y relaciones obtenidas, y devolver modelos adecuados a cada vista.
- Definir invalidación por operación: listado, detalle y resúmenes afectados, incluyendo dependencias entre módulos. Ejecutarla después del commit y probar que el navegador observa el resultado actualizado.
- Dividir exportaciones por reporte usando el registro existente; compartir filtros y significado de datos entre pantalla y archivo, manteniendo sus distintos límites y paginación.
- Separar datos, cálculo y presentación en costeo, resúmenes y dashboards.
- Medir consultas y tiempos antes de introducir caché adicional o índices. Validar permisos en cualquier estrategia de caché de datos privados.
- Normalizar impresión de documentos y estilos de PDF/Excel para que el tema de la aplicación no determine la legibilidad del documento.

## 10. Integridad, permisos y trazabilidad

Preservar bloqueos y transacciones de inventario, generación segura de correlativos, revalidación de sesión y reglas de transiciones de estado. Revisar orden de bloqueos en operaciones concurrentes y mantenerlo consistente.

Definir qué operaciones requieren auditoría atómica. Actualmente la bitácora puede formar parte de la transacción o registrarse por separado; documentar la política por operación antes de cambiarla. Correlacionar logs técnicos con el identificador de operación, sin incluir contraseñas ni cuerpos completos de formularios.

Deshabilitar Guardar ayuda a la interfaz, pero no evita por sí solo duplicados en el servidor. Para pagos, compras y movimientos críticos, evaluar y probar claves idempotentes, restricciones únicas y tratamiento de conflictos. Cualquier cambio de esquema se entrega con su migración específica.

Resolver la unidad de tarifa de operarios antes de unificar personal y costos. Identificar por separado otras decisiones de negocio pendientes, como reserva de stock y procesos por lote; su existencia no impide avanzar en componentes, reportes o catálogos.

## 11. Fases, entregables y dependencias

> Nota 2026-09-28: esta tabla conserva el diseño original. El orden de ejecución vigente, con la separación en pista estructural y pista de experiencia de usuario, está en la sección 16.

| Fase | Prioridad y dependencia | Entregable revisable | Criterio de cierre |
|---|---|---|---|
| 0. Línea base | P0; inicio | Inventario de pantallas/formularios, CI versionado, validaciones y datos de prueba | Una copia limpia ejecuta lint, tipos, validación Prisma, pruebas y build; temporales fuera de esos alcances. |
| 1. Contratos | P0; fase 0 | Decisiones de arquitectura, resultado de acciones, eventos, errores y permisos | Un flujo de ejemplo tiene responsables claros de guardar, invalidar, notificar y navegar. |
| 2. Base visual e interacción | P1; fase 1 | Tokens, botones, campos, alertas, ventanas, confirmaciones y galería | Estados verificados en escritorio, móvil y teclado; adaptadores compatibles con pantallas antiguas. |
| 3. Piloto completo | P1; fase 2 | Clientes en panel lateral y una categoría en modal; consulta/servicio separados | Crear, editar, validar, cancelar y volver funcionan sin duplicados ni pérdida de contexto. |
| 4. Catálogos y listados | P1; piloto validado | Proveedores, materiales, productos y catálogos migrados | Uso del patrón compartido, rutas directas operativas y regresión por rol aprobada. |
| 5. Reportes y consultas complejas | P1; fase 1 y piloto | Proveedores por reporte, filtros compartidos, dashboards y costeo separados | Paridad de datos y filtros, límites de exportación y permisos preservados. |
| 6. Operaciones críticas | P0 por riesgo; piloto y pruebas de integración | Producción/inventario y luego compras/pagos/caja con servicios y transacciones explícitos | Casos concurrentes, rollback y doble envío comprobados; auditoría y saldos consistentes. |
| 7. Resto de dominios | P1; patrones y dependencias funcionales resueltos | Personal, mantenimiento, mermas, costos, usuarios y flujos restantes migrados | Lista de cobertura completa por formulario, rol y operación. |
| 8. Consolidación | P1; anteriores | Código antiguo retirado, medición final, documentación y manual breve | Sin consumidores de mecanismos obsoletos; criterios globales cumplidos. |

Cada fase se divide en PR pequeños. La prioridad P0 de operaciones críticas indica el nivel de control requerido, no que se deban migrar antes del piloto. Se actualiza el inventario al cerrar cada flujo.

La estimación de esfuerzo se hace por flujo después de la fase 0 y se calibra con el piloto. El costo depende de integración de pruebas, cantidad real de variantes y decisiones funcionales; no se fija una fecha de todo el ERP sin esa evidencia.

## 12. Validación y criterios globales de aceptación

| Nivel | Qué comprobar |
|---|---|
| Unitarias | Reglas puras, validadores, filtros, fechas, dinero, transiciones y contratos. |
| Integración con PostgreSQL aislado | Transacciones, permisos, conflictos, correlativos, stock, saldos, auditoría e idempotencia donde aplique. |
| Componentes | Apertura, foco, pendientes, errores, cambios sin guardar y cierre de formularios. |
| Recorridos completos | Login y roles; Cliente en panel; categoría en modal; compra; pago; entrega/devolución/cierre de orden; exportación. |
| Visual y accesibilidad | Galería de estados, contraste, foco visible, lectores de pantalla, móvil, zoom, movimiento reducido e impresión. |
| Rendimiento | Consultas por pantalla, tiempos de carga/guardado/exportación y recursos del navegador con datos comparables. |

Criterios medibles:

- Cada formulario inventariado tiene propietario, presentación elegida y estado de migración.
- Los módulos migrados usan los componentes, tokens y fachada de feedback compartidos, salvo excepciones justificadas.
- Un éxito produce como máximo un toast por operación; los errores de campo no producen un segundo mensaje genérico innecesario.
- Guardar conserva filtros y contexto; Cancelar no escribe; un error conserva lo introducido; un guardado confirmado no se reenvía por un fallo de refresco.
- Acceso directo, recarga, Atrás y Adelante tienen pruebas para el patrón de ventanas adoptado.
- Un usuario sin permisos no ejecuta una acción mediante petición directa.
- Los flujos críticos mantienen sus invariantes bajo concurrencia y fallos intermedios.
- Las páginas migradas componen consultas y vistas sin contener mutaciones de negocio ni consultas Prisma directas.
- Se registra la línea base de rendimiento y se acuerdan umbrales con ella. Cualquier empeoramiento significativo se investiga antes de ampliar el despliegue.
- El cierre conserva como mínimo las pruebas existentes y añade pruebas útiles de los riesgos migrados; el porcentaje de cobertura no reemplaza esa evidencia.

## 13. Entrega gradual y reversión

Usar adaptadores temporales para acciones y notificaciones antiguas. Mantener un único formulario y servicio por operación aunque tenga presentación en página y ventana. Conservar las rutas actuales durante la transición.

Probar cada entrega con datos aislados y luego en staging. Para cambios grandes, habilitar por módulo mediante una configuración sencilla si hace falta. La reversión inicial debe poder recuperar la presentación anterior sin revertir datos.

Separar migraciones de esquema, reparación de datos y cambios de reglas. Para migraciones necesarias, usar cambios compatibles con ambas versiones y documentar recuperación; no asumir que revertir código revierte la base.

Documentar en cada PR: comportamiento afectado, compatibilidad, pruebas ejecutadas, impacto entre módulos y estrategia de reversión. Evitar mezclar actualizaciones mayores de dependencias con una migración funcional.

## 14. Primer paquete de trabajo

- [ ] Confirmar el inventario de formularios, rutas, estados y componentes duplicados.
- [ ] Versionar CI y definir comprobaciones reproducibles sin tocar producción.
- [ ] Documentar contratos de acciones, notificaciones e invalidación.
- [ ] Consolidar tokens y componentes mínimos: botón, campo, alerta, modal, panel y confirmación.
- [ ] Extraer el catálogo de mensajes y preparar compatibilidad con las notificaciones actuales.
- [ ] Crear el piloto de Clientes y categoría con pruebas de interacción y permisos.
- [ ] Medir pasos, tiempo de tarea y conservación de contexto respecto del flujo actual.
- [ ] Ajustar patrones y estimaciones antes de migrar todos los módulos.

## 15. Referencias de implementación

Para APIs y convenciones se debe consultar primero la documentación de la versión instalada en `node_modules/next/dist/docs/`, como exige `AGENTS.md`. Se revisaron las guías locales de seguridad de datos, mutaciones, rutas interceptadas y paralelas.

Las rutas interceptadas permiten abrir contenido en una ventana durante navegación interna y conservar una representación de página para acceso directo; el comportamiento de recarga se debe probar explícitamente. Referencia: [Next.js: Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes).

Los diálogos modales requieren foco contenido, nombre accesible, operación con teclado y devolución de foco al cerrar. Referencia: [W3C: Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 16. Ajustes de secuencia (2026-09-28)

Tras contrastar el plan con el código de `staging` se aprobaron cuatro ajustes. No cambian los objetivos ni la arquitectura de las secciones 3 a 10; cambian el orden y la separación de riesgos.

### 16.1 Motivos

| Ajuste | Evidencia | Razón |
|---|---|---|
| Corregir el stock de compras antes de refactorizar | `inventory/purchases/actions.ts` lee `stock_actual`, suma en JavaScript y escribe el resultado en `createPurchaseAction` y `annulPurchaseAction`. | Es un defecto de actualización perdida bajo concurrencia, no una mejora de estructura. Se corrige en una entrega `fix` aislada y no espera a la fase de operaciones críticas. |
| Centralizar la autorización en la entrega de contratos | 23 archivos de `src/modules` llaman a `auth()` y comparan el rol a mano; `getAuthorizedSession` ya existe en `lib/authz.ts`. | Un solo punto de control revalida el usuario activo y se audita una vez. Una regla de ESLint evita que el patrón vuelva. |
| Separar pista estructural (A) y pista de experiencia de usuario (B) | Formularios en ventanas, rutas interceptadas y galería cambian lo que ve el usuario. | La pista A no cambia comportamiento y se valida con pruebas automáticas. La pista B requiere pruebas manuales, validación del cliente y actualización del manual de usuario. Mezclarlas multiplica el riesgo. |
| Versionar las instrucciones para agentes | `CLAUDE.md`, `AGENTS.md` y `.claude/` estaban excluidos en `.gitignore`. | El equipo trabaja con las mismas reglas y comandos (`/entrega`, `/verificar`). |

### 16.2 Orden vigente

| # | Pista | Entrega | Criterio de cierre |
|---|---|---|---|
| 0 | Base | Validación, inventario, CI y configuración de Claude Code | CI en verde en GitHub; `CLAUDE.md` y comandos versionados. |
| 1 | Fix | Stock atómico en compras y anulación de compras | Escritura con `increment`/`decrement` dentro de la transacción; prueba que lo demuestra; compra y anulación verificadas en staging. |
| 2 | A | Contratos: resultado de acciones y autorización centralizada | 0 archivos de `src/modules` con `auth()` directo; regla de ESLint activa; permisos por rol sin cambios. |
| 3 | A | Conversión y formatos compartidos | Una sola definición de `toNumber`, `formatMoney` y `formatDate` en `src/lib`, con pruebas. |
| 4 | A | Consultas fuera de las páginas, por área (piloto: Clientes) | Disminuye en cada entrega el número de páginas con Prisma directo. |
| 5 | A | Exportaciones por reporte | `route.ts` de exportación dividido en un registro de exportadores; archivos exportados idénticos. |
| 6 | A | Órdenes de trabajo y costeo por caso de uso | `work-orders/actions.ts` y el detalle de costeo divididos; pruebas de producción en verde. |
| 7 | A | Fachada de notificaciones | Ningún módulo importa SweetAlert2 ni Toastify directamente. |
| 8 | B | Base visual y galería (fase 2 original) | Según sección 11. |
| 9 | B | Piloto Clientes y categoría en ventanas (fase 3 original) | Según sección 11. |
| 10 | B | Catálogos, listados y resto de dominios (fases 4 y 7 originales) | Según sección 11. |
| 11 | — | Operaciones críticas con pruebas de integración e idempotencia (fase 6 original) y consolidación (fase 8) | Según sección 11. |

### 16.3 Forma de trabajo

- Se trabaja directamente sobre la rama `staging`, con commits pequeños y un cambio lógico por commit. `main` sigue siendo producción y recibe los cambios por PR desde `staging`.
- Cada entrega se inicia en Claude Code con `/entrega <número - nombre>`, que obliga a auditar, proponer un plan y esperar aprobación antes de editar.
- `npm run check` debe terminar en verde antes de cada commit. `/verificar` mide las métricas de la línea base registrada en `docs/refactoring/SEGUIMIENTO.md`.
- La reversión se hace con `git revert <commit>`; por eso no se mezclan en un mismo commit cambios de estructura y de comportamiento.
