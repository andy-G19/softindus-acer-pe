# Manual de usuario — Inventario

Este capítulo describe las pantallas de Inventario que ya se renovaron. Las
reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

## Inicio de Inventario

**Dónde:** Inventario, en el menú.
**Quién:** el administrador (ADMIN) y el maestro de taller (WORKSHOP_MASTER).

Arriba están los indicadores: materiales activos, proveedores activos,
alertas activas y movimientos registrados (entradas y salidas). Debajo, una
tarjeta por pantalla, primero las del stock y después las de la cadena de
compra:

1. Materiales e insumos
2. Entradas
3. Salidas
4. Alertas y stock crítico
5. Proveedores
6. Proveedor-material
7. Compras
8. Pagos a proveedores

Cada usuario ve solo las tarjetas de las pantallas que puede abrir: el
maestro de taller ve las cuatro primeras.

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

## Proveedores

**Dónde:** Inventario → Proveedores.
**Quién:** solo el administrador (ADMIN).

La lista muestra, por proveedor, el código, la razón social, el documento,
el tipo, el teléfono, la condición de pago y el estado, en orden alfabético
por razón social. El botón **Tipos de proveedor** lleva a su catálogo.

- **Crear:** pulsa **Nuevo proveedor**. El panel pide la razón social y el
  tipo de proveedor (solo los activos) y, si los tienes, el tipo y el
  número de documento, el teléfono, el correo, la dirección, el contacto
  principal, la condición de pago y observaciones. Los proveedores nuevos
  nacen activos.
  - Si no hay tipos de proveedor activos, el panel lo avisa con un enlace
    para crearlos y no deja guardar.
- **Editar:** pulsa **Editar** en la fila. Se cambian todos los datos; el
  tipo puede quedarse uno que ya está inactivo.
- **Inactivar:** pulsa **Inactivar** y confirma. La pregunta explica qué
  pasa: el proveedor deja de ofrecerse en compras, repuestos y asociaciones
  nuevas con materiales, y en el filtro del reporte de proveedores y
  compras, y no cuenta en «Proveedores activos». Sus compras, pagos y
  asociaciones se conservan. La fila se queda en su lugar con la etiqueta
  «Inactivo».
- **Activar:** pulsa **Activar**; se hace sin preguntar.
- **Filtros:** búsqueda por código, razón social, número de documento o
  teléfono, tipo, condición de pago (las que usa algún proveedor) y estado.

Reglas del formulario:

- **Razón social:** obligatoria, de 2 a 150 caracteres.
- **Tipo de documento:** Sin documento, RUC, DNI u Otro.
- **Número de documento:** hasta 20 caracteres. No puede haber dos
  proveedores con el mismo número: si lo intentas, el panel lo marca en el
  campo **Número de documento** y conserva lo escrito.
- **Teléfono:** hasta 20 caracteres. **Correo:** un correo válido, hasta 100.
  **Dirección:** hasta 150. **Contacto principal:** hasta 100.
  **Observaciones:** hasta 500.
- **Condición de pago:** No especificado, Contado, Crédito, Parcial u Otro.

## Materiales de proveedor

**Dónde:** Inventario → Proveedor-material (la pantalla se llama
«Materiales por proveedor»).
**Quién:** solo el administrador (ADMIN).

Una asociación indica que un proveedor puede abastecer un material, con un
precio referencial, el tiempo de entrega y la disponibilidad. Es una
consulta: ninguna otra pantalla usa las asociaciones, así que no cambian las
compras ni el stock.

La lista muestra, por asociación, el código, el proveedor, el material, la
unidad, el precio referencial, el tiempo de entrega, la disponibilidad y el
estado. Va por la última modificación: las asociaciones creadas o cambiadas
más recientemente van primero.

- **Crear:** pulsa **Nueva asociación**. El panel pide el proveedor y el
  material (solo los activos; cada material muestra su unidad entre
  paréntesis) y la unidad de medida; el precio referencial, el tiempo de
  entrega en días y la disponibilidad (Alta, Media, Baja o No disponible)
  son opcionales. Las asociaciones nuevas nacen activas.
  - Si no hay proveedores o materiales activos, el panel lo avisa y no deja
    guardar.
- **Editar:** pulsa **Editar** en la fila. Si el proveedor o el material de
  la asociación ya están inactivos, el panel los ofrece y se pueden
  conservar; si los cambias, el nuevo debe estar activo.
- **Inactivar:** pulsa **Inactivar** y confirma. La pregunta explica que la
  asociación quedará inactiva en este listado y que no cambia compras ni
  stock. Como cambia la asociación, su fila pasa al principio de la lista.
- **Activar:** pulsa **Activar**; se hace sin preguntar.
- **Filtros:** proveedor y material (también los inactivos), disponibilidad
  y estado. **Limpiar** quita los filtros.

Reglas del formulario:

- Un proveedor tiene una sola asociación por material: si repites la
  pareja, el panel lo marca en el campo **Material** y conserva lo escrito.
- **Unidad de medida:** obligatoria, hasta 20 caracteres.
- **Precio referencial** y **Tiempo de entrega (días):** números que no
  pueden ser negativos.

## Entradas

**Dónde:** Inventario → Entradas.
**Quién:** el administrador (ADMIN) y el maestro de taller
(WORKSHOP_MASTER) la consultan.

Las entradas de stock que generan las compras y otros registros, las más
recientes primero, de 20 en 20. Cada fila muestra el código del movimiento,
la fecha, el material, la compra y su proveedor (si vino de una compra), la
cantidad y el stock que dejó.

- **Ver compra:** abre el detalle de la compra. Solo lo ve el
  administrador; el maestro de taller ve el código de la compra en su
  columna. Con **Atrás** del navegador vuelves a la lista con sus filtros.
- **Filtros:** búsqueda por código de compra, material o proveedor;
  material, proveedor, compra y el rango de fechas **Desde** y **Hasta**.

La fecha de cada movimiento y el rango de fechas usan el día de la hora
universal (UTC): un movimiento registrado después de las 19:00 de Lima
aparece con la fecha del día siguiente.

## Salidas

**Dónde:** Inventario → Salidas.
**Quién:** el administrador (ADMIN) y el maestro de taller
(WORKSHOP_MASTER).

Las salidas de stock a producción u otros motivos, las más recientes
primero, de 20 en 20. Cada fila muestra el código, la fecha, el material, la
orden de trabajo, quién registró la salida, la cantidad y el stock que dejó.

- **Ver orden:** abre la orden de trabajo de la salida.
- **Registrar salida:** abre el formulario de salida a página completa (ver
  abajo).
- **Filtros:** búsqueda por orden, material o usuario que registró la
  salida; material, orden y el rango de fechas **Desde** y **Hasta**.

Como en las entradas, la fecha y el rango usan el día UTC.

### Registrar una salida

1. Pulsa **Registrar salida**.
2. Elige el **material** y, si la salida es para producción, la **orden de
   trabajo**. Sin orden, queda como **Sin orden asociada**.
3. Escribe la **cantidad** y el **motivo** (obligatorio, hasta 300
   caracteres).
4. Pulsa **Registrar salida**.

- La cantidad no puede ser mayor que el stock del material: si no alcanza,
  el sistema responde «No hay stock suficiente para registrar la salida.» y
  no descuenta nada.
- No se puede sacar material para una orden anulada, finalizada o con los
  materiales ya cerrados, ni de un material inactivo.
- Si el stock que queda llega al mínimo del material, se abre (o se
  actualiza) su alerta de stock crítico; si queda por encima, la alerta se
  da por atendida.
- Si recargas o vuelves a enviar el mismo formulario, la salida no se
  descuenta dos veces.
- Al guardar, vuelves a la lista con los filtros que tenías; **Cancelar**
  también, y pregunta antes si escribiste algo.

## Compras

**Dónde:** Inventario → Compras.
**Quién:** solo el administrador (ADMIN).

Las compras, las registradas más recientemente primero, de 20 en 20. Cada
fila muestra el código, la fecha de la compra, el proveedor, el
comprobante, el total, el estado del pago y el estado de la compra.

- **Ver detalle:** abre la compra con sus indicadores (proveedor, total,
  pagado y saldo pendiente), sus datos, los materiales comprados y el
  historial de pagos. **Volver a compras** y la miga **Compras** regresan a
  la lista con los filtros que tenía.
- **Nueva compra:** abre el formulario de compra a página completa (ver
  abajo).
- **Anular:** en la fila (mientras la compra no esté anulada, no tenga
  pagos y haya ingresado al almacén) y en el detalle (**Anular compra**).
- **Registrar pago:** en el detalle, mientras la compra tenga saldo.
- **Filtros:** búsqueda por código de compra, número de comprobante o
  proveedor; proveedor, material (las compras que lo incluyen), estado de la
  compra, estado del pago y el rango de fechas **Desde** y **Hasta** (la
  fecha de la compra).

### Registrar una compra

1. Pulsa **Nueva compra**.
2. Elige el **proveedor** (solo los activos) y la **fecha de compra**.
3. Si hay comprobante, elige su **tipo** (boleta, factura, recibo u otro) y
   escribe su **número**. No puede haber dos compras con el mismo tipo y
   número de comprobante.
4. **IGV:** al elegir factura se activa solo; puedes cambiarlo. Con IGV, el
   total suma el 18 % sobre el subtotal.
5. En **Materiales comprados**, agrega una fila por material, con su
   **cantidad**, su **unidad** y su **costo unitario**. Cada fila muestra su
   subtotal, y abajo se ven el subtotal calculado y el **total de la
   compra**. Un material va en una sola fila: si se repite, el sistema lo
   marca y pide ajustar la cantidad en una fila.
6. Pulsa **Registrar compra y entrada**.

Al registrar la compra, sus materiales **ingresan al stock** en ese momento,
con su entrada en el kárdex y su precio en el historial del proveedor. Si
recargas o vuelves a enviar el mismo formulario, la compra no se registra
dos veces.

### Registrar un pago

En el detalle de la compra, la sección **Registrar pago** pide la **fecha de
pago**, el **monto**, el **método** (efectivo, transferencia, Yape, Plin u
otro) y, si quieres, observaciones. Pulsa **Guardar pago**.

- El pago no puede superar el saldo: el sistema responde «El pago no puede
  superar el saldo pendiente. Saldo actual: S/ …».
- Al pagar el saldo completo, la compra queda **pagada** y la sección deja de
  mostrarse. Con un pago menor, queda **parcial**.
- Un pago enviado dos veces se registra una sola vez.

### Anular una compra

**Anular** pide confirmar y explica la consecuencia: se revierte del stock lo
que ingresó con la compra, con su salida en el kárdex, y la compra queda
anulada. No se puede deshacer.

- No se puede anular una compra con pagos registrados.
- Si parte de lo que ingresó ya salió del almacén, no alcanza el stock para
  revertirla y el sistema lo dice dentro de la confirmación.
- Si anulas desde el detalle, al terminar el cursor pasa al título de la
  página.

## Pagos a proveedores

**Dónde:** Inventario → Pagos a proveedores.
**Quién:** solo el administrador (ADMIN).

Todos los pagos registrados desde las compras, los más recientes primero.
Cada fila muestra la fecha, el proveedor, la compra, el método, el monto, el
saldo que quedó y el estado del pago.

- **Ver compra:** abre el detalle de la compra del pago.
- **Filtros:** búsqueda por compra, número de comprobante o proveedor;
  proveedor, compra, método (efectivo, transferencia, Yape, Plin u otro),
  estado (pendiente, parcial o pagado) y el rango de fechas **Desde** y
  **Hasta** (la fecha del pago).

## Reglas de los catálogos de tipos y categorías

- **Nombre:** obligatorio, de 2 a 80 caracteres.
- **Slug:** obligatorio. Es el identificador interno del registro: solo
  admite **minúsculas, números y guiones bajos**, sin espacios ni tildes; por
  ejemplo, `materia_prima`.
- **Descripción:** opcional, hasta 500 caracteres.
- No puede haber dos registros con el mismo nombre ni con el mismo slug. Si
  lo intentas, la ventana te lo indica en el campo **Nombre** y conserva lo
  que escribiste.
