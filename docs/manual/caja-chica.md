# Manual de usuario — Caja chica

Este capítulo describe las pantallas de Caja chica que ya se renovaron. Las
reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

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
