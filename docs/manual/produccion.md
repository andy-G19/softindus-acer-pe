# Manual de usuario — Producción

Este capítulo describe las pantallas de Producción que ya se renovaron: rutas de
fabricación, etapas, cuellos de botella y la lista de órdenes de trabajo. Las
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

El alta, el detalle y las acciones de cada orden se describirán cuando se renueven.
