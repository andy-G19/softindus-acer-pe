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
