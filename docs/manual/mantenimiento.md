# Manual de usuario — Mantenimiento

Este capítulo describe las pantallas de Mantenimiento que ya se renovaron.
Las reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están
en [Cómo funcionan las pantallas](00-patrones.md).

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
