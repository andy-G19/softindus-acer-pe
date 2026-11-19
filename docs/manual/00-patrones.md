# Manual de usuario — Cómo funcionan las pantallas

Este manual explica cómo se usa el sistema de Aceros Perú. Este capítulo
describe lo que es igual en todas las pantallas; cada área tiene después su
propio capítulo.

Desde noviembre de 2026 todas las pantallas del sistema están renovadas y
siguen estas reglas: Comercial, Inventario, Caja chica, Mantenimiento,
Producción, Mermas y chatarra, Personal, Costos, Usuarios y Reportes. Las
excepciones, cuando las hay, se explican en el capítulo de su área.

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
- Los formularios con líneas que se agregan, como los pedidos, las
  reparaciones y las versiones de una receta, se abren en una página completa.
  **Cancelar** pregunta antes de salir si cambiaste algo.
- Algunas ventanas se abren desde un detalle o desde una fila, como agregar
  un producto a una campaña o restablecer la contraseña de un usuario. Al
  guardar, la ventana se cierra y sigues en la misma página.
- En el detalle de un costeo, cada sección (mano de obra, costos indirectos,
  margen y rentabilidad) tiene su propio formulario dentro de la página, sin
  ventana: si algo está mal, el mensaje queda en la sección; al guardar
  aparece un aviso y los montos se actualizan sin salir del detalle.
- En el teléfono, la ventana y el panel ocupan toda la pantalla.

Los campos marcados con un asterisco (*) son obligatorios.

## Guardar

Pulsa **Guardar** (o el botón con el verbo de la acción, como **Crear**).
Mientras se guarda, el botón muestra «Guardando…» y no se puede pulsar otra
vez, así que no se crean registros repetidos por un doble clic.

- **Si todo está bien:** aparece un solo aviso en la esquina, la ventana se
  cierra y la lista ya muestra el cambio.
- **Si algo está mal:** la ventana sigue abierta, con un mensaje rojo arriba
  y el campo a corregir marcado. **Lo que escribiste se conserva** y el
  cursor queda en el primer campo a corregir.
  - Si el problema es de un campo (por ejemplo, «Ya existe un cliente con
    ese número de documento.»), el mensaje aparece debajo de ese campo, y el
    de arriba dice «Revisa los campos marcados.», para no repetirlo.
  - Si el problema no es de un campo (un permiso, el stock, una falla del
    sistema), el mensaje de arriba lo explica.

### Lo que mueve dinero o stock no se registra dos veces

Los formularios que registran dinero o stock recuerdan cada envío: pagos de
clientes y a proveedores, compras, salidas de inventario, proformas,
comprobantes de venta, egresos, ingresos y ajustes de caja chica, ventas de
chatarra, generar y pagar planillas, crear órdenes de trabajo, y las
entregas adicionales y devoluciones de material de una orden.

- Si la conexión se corta mientras guardas, o recargas la página y vuelves a
  enviar el mismo formulario, el sistema reconoce que ya lo había registrado
  y no crea otro: te muestra el que ya existe.
- Después de un registro correcto, el formulario queda listo para uno nuevo.
- Entregar lo pendiente, cerrar y reabrir los materiales de una orden, anular
  y finalizar tampoco se hacen dos veces: un segundo intento no cambia nada y,
  cuando corresponde, te avisa de que ya estaba hecho.

## Cancelar sin perder trabajo por accidente

Puedes cerrar la ventana con **Cancelar**, con la **X**, con la tecla
**Esc** o haciendo clic fuera de ella.

- Si no escribiste nada, se cierra directamente.
- Si escribiste algo, el sistema pregunta si quieres **descartar los
  cambios**. **Cancelar** te devuelve al formulario con lo escrito;
  **Descartar cambios** lo cierra sin guardar. Al volver con **Cancelar**,
  el cursor regresa a donde estabas: al campo en el que escribías, también
  si la pregunta salió por un clic fuera de la ventana, o al botón
  **Cancelar** de la ventana si la pregunta salió por él.
- Mientras se está guardando, la ventana no se puede cerrar.
- Si intentas recargar la página o cerrar la pestaña con cambios sin
  guardar, el navegador también te pregunta antes de salir.
- En el panel lateral, el botón **Atrás** del navegador cierra el panel sin
  preguntar: el navegador no permite detenerlo.

## Activar e inactivar

Los registros de los catálogos no se borran: se **inactivan**. Esto vale
para tipos de proveedor, proveedores, materiales de proveedor, categorías de
materiales, materiales, categorías de gasto, clientes, productos,
categorías de producto, máquinas y repuestos. Las rutas, las etapas y las
recetas de Producción, los operarios y los usuarios (que se **desactivan**)
siguen las mismas reglas de confirmar y avisar; dónde queda su fila depende
del orden de cada lista.

- **Inactivar** pide confirmación. La pregunta nombra el registro y explica
  qué pasa, por ejemplo: «Dejará de ofrecerse al registrar proveedores; los
  que ya lo usan lo conservan». Confirma con **Inactivar** o vuelve con
  **Cancelar**.
- **Activar** se hace al pulsar, sin preguntar.
- Al terminar aparece un aviso y la etiqueta de la fila cambia a «Activa» o
  «Inactiva».
- Las listas de los catálogos muestran primero los registros activos. Al
  inactivar uno, su fila pasa al final de la lista y el cursor la acompaña;
  al activarlo, vuelve a su lugar. En materiales, proveedores, clientes y
  productos, la fila se queda donde estaba; en materiales de proveedor, pasa
  al principio, porque esa lista va por la última modificación.
- Si la lista está filtrada por estado (por ejemplo, solo los activos) y el
  registro deja de cumplir el filtro, su fila sale de la lista y el cursor
  pasa a la tabla.
- Si otra persona ya había cambiado ese registro y tu lista estaba
  desactualizada, el sistema no hace lo contrario de lo que pediste: te
  avisa, por ejemplo, de que «ya estaba inactivo».

## Cambiar el estado desde la fila

Los registros que pasan por varios estados, como las fallas, los preventivos y
las reparaciones, tienen en su fila una lista de estados y el botón **Guardar**.

- **Guardar** se activa cuando eliges un estado distinto del actual.
- Los estados que no se pueden deshacer piden confirmación, y la pregunta
  explica qué pasa. **Anular** usa el botón rojo; los demás, el botón normal,
  porque no anulan nada. Los otros estados se aplican al pulsar **Guardar**.
- Al terminar aparece un solo aviso. Si el registro queda en un estado final, la
  fila muestra «Sin accion» y el cursor queda en esa fila.
- Si algo falla, el mensaje aparece en la fila, o dentro de la confirmación si
  se había abierto.
- Si otra persona ya había hecho el cambio, el sistema te avisa de que «ya
  estaba en ese estado» y no escribe nada.

Otros cambios tienen su propio botón, sin lista de estados:

- en Producción: marcar vigente y anular una versión de receta; activar,
  finalizar y anular una campaña; anular y finalizar una orden de trabajo;
  entregar lo pendiente y generar los avances de una orden;
- en Comercial: anular una proforma o un comprobante y cancelar un pedido;
- en Inventario: anular una compra;
- en Caja chica: anular un movimiento;
- en Personal: anular una planilla o una tarea diaria;
- en Mermas: reutilizar y descartar un retazo;
- en Costos: anular un costo indirecto y recalcular un costeo.

Siguen las mismas reglas: lo que no se puede deshacer pide confirmar, con el
botón rojo para anular, cancelar y descartar, y con el normal para lo demás
(por ejemplo, finalizar o entregar lo pendiente, que no anulan nada). La
pregunta dice qué pasa: cuánto material sale del almacén, a dónde va el
dinero o qué días quedan libres. Activar una campaña se aplica al pulsar.

Si el botón desaparece al terminar (por ejemplo, **Entregar lo pendiente**
cuando ya no queda nada por entregar), el cursor pasa al título de la página.

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

Hay una excepción conocida: **Filtrar** vuelve a cargar la página, y si
luego pulsas **Atrás** el navegador puede devolver a la barra lo que habías
escrito, aunque la lista ya no lo esté aplicando. Si la barra y la lista no
coinciden, pulsa **Filtrar** o **Limpiar**.

Si la barra tiene un rango de fechas (**Desde** y **Hasta**), los dos días
se incluyen completos. **Hasta** no ofrece días anteriores a **Desde**; si
quedan al revés, muestra «La fecha inicial no puede ser mayor que la fecha
final.» y la barra no se envía hasta corregirlo. Si llegas con un enlace que
ya trae el rango al revés, **Hasta** muestra el mismo mensaje: los reportes
no muestran datos y piden corregir el rango, y las listas salen vacías.

Las fechas cuentan aunque las elijas mientras la página todavía carga, o
aunque el navegador las recupere al volver con **Atrás**: si quedan al
revés, el mensaje aparece igual y la barra no se envía.

Cuando una lista no tiene filas, el mensaje dice por qué:

- sin filtros, que todavía no hay registros, por ejemplo «Todavía no hay
  pedidos registrados.»;
- con filtros, que no se encontró nada, por ejemplo «No se encontraron
  pedidos con los filtros aplicados.». Pulsa **Limpiar** para ver todo.

Los reportes dicen siempre «con los filtros aplicados», porque muestran un
periodo elegido.

## El menú de la izquierda

En una pantalla mediana o grande, el menú de la izquierda muestra solo los
íconos de cada área. Se abre con sus nombres al pasar el ratón por encima o
al llegar a él con **Tab**, y vuelve a cerrarse al elegir una opción con el
ratón o al salir de él. En el teléfono, el menú está arriba de la página.

## Si una pantalla no carga

Si una pantalla falla al cargar, aparece el mensaje «Ocurrió un problema»
con dos botones: **Intentar nuevamente** vuelve a pedir la pantalla, y
**Volver al inicio** lleva al inicio del sistema. Si el problema sigue,
comunica el **Código de referencia** que aparece debajo: con él se encuentra
el error en el registro del sistema.

## Usar el teclado

- **Tab** y **Mayús+Tab** recorren los campos y botones; dentro de una
  ventana, el recorrido no sale de ella.
- Al abrir una ventana, el cursor va al primer campo.
- **Esc** cierra la ventana (con la misma pregunta si hay cambios).
- Al cerrarse, el cursor vuelve al botón que la abrió.

## Permisos

Cada pantalla muestra solo lo que tu usuario puede hacer. Si un rol solo
puede consultar, verás la lista con la indicación **Solo lectura** y sin los
botones de crear, editar o inactivar. Los inicios de Inventario, de
Mantenimiento y de Personal muestran solo las tarjetas de las pantallas que
tu usuario puede abrir; el de Mermas muestra **Registrar venta** solo al
administrador, y el inicio del sistema muestra Costos solo al administrador.
Los permisos de cada pantalla están en el capítulo de su área.
