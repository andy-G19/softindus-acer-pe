# Manual de usuario — Inventario

Este capítulo describe las pantallas de Inventario que ya se renovaron. Las
reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

## Tipos de proveedor

**Dónde:** Inventario → Proveedores → Tipos de proveedor.
**Quién:** solo el administrador (ADMIN).

Los tipos de proveedor clasifican a los proveedores, por ejemplo «Materia
prima» o «Servicios».

- **Crear:** pulsa **Nuevo tipo de proveedor**, completa el nombre y el slug
  y pulsa **Crear**. Los tipos nuevos nacen activos.
- **Editar:** pulsa **Editar** en la fila. La ventana muestra el código del
  tipo debajo del título.
- **Inactivar:** pulsa **Inactivar** y confirma. Un tipo inactivo deja de
  ofrecerse al registrar proveedores; los proveedores que ya lo usan lo
  conservan. Puedes volver a activarlo cuando quieras.

## Categorías de materiales

**Dónde:** Inventario → Materiales → Categorías.
**Quién:** el administrador (ADMIN) las crea, edita e inactiva; el maestro
de taller (WORKSHOP_MASTER) solo las consulta y ve «Solo lectura».

Las categorías agrupan los materiales e insumos, por ejemplo «Materia prima»
o «Herramienta».

- **Crear:** pulsa **Nueva categoría**, completa el nombre y el slug y pulsa
  **Crear**. Las categorías nuevas nacen activas.
- **Editar:** pulsa **Editar** en la fila.
- **Inactivar:** pulsa **Inactivar** y confirma. Una categoría inactiva deja
  de ofrecerse al registrar materiales; los materiales que ya la usan la
  conservan.

## Materiales e insumos

**Dónde:** Inventario → Materiales e insumos.
**Quién:** el administrador (ADMIN) los crea, edita, inactiva y activa; el
maestro de taller (WORKSHOP_MASTER) solo los consulta y ve «Solo lectura».

La lista muestra, por material, el stock actual, el reservado, el
disponible (actual menos reservado), el stock mínimo y el costo vigente. El
disponible aparece en rojo cuando está igual o por debajo del mínimo. Los
materiales más recientes van primero.

- **Crear:** pulsa **Nuevo material**. El panel pide el nombre, la
  categoría (solo las activas), la unidad de medida, el stock actual, el
  stock reservado, el stock mínimo y el costo unitario. Los materiales
  nuevos nacen activos.
  - Si el stock actual es mayor que cero, ese stock inicial queda
    registrado en el kárdex como una entrada («Stock inicial registrado al
    crear el material»).
  - Si hay stock mínimo y el stock actual no lo supera, se abre una alerta
    de stock.
  - Si no hay categorías de materiales activas, el panel lo avisa con un
    enlace para crearlas y no deja guardar.
- **Editar:** pulsa **Editar** en la fila. El stock actual y el reservado se
  ven pero no se pueden cambiar: cambian con las compras, las salidas y las
  entregas a las órdenes de trabajo. Sí se cambian el nombre, la categoría
  (puede quedarse una que ya está inactiva), la unidad, el stock mínimo y el
  costo.
- **Inactivar:** pulsa **Inactivar** y confirma. La pregunta explica qué
  pasa: el material deja de ofrecerse en compras, salidas, recetas,
  chatarra, retazos y asociaciones con proveedores; las órdenes de trabajo
  que lo requieren no pueden recibirlo, y sale de «Stock crítico actual».
  Su stock, su kárdex y sus alertas se conservan. La fila se queda en su
  lugar con la etiqueta «Inactivo».
- **Activar:** pulsa **Activar**; se hace sin preguntar.
- **Filtros:** búsqueda por código o nombre, categoría, unidad, estado y
  stock (**Críticos** o **No críticos**).

Reglas del formulario:

- **Nombre:** obligatorio, de 2 a 100 caracteres. No puede haber dos
  materiales con el mismo nombre: si lo intentas, el panel lo marca en el
  campo **Nombre del material** y conserva lo escrito.
- **Unidad de medida:** obligatoria, hasta 20 caracteres (por ejemplo, kg,
  unidad, metro o plancha).
- **Números:** no pueden ser negativos y admiten hasta dos decimales. El
  stock reservado no puede ser mayor que el stock actual.

## Alertas y stock crítico

**Dónde:** Inventario → Alertas y stock crítico.
**Quién:** el administrador (ADMIN) y el maestro de taller
(WORKSHOP_MASTER) la consultan; solo el administrador marca alertas como
atendidas.

- **Stock crítico actual:** los materiales activos con stock mínimo cuyo
  disponible está igual o por debajo de ese mínimo. Se calcula con el stock
  del momento, no con las alertas.
- **Historial de alertas:** las alertas de stock, las más recientes primero,
  con su estado «activa» o «atendida». Se abren al crear un material con
  poco stock y cuando una entrega de material a una orden de trabajo deja
  el stock en el mínimo o por debajo.
- **Marcar atendida:** solo en las alertas activas. Pide confirmación: «La
  alerta pasará a atendida y no se puede reactivar. Si el material sigue
  bajo el mínimo, seguirá en Stock crítico actual.». Confirma con **Marcar
  atendida**. La alerta guarda quién la atendió y cuándo. Si otra persona
  ya la había atendido, la confirmación lo indica («La alerta ya estaba
  atendida.») y no cambia quién ni cuándo.
- Una alerta activa también pasa a atendida sola cuando una compra, o una
  devolución de material de una orden, deja el stock por encima del mínimo.

## Reglas de los catálogos de tipos y categorías

- **Nombre:** obligatorio, de 2 a 80 caracteres.
- **Slug:** obligatorio. Es el identificador interno del registro: solo
  admite **minúsculas, números y guiones bajos**, sin espacios ni tildes; por
  ejemplo, `materia_prima`.
- **Descripción:** opcional, hasta 500 caracteres.
- No puede haber dos registros con el mismo nombre ni con el mismo slug. Si
  lo intentas, la ventana te lo indica en el campo **Nombre** y conserva lo
  que escribiste.
