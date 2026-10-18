# Manual de usuario — Reportes

Este capítulo describe los reportes, el historial de exportaciones y la
bitácora de auditoría. Las reglas comunes (filtros, teclado y permisos)
están en [Cómo funcionan las pantallas](00-patrones.md).

## Dónde están y quién los ve

- **Administrador (ADMIN):** entra desde **Reportes** en el menú. El panel
  muestra los indicadores del mes y una tarjeta por cada reporte.
- **Vendedor (SELLER):** entra desde la tarjeta **Reportes comerciales** del
  inicio, que abre el reporte de ventas y cobranzas.
- **Maestro de taller (WORKSHOP_MASTER):** entra desde la tarjeta **Reportes
  operativos** del inicio, que abre el reporte de producción. También puede
  ver los de inventario y mantenimiento, aunque por ahora ninguna tarjeta
  lleva a ellos.

| Reporte | Qué muestra | Quién lo ve | Exporta |
|---|---|---|---|
| Ventas y cobranzas | Pedidos, proformas, adelantos, amortizaciones, saldos y estados de cobranza | ADMIN y SELLER | Excel y PDF |
| Inventario | Movimientos por material, tipo, responsable, fechas y orden de trabajo | ADMIN y WORKSHOP_MASTER | Excel y PDF |
| Producción | Órdenes de trabajo: cantidad fabricada, avance y retrasos | ADMIN y WORKSHOP_MASTER | Excel y PDF |
| Mantenimiento | Fallas, reparaciones, costos, repuestos, preventivos y reincidencias | ADMIN y WORKSHOP_MASTER | Excel y PDF |
| Proveedores y compras | Compras, materiales, comprobantes, pagos, saldos y precios históricos | ADMIN | Excel y PDF |
| Financiero | Caja chica, cobros, costos de producción, utilidad estimada, cuentas por cobrar y compras por pagar | ADMIN | Excel y PDF |
| Costos y rentabilidad | Costeos, márgenes, utilidad estimada y alertas de baja rentabilidad | ADMIN | Excel y PDF |
| Personal y planillas | Asistencias, faltas, tardanzas, planillas y pagos por operario | ADMIN | Excel y PDF |
| Historial de exportaciones | Quién exportó qué reporte, en qué formato, con qué filtros y cuándo | ADMIN | No |
| Bitácora de operaciones (auditoría) | Acciones críticas por usuario, acción, entidad afectada y fecha | ADMIN | Excel y PDF |

## Filtrar un reporte

Cada reporte tiene una barra de filtros arriba, con un rango de fechas y los
filtros propios del reporte (cliente, material, máquina, estado…).

- El rango se elige con **Fecha desde** y **Fecha hasta** (en costos y
  rentabilidad, personal y planillas y la bitácora, **Desde** y **Hasta**).
  Los dos días se incluyen completos.
- **Hasta** no ofrece días anteriores a **Desde**. Si quedan al revés,
  **Hasta** muestra «La fecha inicial no puede ser mayor que la fecha
  final.» y la barra no se envía hasta corregirlo.
- Pulsa **Aplicar filtros** (o **Filtrar**) para ver el reporte con esos
  filtros, y **Limpiar filtros** (o **Limpiar**) para quitarlos todos.
- Los filtros quedan en la dirección de la página: puedes guardarla en
  favoritos o compartirla.

Si abres un enlace guardado con las fechas al revés, el reporte no muestra
datos: **Hasta** explica el problema, en lugar de los totales y la tabla
aparece «Corrige el rango de fechas para ver el reporte.» y no se ofrece
exportar. Corrige las fechas y vuelve a filtrar.

## Exportar

Los botones **Exportar Excel** y **Exportar PDF**, arriba a la derecha,
descargan el reporte con los mismos filtros que tienes en pantalla.

- El Excel trae hasta 1.000 filas. El PDF dibuja hasta 80 filas; si hay
  más, lo indica en una nota.
- Para exportar, el rango no puede superar 366 días. Con un rango más largo
  el reporte se sigue viendo, pero en lugar de los botones aparece «Para
  exportar, el rango no puede superar 366 días.».
- Cada exportación queda registrada en el historial de exportaciones y en
  la bitácora.

## Historial de exportaciones

**Dónde:** Reportes → Historial de exportaciones.
**Quién:** solo el administrador (ADMIN).

Muestra cada exportación con su código, fecha, usuario, reporte, formato,
estado, archivo y filtros usados. Se filtra por fechas, reporte, formato,
estado, usuario y texto (archivo o filtros). Es de solo lectura.

## Bitácora de operaciones (auditoría)

**Dónde:** Reportes → tarjeta «Bitacora de auditoria» (la pantalla se
titula «Bitácora de operaciones»).
**Quién:** solo el administrador (ADMIN).

Muestra las acciones críticas: fecha, usuario, acción, entidad afectada,
registro, detalle e IP. Se filtra por texto, usuario, acción, entidad y
fechas, y se recorre por páginas de 20 operaciones. Es de solo lectura: nada
se edita ni se borra desde aquí.
