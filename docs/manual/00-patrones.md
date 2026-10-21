# Manual de usuario — Cómo funcionan las pantallas

Este manual explica cómo se usa el sistema de Aceros Perú. Este capítulo
describe lo que es igual en todas las pantallas que ya se renovaron; cada
área tiene después su propio capítulo.

Pantallas renovadas hasta ahora:

- Comercial: clientes y categorías de producto.
- Inventario: tipos de proveedor, proveedores, materiales de proveedor,
  categorías de materiales, materiales e insumos, y alertas y stock crítico.
- Caja chica: categorías de gasto.
- Reportes: los ocho reportes con filtros, el historial de exportaciones y
  la bitácora de auditoría.

Las demás pantallas se irán sumando a este manual a medida que se renueven.

## Crear y editar en una ventana

En las listas, el botón **Nuevo…** (arriba a la derecha) y el botón
**Editar** de cada fila abren el formulario en una ventana encima de la
lista. Así no pierdes la lista ni los filtros que tenías puestos.

- Los catálogos cortos (tipos, categorías) se abren en una ventana en el
  centro de la pantalla.
- Los registros con más datos, como los clientes, los materiales y los
  proveedores, se abren en un panel a la derecha. Ese panel tiene su propia
  dirección: si recargas la página o copias el enlace, el mismo formulario
  se abre a pantalla completa, y allí **Cancelar** te devuelve a la lista
  con los filtros que tenía.
- En el teléfono, la ventana y el panel ocupan toda la pantalla.

Los campos marcados con un asterisco (*) son obligatorios.

## Guardar

Pulsa **Guardar** (o el botón con el verbo de la acción, como **Crear**).
Mientras se guarda, el botón muestra «Guardando…» y no se puede pulsar otra
vez, así que no se crean registros repetidos por un doble clic.

- **Si todo está bien:** aparece un solo aviso en la esquina, la ventana se
  cierra y la lista ya muestra el cambio.
- **Si algo está mal:** la ventana sigue abierta, con un mensaje rojo arriba
  que explica el problema y el campo a corregir marcado. **Lo que escribiste
  se conserva** y el cursor queda en el primer campo a corregir.

## Cancelar sin perder trabajo por accidente

Puedes cerrar la ventana con **Cancelar**, con la **X**, con la tecla
**Esc** o haciendo clic fuera de ella.

- Si no escribiste nada, se cierra directamente.
- Si escribiste algo, el sistema pregunta si quieres **descartar los
  cambios**. **Cancelar** te devuelve al formulario con lo escrito;
  **Descartar cambios** lo cierra sin guardar. Al volver con **Cancelar**,
  el cursor regresa al campo donde estabas, también si la pregunta salió
  por un clic fuera de la ventana.
- Mientras se está guardando, la ventana no se puede cerrar.
- Si intentas recargar la página o cerrar la pestaña con cambios sin
  guardar, el navegador también te pregunta antes de salir.
- En el panel lateral, el botón **Atrás** del navegador cierra el panel sin
  preguntar: el navegador no permite detenerlo.

## Activar e inactivar

Los registros de los catálogos no se borran: se **inactivan**. Esto vale
para tipos de proveedor, proveedores, materiales de proveedor, categorías de
materiales, materiales y categorías de gasto. En clientes y categorías de
producto, activar e inactivar todavía se hacen sin confirmación; se
igualarán en una próxima actualización.

- **Inactivar** pide confirmación. La pregunta nombra el registro y explica
  qué pasa, por ejemplo: «Dejará de ofrecerse al registrar proveedores; los
  que ya lo usan lo conservan». Confirma con **Inactivar** o vuelve con
  **Cancelar**.
- **Activar** se hace al pulsar, sin preguntar.
- Al terminar aparece un aviso y la etiqueta de la fila cambia a «Activa» o
  «Inactiva».
- Las listas de los catálogos muestran primero los registros activos. Al
  inactivar uno, su fila pasa al final de la lista y el cursor la acompaña;
  al activarlo, vuelve a su lugar. En materiales y proveedores, la fila se
  queda donde estaba; en materiales de proveedor, pasa al principio, porque
  esa lista va por la última modificación.
- Si la lista está filtrada por estado (por ejemplo, solo los activos) y el
  registro deja de cumplir el filtro, su fila sale de la lista y el cursor
  pasa a la tabla.
- Si otra persona ya había cambiado ese registro y tu lista estaba
  desactualizada, el sistema no hace lo contrario de lo que pediste: te
  avisa, por ejemplo, de que «ya estaba inactivo».

## Filtrar las listas

Las listas renovadas tienen una barra de filtros arriba. Completa los campos
que necesites y pulsa **Filtrar** (en algunas pantallas, **Aplicar
filtros**); **Limpiar** o **Limpiar filtros** quita todos los filtros. Los
filtros quedan en la dirección de la página, así que puedes guardarla en
favoritos o compartirla con los filtros puestos.

La barra siempre muestra los filtros que la lista está aplicando: después
de **Limpiar**, o al volver con **Atrás** o **Adelante** del navegador, sus
campos y listas desplegables toman los valores de la dirección. Si cambiaste
un campo y no pulsaste **Filtrar**, ese cambio se pierde en ese momento. En
cambio, abrir y cerrar una ventana o un panel desde la lista no cambia lo
que elegiste en la barra.

Si la barra tiene un rango de fechas (**Desde** y **Hasta**), los dos días
se incluyen completos. **Hasta** no ofrece días anteriores a **Desde**; si
quedan al revés, muestra «La fecha inicial no puede ser mayor que la fecha
final.» y la barra no se envía hasta corregirlo.

## Usar el teclado

- **Tab** y **Mayús+Tab** recorren los campos y botones; dentro de una
  ventana, el recorrido no sale de ella.
- Al abrir una ventana, el cursor va al primer campo.
- **Esc** cierra la ventana (con la misma pregunta si hay cambios).
- Al cerrarse, el cursor vuelve al botón que la abrió.

## Permisos

Cada pantalla muestra solo lo que tu usuario puede hacer. Si un rol solo
puede consultar, verás la lista con la indicación **Solo lectura** y sin los
botones de crear, editar o inactivar. Los permisos de cada pantalla están en
el capítulo de su área.
