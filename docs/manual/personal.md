# Manual de usuario — Personal

Este capítulo describe el área de Personal: los operarios del taller, su asistencia diaria y
las tareas que realizan sobre las órdenes de trabajo. Las reglas comunes (paneles, guardar,
cancelar, confirmar y filtros) están en [Cómo funcionan las pantallas](00-patrones.md).

**Dónde:** Personal, en el menú.

**Quién:**

| Pantalla | Administrador (ADMIN) | Maestro de taller |
|---|---|---|
| Operarios | Consulta, registra, edita, activa e inactiva | Solo consulta |
| Asistencia diaria | Consulta y registra | Consulta y registra |
| Tareas diarias | Consulta, registra y anula | Consulta, registra y anula |
| Planillas e Historial de pagos | Sí | No |

El inicio de Personal muestra solo las tarjetas de las pantallas que tu usuario puede abrir.

## Operarios

**Filtros:** búsqueda por nombre o código, cargo, especialidad, modalidad y estado.

### Registrar un operario

1. Pulsa **Registrar operario**. Se abre un panel sobre la lista.
2. Escribe los **nombres** y los **apellidos** (obligatorios), y si quieres el cargo, la
   especialidad, el teléfono, la fecha de ingreso, la dirección y las observaciones.
3. Elige la **modalidad de pago**: semanal, quincenal o mensual.
4. Escribe la **tarifa**, si la tiene.
5. Pulsa **Registrar operario**.

El operario nace **activo**. No se pueden registrar dos operarios con los mismos nombres y
apellidos (y el mismo teléfono, si lo escribes); las mayúsculas no cuentan.

La tarifa se usa de dos formas: la planilla la toma por cada día de asistencia y el costeo de una
orden la toma por cada hora de tarea. Un operario sin tarifa no suma mano de obra a los costeos ni
puede tener planilla.

### Editar un operario

Pulsa **Editar** en su fila. En el panel puedes cambiar todos sus datos menos el estado, que
tiene su propio botón en la lista.

### Activar e inactivar

- **Inactivar** usa el botón rojo y pide confirmar. Un operario inactivo no aparece al registrar
  asistencia, tareas ni planillas, ni al reasignar avances, hasta que lo reactives. Sus registros
  anteriores (asistencias, tareas, planillas) se conservan.
- **Activar** se aplica al pulsar, sin confirmar.

Al terminar aparece un aviso y la fila cambia de botón; el cursor se queda en ese botón aunque la
fila cambie de lugar en la lista. Cada cambio queda en la bitácora con quien lo hizo.

## Asistencia diaria

**Filtros:** búsqueda por operario o código, código de operario, estado (presente, tardanza o
falta) y rango de fechas (**Desde** y **Hasta**).

### Registrar la asistencia

1. Pulsa **Registrar asistencia**. Se abre un panel sobre la lista.
2. Busca y elige al **operario**. Solo aparecen los operarios activos.
3. Elige la **fecha**. Cada operario solo puede tener un registro de asistencia por día.
4. Escribe la **hora de ingreso** y, si ya salió, la **hora de salida**. Con las dos se calculan
   las horas trabajadas; la salida debe ser posterior al ingreso.
5. Marca **Marcar tardanza** si llegó tarde, o **Marcar falta** si no vino. Si marcas falta, deja vacías
   las horas de ingreso y salida.
6. Pulsa **Registrar asistencia**.

Las asistencias sin falta cuentan en la planilla del operario. Si ya existe la asistencia de ese
operario en esa fecha, el error aparece en la fecha y lo demás se conserva.

## Tareas diarias

### Registrar una tarea

1. Pulsa **Registrar tarea**. Se abre un panel sobre la lista.
2. Busca y elige al **operario** (solo los activos) y la **orden de trabajo**. La actividad queda
   vinculada a esa orden.
3. Si quieres, elige la **etapa de producción**. Debe pertenecer a la ruta de fabricación de la
   orden.
4. Elige la **fecha** y escribe las **horas dedicadas** (hasta 24, con dos decimales).
5. Elige el **estado**: registrada, en proceso o terminada.
6. Escribe la **descripción** (al menos 5 caracteres) y, si quieres, observaciones.
7. Pulsa **Registrar tarea**.

Al generar un costeo, la mano de obra se estima con estas horas y la tarifa del operario.

### Anular una tarea

Pulsa **Anular** en su fila. La confirmación usa el botón rojo y explica la consecuencia: la tarea
deja de contar en la mano de obra de los costeos que se generen después; los costeos ya generados
no cambian. Una tarea anulada muestra «Sin acción» y no se puede reactivar.

## Planillas e Historial de pagos

Solo el administrador las ve. La lista de planillas tiene la barra de filtros: búsqueda,
operario, periodo, modalidad, estado y rango de fechas, que no acepta **Desde** y **Hasta** al
revés. El historial de pagos no tiene filtros. Generar una planilla y registrar un pago todavía no
se renovaron y funcionan como antes.
