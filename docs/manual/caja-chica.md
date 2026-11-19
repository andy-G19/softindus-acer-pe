# Manual de usuario — Caja chica

Este capítulo describe las pantallas de Caja chica. Las reglas comunes
(ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

Toda el área es **solo del administrador (ADMIN)**.

## Inicio de Caja chica

**Dónde:** Caja chica, en el menú.

Arriba están los indicadores: el saldo de las cajas abiertas, los ingresos,
los egresos y el resultado del mes, las cajas abiertas y registradas, las
categorías activas y los movimientos del mes. Debajo aparecen los últimos
movimientos, las últimas cajas y las tarjetas de cada pantalla: el listado de
cajas, abrir una caja, registrar un egreso, registrar un ingreso o ajuste,
los movimientos, el resumen mensual y las categorías de gasto.

## Cajas chicas

**Dónde:** Caja chica → Listado de cajas chicas.

Cada fila muestra el código, el nombre, el responsable, la fecha de
apertura, el saldo inicial, el saldo actual, cuántos movimientos tiene y su
estado («Abierta» o «Cerrada»). Abajo están los totales.

### Abrir una caja

1. Pulsa **Abrir caja**.
2. Escribe el **nombre de la caja** (de 3 a 100 caracteres), el **saldo
   inicial** (cero o más) y la **fecha de apertura**. El responsable y las
   observaciones son opcionales.
3. Pulsa **Abrir caja chica**.

No puede haber dos cajas con el mismo nombre. La caja nace **abierta**, y
solo en una caja abierta se registran o anulan movimientos.

## Registrar un egreso

**Dónde:** Caja chica → Registrar egreso.

1. Elige la **caja chica** (solo las abiertas) y la **categoría de gasto**
   (solo las activas).
2. Escribe el **concepto** (de 3 a 150 caracteres), el **monto** y la
   **fecha del egreso**. El comprobante, el responsable y las observaciones
   son opcionales.
3. Pulsa **Registrar egreso**.

El egreso descuenta su monto del saldo de la caja. No puede ser mayor que el
saldo: el sistema responde «El egreso supera el saldo disponible de la caja.
Saldo actual: S/ …». Un egreso enviado dos veces se registra una sola vez.
Al guardar vuelves al inicio de Caja chica.

## Registrar un ingreso o ajuste

**Dónde:** Caja chica → Registrar ingreso o ajuste.

1. Elige la **caja chica** (solo las abiertas) y el **tipo de operación**:
   - **Ingreso menor**, que aumenta el saldo;
   - **Ajuste positivo**, que aumenta el saldo;
   - **Ajuste negativo**, que lo disminuye.
2. Escribe el **concepto**, el **monto** y la **fecha del movimiento**. El
   comprobante o referencia, el responsable y las observaciones son
   opcionales.
3. Pulsa **Registrar movimiento**.

Un ajuste negativo no puede superar el saldo de la caja. Un movimiento
enviado dos veces se registra una sola vez.

## Movimientos de caja

**Dónde:** Caja chica → Movimientos de caja.

Cada fila muestra la fecha, el tipo, el concepto, la caja, la categoría, el
responsable, el comprobante, quién lo registró y el monto.

**Filtros:** caja chica, tipo de movimiento (ingresos, egresos o ajustes),
categoría, **Desde** y **Hasta**, y una búsqueda por concepto, comprobante o
responsable. Pulsa **Aplicar filtros**; **Limpiar filtros** los quita. Esta
barra es la única que todavía no avisa si las fechas quedan al revés.

### Anular un movimiento

**Anular** pide confirmar. La pregunta nombra el movimiento por su concepto y
monto, y dice a dónde va el dinero:

- si anulas un egreso o un ajuste negativo, su monto **vuelve a la caja**;
- si anulas un ingreso o un ajuste positivo, su monto **se descuenta** de la
  caja.

No se puede deshacer. Solo se anulan movimientos de cajas abiertas, y un
ingreso no se anula si la caja ya no tiene saldo para descontarlo. El
ingreso de una venta de chatarra no se anula desde aquí: su fila muestra la
venta («Venta VCH…») en lugar del botón.

## Resumen mensual

**Dónde:** Caja chica → Resumen mensual.

Elige el **periodo de análisis** (un mes) y pulsa **Consultar**. El resumen
muestra las ventas cobradas, los saldos pendientes, los costos de
producción, la utilidad estimada, el resultado de caja chica, los gastos por
categoría y los movimientos del mes.

## Categorías de gasto

**Dónde:** Caja chica → Categorías.
**Quién:** solo el administrador (ADMIN).

Las categorías clasifican los egresos de caja chica, por ejemplo «Fletes y
movilidad» o «Útiles de oficina». Arriba de la lista se ven cuántas hay en
total, cuántas están activas y cuántas inactivas.

- **Crear:** pulsa **Nueva categoría**, escribe el nombre (y, si quieres,
  una descripción) y pulsa **Guardar categoría**. Las categorías nuevas
  **nacen activas**.
- **Editar:** pulsa **Editar** en la fila; se abre una ventana con los datos.
  También puedes abrir la edición por su dirección
  (`/dashboard/petty-cash/categories/<código>/edit`): el mismo formulario se
  muestra a pantalla completa y, al guardar, vuelve a la lista.
- **Inactivar:** pulsa **Inactivar** y confirma. Una categoría inactiva deja
  de ofrecerse al registrar gastos de caja chica; los gastos ya registrados la
  conservan. Puedes volver a activarla cuando quieras.
- **Activar:** pulsa **Activar**; se activa sin preguntar.

El estado de una categoría solo se cambia con los botones **Inactivar** y
**Activar** de la lista, no desde el formulario de edición. Así cada cambio
de estado pide confirmación y queda registrado como tal en la bitácora.

**Reglas:**

- **Nombre:** obligatorio, de 3 a 80 caracteres. Los espacios al principio y
  al final se quitan solos.
- No puede haber dos categorías con el mismo nombre, aunque cambien
  mayúsculas y minúsculas («Fletes» y «fletes» son la misma).
- **Descripción:** opcional, hasta 500 caracteres.

**Filtros:** la barra de arriba busca por nombre y filtra por estado
(activas o inactivas). **Limpiar** quita los filtros.
