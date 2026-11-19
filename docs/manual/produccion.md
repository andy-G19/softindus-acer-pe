# Manual de usuario — Producción

Este capítulo describe las pantallas de Producción que ya se renovaron: rutas de
fabricación, etapas, recetas, campañas, cuellos de botella y la lista de órdenes de trabajo. Las
reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

## Inicio de Producción

**Dónde:** Producción, en el menú.
**Quién:** el administrador (ADMIN) y el maestro de taller (WORKSHOP_MASTER).

Arriba está el estado del módulo y los indicadores de órdenes, productos, rutas,
etapas y materiales. Después, una tarjeta por pantalla:

1. Rutas de fabricación
2. Recetas técnicas
3. Órdenes de trabajo
4. Campañas
5. Cuellos de botella

Al final, una lista de lo que el módulo necesita para operar y el resumen de
estados.

## Rutas de fabricación

**Dónde:** Producción → Rutas de fabricación.
**Quién:** el administrador y el maestro de taller.

Una ruta dice cómo se fabrica un producto. Primero se registra la ruta y después
sus etapas.

**Filtros:** buscar por ruta, código o producto; producto; estado.

### Registrar una ruta

1. Pulsa **Nueva ruta**. Se abre un panel sobre la lista.
2. Elige el **producto** y escribe el **nombre de la ruta**. La descripción es
   opcional.
3. Pulsa **Guardar ruta**.

Un producto no puede tener dos rutas con el mismo nombre: si se repite, el error
sale junto al nombre y lo escrito se conserva.

### Editar una ruta

Pulsa **Editar** en su fila. Si la ruta tiene órdenes asociadas, el producto queda
protegido: se ve, pero no se cambia. Si el producto de la ruta se inactivó, sigue
elegido, marcado como «Inactivo», y se pueden editar los demás datos; para cambiarlo
hay que elegir un producto activo.

### Inactivar una ruta

Pulsa **Inactivar** y confirma. La ruta deja de ofrecerse en las órdenes de trabajo
nuevas, no admite etapas nuevas y no cuenta en Rutas activas. Sus etapas y las
órdenes ya creadas se conservan, y esas órdenes pueden seguir generando sus avances.
**Activar** se aplica al pulsar.

## Etapas de una ruta

**Dónde:** Producción → Rutas de fabricación → **Gestionar etapas** en la fila.
**Quién:** el administrador y el maestro de taller.

Arriba están los indicadores de la ruta, entre ellos los minutos por unidad, que
suman las etapas activas.

**Filtros:** buscar etapa; máquina (requiere o no); estado.

### Registrar una etapa

1. Pulsa **Nueva etapa**. El orden sugerido es el siguiente al último.
2. Escribe el **nombre** y el **orden de ejecución**. Cada uno debe ser único en la
   ruta. Usa números consecutivos.
3. Indica los **minutos de operario por unidad**: lo que tarda un operario en una
   unidad, con un mínimo de 0.01.
4. Si la etapa usa una **máquina**, elígela e indica sus **minutos por unidad**. No
   se ofrecen las máquinas inactivas ni dadas de baja; una en reparación sí, porque
   la ruta describe cómo se fabrica, no el estado de hoy.
5. Con máquina, el interruptor dice si **el operario trabaja junto a ella**:
   - encendido (simultáneo): la etapa dura lo que tarde el más lento de los dos;
   - apagado (secuencial): los tiempos se suman.
6. Mira la **vista previa** de una orden de 10 unidades y pulsa **Registrar etapa**.

Por ejemplo, con 8 minutos de operario y 6 de máquina, 10 unidades duran 80 minutos
en modo simultáneo y 140 en secuencial.

Si algo falla, el error sale junto a su campo y se conserva todo lo escrito,
también la máquina y el modo. Sin máquina, puedes marcar que la etapa la requiere
para asignarla después. Una ruta inactiva no admite etapas nuevas: el panel lo avisa
y no deja guardar.

### Editar una etapa

Pulsa **Editar**. Si la etapa ya tiene avances o tareas, un aviso recuerda que los
cambios quedan en la bitácora. Una máquina ya asignada se conserva aunque hoy esté
dada de baja. Si la etapa conserva un tiempo antiguo por etapa completa, el aviso
pide capturar los minutos por unidad.

### Inactivar una etapa

Pulsa **Inactivar** y confirma. La etapa no entra en los avances que se generen
desde ahora, no se ofrece en tareas nuevas y deja de sumar en los minutos por unidad
de la ruta. Si es la última activa, la ruta no sirve para órdenes nuevas. Los avances
y tareas ya registrados se conservan. **Activar** se aplica al pulsar.

## Recetas técnicas

**Dónde:** Producción → Recetas técnicas.
**Quién:** el administrador y el maestro de taller.

Una receta dice qué materiales lleva un producto. Se organiza en versiones: la **vigente**
es la que usan las órdenes de trabajo nuevas, y las demás quedan como historial.

**Filtros:** buscar por receta, código o producto; producto; estado.

### Registrar una receta

1. Pulsa **Nueva receta**. Se abre un panel sobre la lista.
2. Elige el **producto** y escribe el **nombre de la receta**. La descripción es opcional.
3. Pulsa **Guardar receta**.

Un producto no puede tener dos recetas con el mismo nombre: si se repite, el error sale
junto al nombre y lo escrito se conserva. La receta nace sin versión: después crea la
primera con **Ver historial** → **Nueva versión**.

### Inactivar una receta

Pulsa **Inactivar** y confirma. La receta deja de ofrecerse en las órdenes de trabajo
nuevas, no admite versiones nuevas ni cambios en sus materiales y sale de los conteos de
Producción. Sus versiones y las órdenes ya creadas se conservan. **Activar** se aplica al
pulsar.

## Versiones de una receta

**Dónde:** en la lista de recetas, **Ver historial**.

### Crear una versión

1. Pulsa **Nueva versión**. El formulario parte de los materiales de la versión más
   reciente.
2. Ajusta los materiales con **Agregar material** y **Quitar**. Cada línea lleva material,
   cantidad, tipo y merma; las observaciones son opcionales.
3. Pulsa **Crear versión vigente**. La nueva versión queda vigente y reemplaza a la
   anterior.

Si un material se repite, se marca en cada línea que lo usa. Si un material de la base ya
no está activo, su línea se ve vacía y hay que elegir otro. Con cambios, **Cancelar**
pregunta antes de salir.

### Marcar vigente y anular

- **Marcar vigente** vuelve a poner en uso una versión anterior; la vigente queda
  reemplazada. No se ofrece si la receta está inactiva ni en una versión anulada.
- **Anular** retira una versión sin órdenes asociadas y no se puede deshacer. Si anulas la
  vigente, la versión no anulada más reciente pasa a ser la vigente. Si no hay otra, el
  sistema no te deja anularla.

Las dos acciones piden confirmar. Una versión usada por órdenes muestra «Usada en órdenes»
y se conserva como histórica.

## Materiales de una versión

**Dónde:** en una versión, **Ver materiales**.

Solo se pueden cambiar los materiales de una versión vigente, de una receta activa y sin
órdenes asociadas. En los demás casos la pantalla es de consulta.

- **Agregar material** abre un panel. La lista no ofrece los materiales que la versión ya
  tiene. Elige el material, la cantidad por unidad, la merma y el tipo de consumo.
- **Editar** abre el mismo panel. **Simular para una orden de** es solo un cálculo: no se
  guarda y no cuenta como cambio.
- **Eliminar** pide confirmar y borra la línea. Para recuperarla hay que volver a agregarla.

## Calcular materiales

**Dónde:** en los materiales de una versión, **Calcular materiales**.

Escribe la **cantidad a fabricar** y pulsa **Calcular**. La tabla multiplica la receta,
suma la merma y compara con el stock disponible, que es el stock actual menos el reservado.
Marca **Insuficiente** y el faltante si no alcanza. Es solo una consulta: no reserva nada.

## Campañas

**Dónde:** Producción → Campañas.
**Quién:** el administrador y el maestro de taller.

Una campaña agrupa objetivos de producción por producto. Nace **planificada** o **activa**,
puede **finalizarse** y, mientras no esté anulada, **anularse**.

**Filtros:** búsqueda por código o nombre, producto, estado y rango de fechas de inicio.

### Registrar una campaña

1. Pulsa **Nueva campaña**. Se abre un panel sobre la lista.
2. Escribe el **nombre** y la **fecha de inicio**. La fecha de fin y el objetivo son
   opcionales; el fin no puede ser anterior al inicio.
3. Elige el estado inicial: **Planificada** o **Activa**.
4. Pulsa **Guardar campaña**. Vuelves a la lista con sus filtros.

### Editar una campaña

**Editar** abre el panel con el nombre, las fechas y el objetivo. El estado no se cambia aquí:
se cambia desde la fila. Una campaña anulada no se puede editar.

### Agregar productos

En el detalle (**Ver detalle**), pulsa **Agregar producto**. Se abre una ventana con los
productos activos que la campaña todavía no tiene. Elige el producto, escribe la cantidad
objetivo y, si quieres, observaciones, y pulsa **Agregar producto**. El producto aparece en la
tabla sin salir del detalle. Una campaña finalizada o anulada no ofrece este botón.

### Cambiar el estado

- **Activar**, en una campaña planificada, se aplica al pulsar.
- **Finalizar**, en una campaña activa, pide confirmar: después no se pueden agregar productos
  ni crear órdenes de trabajo para ella, y solo se puede anular. Una campaña finalizada no se
  reabre.
- **Anular**, en una campaña planificada o activa, pide confirmar con el botón rojo: no se puede
  deshacer y las órdenes ya creadas se conservan.

## Cuellos de botella

**Dónde:** Producción → Cuellos de botella.
**Quién:** el administrador y el maestro de taller.

Muestra los avances en proceso: los atrasados, los que están en riesgo y las etapas
con más de una orden a la vez.

**Filtros:** producto, ruta, etapa, estado de orden y rango de fechas de inicio de la
etapa, que incluye el último día completo.

## Lista de órdenes de trabajo

**Dónde:** Producción → Órdenes de trabajo.
**Quién:** el administrador y el maestro de taller.

**Filtros:** buscar por orden, cliente o producto; producto; cliente; campaña; tipo;
estado; prioridad y rango de fechas de inicio.

**En cada fila:** **Ver detalle**, **Ver avances**, y **Anular** y **Finalizar** mientras la orden
lo admita (ver abajo).

## Crear una orden de trabajo

**Quién:** el administrador y el maestro de taller.

1. Pulsa **Nueva orden**.
2. Elige el **tipo de producción**:
   - **Por pedido:** elige el **detalle de pedido**; el producto sale de él. Solo se ofrecen los
     pedidos registrados o aprobados.
   - **Por campaña:** elige la **campaña** (activa o planificada) y uno de sus productos.
   - **Reposición de stock:** elige el **producto**.
3. Elige la **ruta de fabricación** y la **versión de receta**. Solo se ofrecen las del producto:
   la ruta debe estar activa y tener etapas, y la versión debe estar vigente y tener materiales.
4. Escribe la **cantidad**, la **prioridad** (alta, media o baja), la **fecha de inicio** y, si
   quieres, la **entrega estimada** y las observaciones.
5. Pulsa **Crear orden**.

Al crearla, la orden guarda el **requerimiento de materiales** de la versión elegida («congelado»):
aunque la receta cambie después, la orden conserva lo que se planificó. La orden nace
**pendiente**, y al guardar se abre su detalle. Una orden enviada dos veces se crea una sola vez.

## Detalle de una orden

El detalle muestra el origen, las fechas, el costo estimado de material, la ruta, la receta y dos
tablas:

- **Requerimiento:** cada material con su cantidad por unidad, el total requerido, el stock
  disponible, el faltante y el costo estimado.
- **Materiales entregados:** por material, lo requerido, entregado, pendiente, devuelto,
  consumido y la merma.

### Entregar los materiales

**Entregar materiales** (o **Entregar lo pendiente**, si ya hubo entregas) pide confirmar y dice
cuánto de cada material sale del almacén. Se usa el botón normal, porque no anula nada. Si un
material no tiene stock suficiente, no se entrega nada y el sistema dice cuál falta. Cuando ya no
queda nada pendiente, el botón desaparece y el cursor pasa al título de la página.

### Entrega adicional o devolución

En la sección **Entrega adicional o devolución**, elige la **operación**:

- **Entrega adicional:** material extra por encima de lo planificado. El **motivo** es
  obligatorio, porque una salida fuera del plan sin explicación no se puede auditar después. La
  cantidad no puede superar el stock disponible en el almacén.
- **Devolución al almacén:** material entregado que vuelve sin usarse. El motivo es opcional. La
  cantidad no puede superar lo entregado que todavía no se devolvió.

Elige el **material** (solo los de la orden), escribe la **cantidad** y pulsa **Registrar entrega
adicional** o **Registrar devolución**. Una operación enviada dos veces se registra una sola vez.

### Cerrar y reabrir los materiales

**Cerrar materiales** concilia lo entregado con lo usado: para cada material escribe lo
**consumido** (la merma sale sola de lo entregado menos lo devuelto y lo consumido), y escribe
las **unidades producidas**, que pueden ser cero si la orden falló por completo. Al cerrar ya no
se puede entregar ni devolver material contra la orden.

Si el cierre tenía un error, **Reabrir el cierre** lo deshace con un **motivo**. No revierte
ningún movimiento de almacén: las entregas y devoluciones quedan como estaban, y queda registrado
en la bitácora.

### Anular y finalizar

En la fila de la lista:

- **Anular** pide confirmar con el botón rojo: la orden queda anulada, ya no recibe material ni
  se puede finalizar. No se puede deshacer. No se anula una orden finalizada ni una con consumos
  registrados.
- **Finalizar** pide confirmar con el botón normal: la orden queda finalizada con la fecha de hoy
  y ya no recibe material. Solo se finaliza cuando tiene avances y todas sus etapas están
  terminadas. Si ya estaba finalizada, el sistema lo avisa y no cambia nada.

## Avances de producción

**Dónde:** **Ver avances**, en la lista o en el detalle de la orden.

Arriba están los indicadores: etapas generadas, en proceso, pausadas, terminadas y el avance
general.

- **Generar avances:** si la orden todavía no tiene avances, el botón pide confirmar y dice
  cuántas etapas de qué ruta reciben un avance **pendiente**. No se ofrece si la orden no tiene
  ruta o su ruta no tiene etapas.
- **Actualizar una etapa:** cada etapa tiene su propio formulario con el **estado** (pendiente,
  en proceso, pausada o terminada), el **porcentaje** y las observaciones. Pendiente se guarda
  como 0 % y terminada como 100 %; en proceso o pausada, el porcentaje debe ser mayor que 0 y
  menor que 100.
- **Reasignar:** en cada etapa, **Reasignar** abre una página para elegir el **nuevo operario**
  (solo los activos) y escribir el **motivo de reasignación**. Al guardar vuelves a los avances.

Al terminar la **última** etapa, la orden queda finalizada sola y los formularios de sus etapas
se deshabilitan: ya no se pueden modificar los avances de una orden finalizada.
