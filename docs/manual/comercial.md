# Manual de usuario — Comercial

Este capítulo describe las pantallas de Comercial que ya se renovaron. Las
reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

## Inicio de Comercial

**Dónde:** Comercial, en el menú.
**Quién:** el administrador (ADMIN) y el vendedor (SELLER).

Arriba están los indicadores: clientes activos, productos activos, pedidos
registrados, proformas activas (vigentes o aceptadas), saldo por cobrar de
las proformas activas y comprobantes emitidos. Debajo, una tarjeta por
pantalla, en el orden del flujo de venta:

1. Clientes
2. Productos
3. Pedidos
4. Proformas
5. Pagos de cliente
6. Comprobantes de venta

El administrador y el vendedor ven las seis tarjetas, y las seis pantallas
se abren con los dos roles.

## Clientes

**Dónde:** Comercial → Clientes.
**Quién:** el administrador (ADMIN) y el vendedor (SELLER) los crean,
editan, inactivan y activan.

La lista muestra, por cliente, el código, el nombre o razón social, el tipo,
el teléfono, el origen y el estado. Los clientes más recientes van primero.

- **Crear:** pulsa **Nuevo cliente**. El panel pide el tipo de cliente
  (cliente final, ferretería, distribuidora, constructora u otro) y el
  nombre o razón social; el tipo y el número de documento, el teléfono, el
  correo, la dirección, el lugar de origen y las observaciones son
  opcionales. Los clientes nuevos nacen activos.
- **Editar:** pulsa **Editar** en la fila.
- **Inactivar:** pulsa **Inactivar** y confirma. La pregunta explica qué
  pasa: el cliente deja de ofrecerse al registrar pedidos o al cambiar el
  cliente de uno, y en el filtro de clientes del reporte de ventas y
  cobranzas; no cuenta en «Clientes activos». Sus pedidos, proformas, pagos
  y comprobantes se conservan. La fila se queda en su lugar con la etiqueta
  «Inactivo».
- **Activar:** pulsa **Activar**; se hace sin preguntar.
- **Filtros:** cliente (se busca por nombre o código), búsqueda general (por
  nombre, documento, teléfono o correo), tipo, estado y origen.

Reglas del formulario:

- **Nombre o razón social:** obligatorio, de 2 a 150 caracteres.
- **Número de documento:** hasta 20 caracteres. No puede haber dos clientes
  con el mismo número: si lo intentas, el panel lo marca en ese campo y
  conserva lo escrito.
- **Teléfono:** hasta 20 caracteres; **dirección:** hasta 150; **lugar de
  origen:** hasta 100. El **correo**, si se escribe, debe ser válido.

## Productos

**Dónde:** Comercial → Productos.
**Quién:** el administrador (ADMIN) los crea, edita, inactiva y activa; el
vendedor (SELLER) solo los consulta y ve «Solo lectura».

La lista muestra, por producto, el código, el nombre, la categoría, la
unidad, el precio referencial y el estado. Los productos más recientes van
primero. El botón **Categorías** lleva a su catálogo.

- **Crear:** pulsa **Nuevo producto**. El panel pide el nombre, la categoría
  (solo las activas), la unidad de medida (unidad, docena, par o lote; viene
  elegida «Unidad»), el precio referencial y una descripción. Los productos
  nuevos nacen activos. Si la lista tenía filtros, el aviso recuerda que el
  producto puede no aparecer con ellos, y al cerrarse el panel la lista
  sigue filtrada.
- **Editar:** pulsa **Editar** en la fila. Se puede cambiar todo; si el
  producto tiene una categoría que se inactivó después, puede conservarla
  mientras no la cambies por otra.
- **Inactivar:** pulsa **Inactivar** y confirma. La pregunta explica qué
  pasa: el producto deja de ofrecerse en pedidos, rutas de fabricación,
  recetas técnicas nuevas, campañas y órdenes de trabajo, y en los filtros
  de producto de Producción y de su reporte; no cuenta en «Productos
  activos». Sus pedidos, rutas, recetas y órdenes se conservan. La fila se
  queda en su lugar con la etiqueta «Inactivo»; si la lista está filtrada
  por «Activo», la fila sale de la lista.
- **Activar:** pulsa **Activar**; se hace sin preguntar.
- **Filtros:** búsqueda por código o nombre, categoría, unidad y estado.

Reglas del formulario:

- **Nombre del producto:** obligatorio, de 2 a 100 caracteres. No puede
  haber dos productos con el mismo nombre: si lo intentas, el panel lo marca
  en el campo **Nombre del producto** y conserva lo escrito.
- **Categoría** y **unidad de medida:** obligatorias.
- **Precio referencial:** opcional; no puede ser negativo. Es una
  referencia: más adelante se calculará mejor con el módulo de costos.
- **Descripción:** hasta 500 caracteres.

## Categorías de producto

**Dónde:** Comercial → Productos → Categorías.
**Quién:** el administrador (ADMIN) las crea, edita, inactiva y activa; el
vendedor (SELLER) solo las consulta y ve «Solo lectura».

Las categorías agrupan los productos, por ejemplo «Herramientas agrícolas».
La lista muestra el código, el nombre (con su identificador debajo), la
descripción y el estado; las activas van primero.

- **Crear:** pulsa **Nueva categoría**, escribe el nombre y, si quieres, una
  descripción, y pulsa **Crear categoría**. El identificador se forma con el
  nombre. Las categorías nuevas nacen activas.
- **Editar:** pulsa **Editar** en la fila y guarda con **Guardar cambios**.
- **Inactivar:** pulsa **Inactivar** y confirma. Una categoría inactiva deja
  de ofrecerse al registrar productos o al cambiar la categoría de uno; los
  productos que ya la usan la conservan y se pueden seguir editando. Su fila
  pasa al final de la lista.
- **Activar:** pulsa **Activar**; se hace sin preguntar.

Reglas del formulario:

- **Nombre:** obligatorio, de 2 a 80 caracteres. No puede haber dos
  categorías con el mismo nombre.
- **Descripción:** hasta 500 caracteres.

## Estados

Pedidos, proformas y comprobantes muestran su estado con una etiqueta de
color en mayúsculas:

- azul: «Registrado», «Aprobado», «Vigente» y «Aceptada»;
- verde: «Pagada» y «Emitido»;
- naranja: «En producción», «Sin proforma» y «Sin comprobante»;
- rojo: «Cancelado», «Anulada» y «Anulado».

## Pedidos

**Dónde:** Comercial → Pedidos.
**Quién:** el administrador (ADMIN) y el vendedor (SELLER).

La lista muestra, por pedido, el código, el cliente, la fecha del pedido,
la entrega estimada, los productos con su cantidad, el monto estimado, el
estado y la proforma activa (su número, o «Sin proforma»). Los pedidos más
recientes van primero, de 20 en 20.

- **Estados:** un pedido nace «Registrado»; pasa a «En producción» cuando
  se crea su orden de trabajo, y puede quedar «Aprobado» o «Cancelado».
- **En cada fila:**
  - **Ver detalle**, siempre;
  - **Editar** y **Cancelar**, mientras el pedido no esté cancelado ni tenga una proforma activa, un comprobante o una orden de trabajo;
  - **Ver proforma**, si tiene una proforma activa;
  - **Generar proforma**, si está registrado o aprobado y no tiene una proforma activa.
- **Filtros:**
  - búsqueda por código, cliente o producto;
  - cliente;
  - producto (ofrece también los productos inactivos);
  - estado: Registrado, Aprobado o Cancelado. No hay opción para «En producción»;
  - rango de fechas del pedido.

### Crear y editar un pedido

El pedido no se abre en una ventana: tiene varias líneas de productos, así
que **Nuevo pedido** y **Editar** abren el formulario en su propia página.
Al guardar, o con **Cancelar**, vuelves a la lista con los filtros que
tenía. Si la lista estaba filtrada, el aviso recuerda que el pedido puede no
aparecer con esos filtros.

- **Cliente:** obligatorio. Escribe para buscarlo y elígelo de la lista;
  solo se ofrecen los clientes activos.
- **Productos:** al menos uno. Cada línea pide el producto (solo los
  activos), la cantidad, el precio unitario y una observación del producto
  opcional. Al elegir el producto, el precio toma su precio referencial, y
  puedes cambiarlo. **Agregar producto** suma una línea y **Quitar** la
  borra, siempre que quede al menos una. No se puede repetir un producto en
  el mismo pedido.
- **Importes:** cada línea muestra su subtotal y abajo aparece el **Total
  estimado**. Cantidad y precio se redondean a 2 decimales (la mitad sube),
  el subtotal es cantidad × precio redondeado a 2 decimales y el total es la
  suma de los subtotales. Lo que ves es lo que se guarda: por ejemplo, dos
  líneas de 1,25 × S/ 10,25 dan S/ 12,81 cada una y S/ 25,62 de total.
- **Fecha estimada de entrega:** opcional; no puede ser anterior a la fecha
  del pedido.
- **Observaciones generales del pedido:** hasta 500 caracteres; la del
  producto, hasta 300.
- **Límites:** cantidad hasta 99.999.999,99; precio, subtotal y total hasta
  S/ 9.999.999.999,99.
- Si no hay clientes o productos activos, el formulario lo avisa y no deja
  registrar.

Si algo está mal, el pedido no se guarda y el formulario sigue abierto. El
mensaje aparece junto a su campo, también el de la línea concreta (por
ejemplo, el producto repetido se marca en su segunda aparición), y el
cursor va al primer campo a corregir. Lo escrito se conserva, también la
fecha y las observaciones.

**Cancelar** sin cambios vuelve a la lista sin preguntar. Si escribiste o
cambiaste algo (también elegir un cliente o un producto, o agregar o quitar
una línea), pregunta «¿Descartar el pedido nuevo?» o «¿Descartar los
cambios del pedido?». **Cancelar** te deja seguir con lo escrito y
**Descartar cambios** vuelve a la lista sin guardar. Recargar o cerrar la
pestaña con cambios también pregunta. Los enlaces del menú lateral y el
botón **Atrás** del navegador no preguntan.

Al editar:

- Solo se editan los pedidos que no están cancelados ni tienen una
  proforma activa, un comprobante o una orden de trabajo. A los demás la
  lista no les muestra **Editar**, y si se abre su dirección de edición,
  lleva al detalle.
- Si el cliente o un producto del pedido se inactivaron después, siguen
  apareciendo, con «Inactivo» en su descripción, y el pedido se puede
  guardar mientras no los cambies. Uno nuevo debe estar activo.

## Proformas

**Dónde:** Comercial → Proformas.
**Quién:** el administrador (ADMIN) y el vendedor (SELLER).

La lista muestra, por proforma, el número, el pedido, el cliente, la fecha
de emisión, el total, el saldo, el estado y el comprobante (su tipo y
número, o «Sin comprobante»). Las más recientes van primero; la lista
muestra todas, sin páginas.

- **En cada fila:**
  - **Ver detalle**, siempre;
  - **Registrar pago**, mientras no esté pagada ni anulada y tenga saldo; lleva al detalle, donde se registra;
  - **Anular**, mientras no esté anulada y no tenga pagos ni comprobantes; pide confirmación.
- **Filtros:**
  - búsqueda por número de proforma, pedido o cliente;
  - cliente;
  - pedido;
  - estado: Vigente, Aceptada, Pagada o Anulada;
  - saldo: con saldo o sin saldo;
  - rango de fechas de emisión.

## Pagos de cliente

**Dónde:** Comercial → Pagos de cliente.
**Quién:** el administrador (ADMIN) y el vendedor (SELLER).

Los pagos se registran en el detalle de cada proforma; esta lista los
consulta. Muestra, por pago, la fecha, el cliente, el pedido, la proforma,
el tipo, el método, el monto y el saldo que quedó. Los más recientes van
primero; la lista muestra todos, sin páginas. El tipo y el método se ven
como se guardaron, por ejemplo «amortizacion» o «transferencia».

- **En cada fila:** **Ver proforma**.
- **Filtros:**
  - búsqueda por pedido, proforma o cliente;
  - cliente;
  - pedido;
  - método: efectivo, transferencia, Yape, Plin u otro;
  - tipo de pago: adelanto, amortización o cancelación;
  - rango de fechas del pago.

## Comprobantes de venta

**Dónde:** Comercial → Comprobantes de venta.
**Quién:** el administrador (ADMIN) y el vendedor (SELLER).

Los comprobantes se emiten en el detalle de cada proforma; esta lista los
consulta. Muestra, por comprobante, el número, el cliente, el pedido, el
tipo, la fecha de emisión, el total y el estado («Emitido» o «Anulado»). Los
más recientes van primero; la lista muestra todos, sin páginas.

- **En cada fila:**
  - **Ver proforma**, si el comprobante tiene una;
  - **Anular**, mientras esté emitido; pide confirmación.
- **Filtros:**
  - búsqueda por número, pedido o cliente;
  - tipo: boleta, factura, recibo u otro;
  - estado;
  - rango de fechas de emisión.

En las cuatro listas, el rango de fechas sigue las reglas comunes: si
**Desde** es posterior a **Hasta**, la barra lo marca y no se envía, y un
enlace que ya trae el rango al revés muestra el aviso y la lista vacía.
