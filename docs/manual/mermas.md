# Manual de usuario — Mermas y chatarra

Este capítulo describe las pantallas de Mermas que ya se renovaron: el inicio, la chatarra y
los retazos reutilizables. La venta de chatarra todavía no se renovó. Las reglas comunes
(paneles, guardar, cancelar, confirmar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

## Inicio de Mermas

**Dónde:** Mermas y chatarra, en el menú.
**Quién:** el administrador (ADMIN) y el maestro de taller (WORKSHOP_MASTER).

Arriba están los botones para registrar un retazo, registrar chatarra y ver cada lista. Solo
el administrador ve **Registrar venta**. Después aparecen los indicadores, los últimos
retazos, la chatarra pendiente de venta y las últimas ventas.

**Registrar retazo** y **Registrar chatarra** abren el formulario en una página completa; al
guardar o cancelar vuelves al inicio.

## Chatarra

**Dónde:** Mermas y chatarra → Ver chatarra.
**Quién:** el administrador y el maestro de taller.

La chatarra es el sobrante que no se reutiliza. Queda **acumulada** hasta que se registra su
venta, y entonces pasa a **vendida**.

**Filtros:** estado, material de origen y búsqueda por código, tipo u observación.

### Registrar chatarra

1. Pulsa **Registrar chatarra**. Se abre un panel sobre la lista.
2. Escribe el **tipo de material**. El material de origen y la orden de trabajo son
   opcionales: déjalos vacíos si la chatarra está mezclada o viene de la limpieza del taller.
3. Escribe el **peso en kg**, la **cantidad aproximada** o los dos. Hace falta al menos uno.
4. Pulsa **Guardar chatarra**.

Si falta el peso y la cantidad, el error aparece junto al peso y lo escrito se conserva. Un
material inactivo o una orden anulada marcan su propio campo. Al guardar, vuelves a la lista
con sus filtros y aparece un solo aviso.

Solo el administrador ve **Vender** en cada fila.

## Retazos reutilizables

**Dónde:** Mermas y chatarra → Ver retazos.
**Quién:** el administrador y el maestro de taller.

Un retazo es un sobrante aprovechable. Nace **disponible** y después se marca como
**reutilizado** o **descartado**.

**Filtros:** estado, material de origen y búsqueda por código, medida, ubicación u orden.

### Registrar un retazo

1. Pulsa **Registrar retazo**. Se abre un panel sobre la lista.
2. Elige el **material de origen** y la **orden de trabajo** que lo generó. Los dos son
   obligatorios: hay que elegirlos de la lista, no basta con escribir.
3. Escribe la **cantidad** y elige la **unidad**. La medida y la ubicación son opcionales.
4. Pulsa **Guardar retazo**.

El tipo del retazo se toma de la categoría del material elegido.

### Reutilizar o descartar

Solo un retazo **disponible** muestra **Reutilizar** y **Descartar**. Los dos cambios son
definitivos, así que piden confirmar:

- **Reutilizar** usa el botón normal: el retazo deja de estar disponible.
- **Descartar** usa el botón rojo: el retazo se conserva en la lista como descartado.

Al terminar aparece un aviso, la lista conserva sus filtros y la fila muestra «Sin acción».
Cada cambio queda en la bitácora con quien lo hizo.
