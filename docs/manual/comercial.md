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
