# Manual de usuario — Costos

Este capítulo describe el área de Costos: el costeo de una orden de trabajo, sus costos
indirectos, el margen de ganancia y la rentabilidad. Las reglas comunes (guardar, confirmar y
filtros) están en [Cómo funcionan las pantallas](00-patrones.md).

**Dónde:** Costos, en el menú.

**Quién:** solo el administrador (ADMIN). El inicio del sistema no muestra Costos al vendedor ni
al maestro de taller.

## Inicio de Costos

Muestra los indicadores del área (costeos registrados, costo acumulado, costos indirectos,
alertas de bajo margen, órdenes activas, sin receta y pendientes de costeo, y rentabilidades
calculadas), los últimos costeos y las alertas recientes, con enlaces a la lista de costeos y a
**Generar costeo**.

## Generar un costeo

1. Abre **Generar costeo**. La lista muestra las órdenes de trabajo que todavía no tienen costeo.
2. Pulsa **Generar costeo** en la fila de la orden. Se abre una confirmación que explica lo que se
   calcula:
   - **Materiales y consumibles:** con la receta guardada en la orden, su merma y el costo actual
     de cada material.
   - **Mano de obra:** con las horas de las tareas no anuladas de la orden y la tarifa de cada
     operario.
   - **Costos indirectos:** empiezan en cero.
3. Pulsa **Generar costeo** en la confirmación (o **Cancelar** para no hacer nada).

Se abre el costeo nuevo con el aviso «Costeo creado correctamente». La orden sale de la lista; con
**Atrás** vuelves a ella. Si otra persona ya había generado el costeo de esa orden (por ejemplo,
con la lista abierta desde antes), no se crea otro: se abre el existente con el aviso «La orden ya
tenía un costeo: se abrió el existente». Si la orden no se puede costear (anulada, sin receta o
con la receta sin materiales), el motivo aparece dentro de la confirmación.

## Lista de costeos

**Filtros:** búsqueda por costeo, cliente o pedido; pedido; orden de trabajo; producto; estado
(pendiente, rentable o margen bajo) y rango de fechas (**Desde** y **Hasta**). El rango no acepta
**Hasta** anterior a **Desde**: el navegador lo marca y no filtra.

## Detalle de un costeo

Muestra los montos (materiales, consumibles, mano de obra, costos indirectos, total y unitario por
la cantidad de la orden), el estado económico (margen aplicado, precios, utilidad y margen real)
y un desglose de referencia. Cada sección guarda por separado: si algo falta o está mal, el
mensaje aparece en la sección, en el campo, y lo escrito se conserva; al guardar aparece un aviso
y los montos se actualizan sin salir de la página.

Los importes aceptan hasta S/ 9,999,999,999.99 con dos decimales.

### Mano de obra y recálculo

- **Costo de mano de obra** (obligatorio): empieza con la estimación de las tareas. Puedes
  corregirlo si faltan datos del taller y pulsar **Actualizar**; el total y el unitario se
  recalculan y el campo conserva el monto.
- **Recalcular costeo** pide confirmar con el botón normal: conserva los materiales, los
  consumibles y la mano de obra guardados, y suma los costos indirectos vigentes. Se actualizan el
  total y el unitario.

### Costos indirectos

1. Escribe el **concepto** (al menos 3 caracteres), elige la **categoría** (luz, desgaste de
   maquinaria, transporte, mantenimiento, alquiler, mano de obra indirecta u otros) y escribe el
   **monto** (obligatorios).
2. Si quieres, escribe el criterio de prorrateo, el periodo y observaciones.
3. Pulsa **Registrar costo indirecto**.

El monto se suma al costeo y el formulario queda vacío para el siguiente. **Anular** en la fila de
un costo indirecto usa el botón rojo y pide confirmar: su monto pasa a S/ 0.00 y deja de sumar al
costeo, se recalculan el total y el unitario, y el monto original queda en sus observaciones. Un
costo anulado no se puede reactivar.

### Margen de ganancia

1. Elige el **margen de ganancia** (del 15 % al 20 %). El precio sugerido es el costo total más
   ese porcentaje.
2. Si el precio se negocia o se redondea, escribe el **precio final ajustado** y el motivo. Sin
   precio final se usa el sugerido. El precio final no puede ser menor que el costo total.
3. Pulsa **Aplicar margen**.

Cada margen aplicado queda en el historial del costeo.

### Rentabilidad

Aparece después de aplicar un margen. Pulsa **Calcular rentabilidad** (con observaciones, si
quieres): toma el precio final guardado como ingreso, calcula la utilidad (ingreso menos costo
total) y el margen real (utilidad sobre costo). Si el margen real queda por debajo del margen
aplicado, el costeo se marca **Margen bajo** y aparece entre las alertas; si no, **Rentable**.
Cada cálculo queda en el historial.

Todos los cambios del costeo quedan en la bitácora con quien los hizo.
