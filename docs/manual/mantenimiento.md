# Manual de usuario — Mantenimiento

Este capítulo describe todas las pantallas de Mantenimiento. Las reglas
comunes (ventanas, guardar, cancelar, inactivar, cambiar el estado y filtros)
están en [Cómo funcionan las pantallas](00-patrones.md).

## Inicio de Mantenimiento

**Dónde:** Mantenimiento, en el menú.
**Quién:** el administrador (ADMIN) y el maestro de taller
(WORKSHOP_MASTER).

Arriba están los indicadores: máquinas registradas, máquinas operativas,
fallas abiertas y preventivos pendientes, y debajo el costo de las
reparaciones del mes. Después, una tarjeta por pantalla:

1. Máquinas
2. Fallas
3. Repuestos
4. Reparaciones
5. Preventivos
6. Reincidencias

Cada usuario ve solo las tarjetas de las pantallas que puede abrir: el
maestro de taller ve Máquinas y Fallas.

## Máquinas

**Dónde:** Mantenimiento → Máquinas.
**Quién:** el administrador (ADMIN) las registra, edita, inactiva y activa;
el maestro de taller (WORKSHOP_MASTER) solo las consulta.

La lista muestra, por máquina, el código, el tipo, la ubicación, el código
interno, la fecha de registro, cuántas fallas, preventivos y etapas de
producción tiene y su estado. Se puede filtrar por texto (nombre o código
interno), tipo, ubicación y estado.

Una máquina puede estar:

- **Operativa:** disponible para producción.
- **En mantenimiento:** en reparación.
- **Fuera de servicio:** dada de baja.
- **Inactiva:** fuera de operación.

Acciones:

- **Registrar:** pulsa **Registrar máquina**. El panel pide el nombre, el
  tipo, el código interno, la ubicación, el estado (empieza en «Operativa»)
  y las observaciones. Pulsa **Registrar maquina**.
  - No puede haber dos máquinas con el mismo nombre y tipo, ni con el mismo
    código interno: el sistema lo avisa junto al nombre y conserva lo
    escrito.
- **Editar:** pulsa **Editar** en la fila. Desde la edición se puede poner
  cualquiera de los cuatro estados.
- **Inactivar:** pulsa **Inactivar** y confirma. Se puede inactivar una
  máquina operativa, en mantenimiento o fuera de servicio. Mientras esté
  inactiva:
  - no se pueden registrar fallas sobre ella;
  - no se puede asignar a etapas de producción;
  - no cuenta como operativa en el inicio de Mantenimiento.

  Sus fallas, preventivos, reparaciones y etapas se conservan.
- **Activar:** una máquina inactiva muestra **Activar**, que se aplica al
  pulsar y la deja **operativa**.

## Repuestos

**Dónde:** Mantenimiento → Repuestos.
**Quién:** solo el administrador (ADMIN).

La lista muestra, por repuesto, el código, el nombre y la descripción, el
proveedor, el costo unitario, cuántas veces se usó en reparaciones y su
estado. Se puede filtrar por texto (código o nombre), proveedor y estado. El
filtro de proveedor lista todos los proveedores, también los inactivos.

- **Registrar:** pulsa **Registrar repuesto**. El panel pide el nombre, el
  proveedor (opcional), el costo unitario, el estado (empieza en «Activo») y
  la descripción. Pulsa **Registrar repuesto**.
  - No puede haber dos repuestos con el mismo nombre.
  - El costo no puede ser negativo ni pasar de S/ 9,999,999,999.99.
- **Proveedor nuevo sin salir del formulario:** si el proveedor no existe,
  pulsa **Registrar proveedor nuevo**, escribe la razón social, el tipo y,
  si quieres, el teléfono, y pulsa **Registrar y usar**. El proveedor queda
  elegido en el repuesto y una línea bajo el campo lo confirma. Si hay un
  problema (por ejemplo, ya existe un proveedor inactivo con esa razón
  social), el mensaje aparece en ese mismo recuadro y lo escrito se
  conserva. Los demás datos del proveedor se completan después en
  Inventario → Proveedores.
- **Editar:** pulsa **Editar** en la fila. Si el proveedor del repuesto se
  inactivó, sigue elegido y su opción dice «Inactivo»: puedes guardar sin
  cambiarlo. Para elegir otro, debe estar activo.
- **Inactivar:** pulsa **Inactivar** y confirma. Un repuesto inactivo deja
  de ofrecerse al registrar reparaciones; las reparaciones que ya lo usan lo
  conservan. Puedes volver a activarlo.
- **Activar:** se aplica al pulsar.

Al abrir el buscador de proveedor, la lista solo muestra el proveedor
elegido, porque el buscador empieza con su nombre: borra el texto para ver
los demás.

## Fallas

**Dónde:** Mantenimiento → Fallas.
**Quién:** el administrador (ADMIN) y el maestro de taller
(WORKSHOP_MASTER) las registran y cambian su estado.

Arriba están los totales de fallas registradas, pendientes, en atención y
reparadas, y el tiempo perdido. La lista muestra, por falla, el código, la
máquina, la fecha, la descripción, el responsable, el tiempo perdido, cuántas
reparaciones tiene y su estado.

Una falla puede estar:

- **Pendiente:** aún sin atender.
- **En atención:** alguien trabaja en ella.
- **Reparada:** resuelta. Es un estado final.
- **Anulada:** se registró por error o ya no aplica. Es un estado final.

Acciones:

- **Registrar:** pulsa **Registrar falla**. El panel pide la máquina, la fecha
  y hora, el estado (empieza en «Pendiente»), la descripción, el responsable,
  el tiempo perdido en horas y el impacto en producción. Pulsa **Registrar
  falla**.
  - La descripción lleva al menos 5 caracteres.
  - No se puede registrar una falla sobre una máquina inactiva.
  - Registrar una falla no cambia el estado de la máquina.
- **Cambiar el estado:** elige el estado en la fila y pulsa **Guardar** (ver
  [Cambiar el estado desde la fila](00-patrones.md#cambiar-el-estado-desde-la-fila)).
  - **Reparada** y **Anulada** piden confirmación, porque después no se podrá
    cambiar el estado ni registrar reparaciones sobre esa falla. Una falla
    anulada se conserva en la lista.
  - Una falla reparada o anulada muestra «Sin accion» en su fila.

## Preventivos

**Dónde:** Mantenimiento → Preventivos.
**Quién:** solo el administrador (ADMIN).

Arriba están los totales de preventivos registrados, pendientes, realizados y
anulados. La lista muestra, por preventivo, el código, la máquina, la actividad,
el responsable, la fecha programada, la fecha realizada y su estado. Se puede
filtrar por texto (mantenimiento o actividad), máquina, responsable, estado y
rango de fechas.

Un preventivo puede estar:

- **Pendiente:** programado. Si su fecha ya pasó, la lista lo muestra
  **Vencido**.
- **Vencido:** también se puede guardar así a propósito.
- **Realizado:** cumplido. Es un estado final.
- **Anulado:** ya no se hará. Es un estado final.

Acciones:

- **Programar:** pulsa **Programar preventivo**. El panel pide la máquina, la
  fecha programada, el estado inicial (empieza en «Pendiente»), el responsable,
  la actividad y las observaciones. Pulsa **Programar preventivo**.
- **Cambiar el estado:** elige el estado en la fila y pulsa **Guardar**.
  - **Realizado** pide confirmación: la fecha de hoy queda como fecha realizada
    y después no se podrá cambiar el estado.
  - **Anulado** pide confirmación: no se podrá cambiar el estado, y se conserva
    en la lista.
  - Un preventivo realizado o anulado muestra «Sin accion» en su fila.

## Reparaciones

**Dónde:** Mantenimiento → Reparaciones.
**Quién:** solo el administrador (ADMIN).

Arriba están los totales de reparaciones, programadas y ejecutadas, el costo
total y el promedio. La lista muestra, por reparación, el código, la máquina,
la falla y los repuestos usados, la fecha, el técnico o proveedor, la mano de
obra, el costo de los repuestos, el costo total y su estado. Se puede filtrar
por texto (reparación, falla o técnico), máquina, falla, estado y rango de
fechas.

Una reparación puede estar:

- **Programada:** planificada.
- **Observada:** con algo por revisar.
- **Ejecutada:** terminada. Es un estado final.
- **Anulada:** ya no se hará. Es un estado final.

El estado de la reparación mueve el de su falla y su máquina:

| Reparación | Falla | Máquina |
|---|---|---|
| Programada u observada | En atención | En mantenimiento |
| Ejecutada | Reparada | Operativa |
| Anulada | Vuelve a pendiente | No cambia |

Una reparación que se registra ya como **Anulada** no cambia ni la falla ni la
máquina.

**Registrar una reparación.** El formulario se abre en una página completa,
porque puede llevar varias líneas:

1. Pulsa **Registrar reparación** en la lista.
2. Elige la **falla**. Solo se ofrecen las que siguen abiertas: no se puede
   registrar una reparación sobre una falla reparada o anulada.
3. Completa la fecha, el estado (empieza en «Programada»), la mano de obra y
   el técnico o proveedor.
4. Para cada repuesto usado, pulsa **Agregar repuesto**, elígelo y escribe la
   cantidad. **Quitar** retira la línea. Una reparación puede no llevar
   repuestos.
5. Revisa el resumen: **Repuestos**, **Mano de obra** y **Costo total**. Se
   actualiza mientras escribes, y es lo que se guardará.
6. Pulsa **Registrar reparacion**.

Reglas de las líneas:

- Un repuesto sin cantidad, o una cantidad sin repuesto, se marca junto a su
  línea. Una línea vacía del todo no se guarda.
- No se puede repetir un repuesto: se marcan las líneas que lo usan.
- Solo se ofrecen los repuestos activos.
- El costo unitario sale del catálogo de repuestos. Si cambia mientras tienes
  el formulario abierto, se guarda el costo vigente al guardar.
- Cada subtotal se redondea a 2 decimales y el total es la suma de lo que ves.
  Las reparaciones registradas antes de esta regla conservan su total, que puede
  diferir en un céntimo de la suma de sus repuestos.

**Cambiar el estado:** elige el estado en la fila y pulsa **Guardar**.

- **Ejecutada** pide confirmación: la falla queda reparada y la máquina,
  operativa.
- **Anulada** pide confirmación: la falla vuelve a pendiente y la máquina no
  cambia de estado.
- Después de cualquiera de los dos no se podrá cambiar el estado, y la fila
  muestra «Sin accion».

## Reincidencias

**Dónde:** Mantenimiento → Reincidencias.
**Quién:** solo el administrador (ADMIN).

Es una pantalla de consulta. Muestra los totales de fallas, fallas abiertas,
horas perdidas, costo acumulado y preventivos vencidos; las 5 máquinas con más
fallas y las 5 con mayor costo de reparación; el reporte general por máquina,
con su nivel de riesgo (alto, medio o bajo), y el criterio de riesgo usado.
