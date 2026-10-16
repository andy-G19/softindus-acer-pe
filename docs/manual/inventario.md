# Manual de usuario — Inventario

Este capítulo describe las pantallas de Inventario que ya se renovaron. Las
reglas comunes (ventanas, guardar, cancelar, inactivar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

## Tipos de proveedor

**Dónde:** Inventario → Proveedores → Tipos de proveedor.
**Quién:** solo el administrador (ADMIN).

Los tipos de proveedor clasifican a los proveedores, por ejemplo
«Distribuidor» o «Fabricante».

- **Crear:** pulsa **Nuevo tipo de proveedor**, completa el nombre y el slug
  y pulsa **Crear**. Los tipos nuevos nacen activos.
- **Editar:** pulsa **Editar** en la fila. La ventana muestra el código del
  tipo debajo del título.
- **Inactivar:** pulsa **Inactivar** y confirma. Un tipo inactivo deja de
  ofrecerse al registrar proveedores; los proveedores que ya lo usan lo
  conservan. Puedes volver a activarlo cuando quieras.

## Categorías de materiales

**Dónde:** Inventario → Materiales → Categorías.
**Quién:** el administrador (ADMIN) las crea, edita e inactiva; el maestro
de taller (WORKSHOP_MASTER) solo las consulta y ve «Solo lectura».

Las categorías agrupan los materiales e insumos, por ejemplo «Planchas» o
«Consumibles».

- **Crear:** pulsa **Nueva categoría**, completa el nombre y el slug y pulsa
  **Crear**. Las categorías nuevas nacen activas.
- **Editar:** pulsa **Editar** en la fila.
- **Inactivar:** pulsa **Inactivar** y confirma. Una categoría inactiva deja
  de ofrecerse al registrar materiales; los materiales que ya la usan la
  conservan.

## Reglas de los dos catálogos

- **Nombre:** obligatorio, de 2 a 80 caracteres.
- **Slug:** obligatorio. Es el identificador interno del registro: solo
  admite **minúsculas, números y guiones bajos**, sin espacios ni tildes; por
  ejemplo, `materia_prima`.
- **Descripción:** opcional, hasta 500 caracteres.
- No puede haber dos registros con el mismo nombre ni con el mismo slug. Si
  lo intentas, la ventana te lo indica en el campo **Nombre** y conserva lo
  que escribiste.
