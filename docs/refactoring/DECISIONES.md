# Decisiones de negocio pendientes

Preparada el 2026-11-19 a partir de las tablas «Hallazgos abiertos y su destino» de los cierres de
las entregas 10 y 11 (`SEGUIMIENTO.md`). Son reglas que el código no puede decidir solo: hacen falta
el responsable del sistema y, en algunas, el taller.

## Cómo se usa esta hoja

- Cada decisión tiene un código (N1 a N23), lo que pasa hoy, las opciones, una recomendación y el
  costo de cada opción.
- **Costo:** «nada» (solo se anota), «pequeño» (un `fix` de un commit), «mediano» (unos pocos
  commits, a veces con una migración) o «grande» (una entrega propia).
- Escribe la opción elegida en la columna **Decisión** del resumen. Cuando una se decida, se
  implementa con su prueba en rojo primero, como siempre, y su fila de `SEGUIMIENTO.md` se cierra.
- «Queda como está» siempre es una opción válida: cuesta solo anotarla.

## Prioridad

- **Alta:** afecta datos, dinero o el trabajo diario. Conviene decidirla pronto.
- **Media:** se nota en algunos casos, pero hay forma de trabajar mientras tanto.
- **Baja:** detalle de filtros, textos o casos raros. Puede esperar sin riesgo.

## Resumen

| Código | Área | Decisión | Prioridad | Quién decide | Costo de cambiar | Decisión |
|---|---|---|---|---|---|---|
| N1 | Fechas | ¿Los días son de Lima o de UTC? | Alta | Responsable | Grande | |
| N2 | Producción | ¿A qué estado vuelve un pedido cuando se anula su orden? (D77) | Alta | Taller | Pequeño | |
| N3 | Producción | ¿Qué hace «Finalizar» en el listado de órdenes? (D83) | Alta | Responsable | Pequeño | |
| N4 | Producción | ¿Un pedido con varios productos admite una orden por producto? | Alta | Taller | Mediano | |
| N5 | Personal y costos | ¿La tarifa del operario es diaria o por hora? (57) | Alta | Taller | Mediano | |
| N6 | Producción | ¿Quién registra la cantidad producida de una campaña? (D70) | Media | Taller | Mediano | |
| N7 | Inventario | ¿La alerta de stock mira el stock actual o el disponible? | Media | Responsable | Pequeño | |
| N8 | Comercial | ¿Se pueden pedir cantidades menores que 1 (0,5 m)? | Media | Taller | Pequeño | |
| N9 | Mantenimiento | ¿Qué hacen con la máquina y la falla una reparación anulada o ejecutada? | Media | Taller | Mediano | |
| N10 | Usuarios | ¿Se protege al último administrador? | Media | Responsable | Pequeño | |
| N11 | Usuarios | ¿Restablecer la contraseña cierra las sesiones abiertas? | Media | Responsable | Mediano | |
| N12 | Inventario | Las compras «parcial» con saldo 0.00 de antes del arreglo | Media | Responsable | Pequeño | |
| N13 | Personal | ¿Una planilla anulada sigue ocupando su periodo? (D57) | Baja | Responsable | Mediano | |
| N14 | Personal | Las tarjetas de planillas: una con filtros y tres sin ellos | Baja | Responsable | Pequeño | |
| N15 | Producción | ¿El requerimiento y las campañas redondean como la base? (D71) | Baja | Responsable | Pequeño | |
| N16 | Producción | ¿Anular una campaña finalizada conserva su fecha de fin? | Baja | Responsable | Pequeño | |
| N17 | Producción | Reglas para anular versiones de receta y para elegir su base | Baja | Responsable | Pequeño | |
| N18 | Inventario | ¿Atender una alerta se registra en la bitácora? | Baja | Responsable | Pequeño | |
| N19 | Reportes | ¿Los filtros de cliente y proveedor de dos reportes ofrecen inactivos? | Baja | Responsable | Pequeño | |
| N20 | Comercial | ¿El filtro «Producto» de pedidos ofrece productos inactivos? | Baja | Responsable | Pequeño | |
| N21 | Comercial | ¿El filtro «Estado» de pedidos ofrece «En producción»? | Baja | Responsable | Pequeño | |
| N22 | Mantenimiento | Los totales de reparaciones antiguas que difieren en un céntimo | Baja | Responsable | Mediano | |
| N23 | Usuarios | ¿El nombre de usuario distingue mayúsculas? | Baja | Responsable | Mediano | |

## Prioridad alta

### N1. ¿Los días son de Lima o de UTC?

**Hoy:** el servidor (Vercel) usa la hora UTC, cinco horas por delante de Lima. Lo que se registra
después de las 19:00 de Lima cuenta como del día siguiente:
- un pedido creado a las 20:00 con entrega «hoy» da «no puede ser anterior a la fecha del pedido»;
- los formularios proponen la fecha de mañana;
- los filtros «Desde» y «Hasta» y los reportes cortan los días a las 19:00 de Lima.

Además, una fecha que no existe en la URL (30 de febrero) filtra desde el 2 de marzo.

**Opciones:**
- **A. Días de Lima en todo el sistema:** valores por defecto, filtros, reportes y validaciones.
- **B. Queda en UTC** y se avisa en el manual.

**Recomendación:** A. Es lo que cualquier usuario espera, y el error aparece justo al cierre de la
jornada.

**Costo:** A, grande (una entrega propia: toca todos los filtros y reportes, y se verifica pantalla por
pantalla); B, nada.

### N2. ¿A qué estado vuelve un pedido cuando se anula su orden? (D77)

**Hoy:** crear una orden de trabajo pasa el pedido a «En producción». Si después se anula esa
orden, el pedido se queda en «En producción» para siempre: no se puede editar, cancelar ni crearle
otra orden.

**Opciones** (si el pedido tiene otra orden que no está anulada, sigue «En producción» en todas):
- **A.** Al anular su única orden viva, el pedido vuelve a «Aprobado».
- **B.** Vuelve a «Registrado».
- **C.** Queda como está y se corrige a mano en la base.

El sistema no guarda el estado que tenía el pedido antes de su primera orden. Volver exactamente a
ese estado exigiría una columna nueva, con su migración.

**Recomendación:** A. Si el pedido llegó a tener una orden, ya estaba listo para producir.

**Costo:** pequeño para A o B; va junto con N3.

### N3. ¿Qué hace «Finalizar» en el listado de órdenes? (D83)

**Hoy:** el botón «Finalizar» exige todas las etapas terminadas, pero terminar la última etapa ya
finaliza la orden sola. El botón nunca puede tener éxito: cuando se cumple su condición, la orden ya
está finalizada.

**Opciones:**
- **A.** Se quita el botón; finalizar ocurre al terminar la última etapa, y se anota en la
  bitácora.
- **B.** El botón finaliza aunque queden etapas pendientes (cierre manual).

**Recomendación:** A. El flujo real ya finaliza solo, y un botón que no funciona confunde.

**Costo:** pequeño.

### N4. ¿Un pedido con varios productos admite una orden por producto?

**Hoy:** un pedido puede tener varios productos (detalles), pero solo el primero recibe orden de
trabajo. La primera orden pasa el pedido a «En producción», y desde entonces no se ofrecen sus otros
detalles.

**Opciones:**
- **A.** Una orden por detalle, y el pedido pasa a «En producción» con la primera y a terminado
  cuando terminan todas.
- **B.** Un pedido tiene un solo producto (se valida al crearlo).
- **C.** Queda como está.

**Recomendación:** depende de cómo vende el taller. Si un cliente pide varios productos en un mismo
pedido, A; si no, B, para que la pantalla no ofrezca lo que no se puede producir.

**Costo:** A, mediano; B, pequeño.

### N5. ¿La tarifa del operario es diaria o por hora? (57)

**Hoy:** la planilla multiplica la tarifa por días trabajados, y el costeo la usa como tarifa por
hora. Los dos cálculos leen el mismo número con unidades distintas, así que uno de los dos está mal.

**Opciones:**
- **A.** Tarifa diaria: el costeo la convierte a horas con una jornada fija (por ejemplo, 8 h).
- **B.** Tarifa por hora: la planilla multiplica por las horas de asistencia.
- **C.** Dos tarifas separadas en el operario (diaria y por hora).

**Recomendación:** que el taller diga cómo paga de verdad. Si paga por día, A.

**Costo:** mediano. Puede necesitar migración (C) y cambia montos calculados desde ese momento: los
ya guardados no se tocan.

## Prioridad media

### N6. ¿Quién registra la cantidad producida de una campaña? (D70)

**Hoy:** nadie escribe la cantidad producida de los productos de una campaña. «Producido» y «Avance»
de campañas dan siempre 0.

**Opciones:**
- **A.** Se suma sola de las órdenes de la campaña al cerrar sus materiales (unidades producidas).
- **B.** Se escribe a mano en el detalle de la campaña.
- **C.** Se quitan «Producido» y «Avance» de la pantalla.

**Recomendación:** A, porque el cierre de materiales ya pide las unidades producidas.

**Costo:** mediano.

### N7. ¿La alerta de stock mira el stock actual o el disponible?

**Hoy:** la alerta compara el stock actual con el mínimo, pero el indicador «Stock crítico» y el
filtro «Críticos» comparan el disponible (actual menos lo reservado para órdenes). Un material
puede estar crítico sin alerta.

**Opciones:**
- **A.** Todo con el disponible.
- **B.** Todo con el actual.

**Recomendación:** A. Lo reservado ya está comprometido para una orden.

**Costo:** pequeño.

### N8. ¿Se pueden pedir cantidades menores que 1?

**Hoy:** el campo «Cantidad» del pedido no acepta menos de 1, aunque el sistema guarda cualquier
positivo. No se puede pedir 0,5 m de baranda desde la pantalla.

**Opciones:**
- **A.** Se acepta cualquier cantidad mayor que 0, con dos decimales.
- **B.** Solo enteros desde 1, y el sistema lo valida también.

**Recomendación:** depende de los productos. Si se venden por metro o kilo, A.

**Costo:** pequeño.

### N9. ¿Qué hacen con la máquina y la falla una reparación anulada o ejecutada?

**Hoy:**
- crear una reparación ya anulada no toca la falla ni la máquina;
- una reparación ejecutada deja la máquina «operativa» aunque se haya inactivado o dado de baja;
- una programada u observada la deja «en reparación».

**Opciones:**
- **A.** Ejecutar solo devuelve a «operativa» una máquina activa; una dada de baja se queda así.
- **B.** Queda como está.

**Recomendación:** A, para no «revivir» una máquina dada de baja.

**Costo:** mediano (reglas de estado con su bloqueo de fila).

### N10. ¿Se protege al último administrador?

**Hoy:** dos administradores pueden desactivarse a la vez y dejar el sistema sin ninguno.

**Opciones:**
- **A.** No se puede desactivar ni quitar el rol al último administrador activo.
- **B.** Queda como está.

**Recomendación:** A. Recuperarse exige tocar la base a mano.

**Costo:** pequeño.

### N11. ¿Restablecer la contraseña cierra las sesiones abiertas?

**Hoy:** restablecer la contraseña de un usuario no cierra sus sesiones abiertas. La ventana lo
dice y aconseja desactivarlo si hace falta cortarlas.

**Opciones:**
- **A.** Restablecer cierra las sesiones (una columna nueva en el usuario, con migración).
- **B.** Queda como está, con el aviso.

**Recomendación:** A, si se restablece por sospecha de que alguien conoce la clave. Si solo se
restablece por olvido, B basta.

**Costo:** A, mediano.

### N12. Las compras «parcial» con saldo 0.00 de antes del arreglo

**Hoy:** antes del arreglo de la 11.2a, un último pago podía dejar una compra «parcial» con saldo
0.00. El detalle ya no ofrece pagarlas, pero su estado no dice «pagada». En staging no quedó
ninguna así; producción no se consultó.

**Opciones:**
- **A.** Consultar producción (solo lectura, con tu permiso) y, si hay alguna, pasarla a «pagada»
  con un script revisado.
- **B.** Dejarlas.

**Recomendación:** A, empezando por la consulta: puede que no haya ninguna.

**Costo:** pequeño.

## Prioridad baja

### N13. ¿Una planilla anulada sigue ocupando su periodo? (D57)

**Hoy:** una planilla anulada libera sus días para otra planilla, pero no con el mismo periodo
exacto: el índice único de la base lo impide.

**Opciones:**
- **A.** Un índice parcial que no cuente las anuladas (migración).
- **B.** Queda como está: se genera con un periodo que difiera en un día.

**Recomendación:** B, salvo que pase seguido.

**Costo:** A, mediano.

### N14. Las tarjetas de planillas: una con filtros y tres sin ellos

**Hoy:** en la lista de planillas, «Planillas generadas» cuenta las planillas del filtro, y
«Pendientes», «Pagadas» y «Anuladas» cuentan todas. Los textos ya lo dicen.

**Opciones:**
- **A.** Las cuatro con los filtros.
- **B.** Las cuatro sin filtros.
- **C.** Queda como está.

**Recomendación:** A, que es lo que se espera al filtrar.

**Costo:** pequeño.

### N15. ¿El requerimiento y las campañas redondean como la base? (D71)

**Hoy:** el requerimiento congelado de una orden y las cantidades de campaña redondean con un
método que da 2,67 donde la base daría 2,68 (los casos que terminan en 5).

**Opciones:**
- **A.** Redondear como la base desde ahora. Las órdenes viejas conservan lo que guardaron.
- **B.** Queda como está.

**Recomendación:** A. La diferencia es de un centésimo y solo en órdenes nuevas.

**Costo:** pequeño.

### N16. ¿Anular una campaña finalizada conserva su fecha de fin?

**Hoy:** finalizar o anular una campaña escribe la fecha de fin. Al anular una finalizada se pierde
la fecha real en que terminó, y finalizar antes del inicio deja el fin antes que el inicio.

**Opciones:**
- **A.** Anular no toca una fecha de fin ya escrita, y finalizar no acepta una fecha anterior al
  inicio.
- **B.** Queda como está.

**Recomendación:** A.

**Costo:** pequeño.

### N17. Reglas para anular versiones de receta y para elegir su base

**Hoy:**
- anular una versión no exige que la receta esté activa, y marcarla vigente sí;
- una versión nueva puede partir de una versión anulada.

**Opciones:**
- **A.** Anular tampoco exige receta activa (queda como está), y la base debe ser una versión no
  anulada.
- **B.** Queda todo como está.

**Recomendación:** B. No se vio ningún problema real.

**Costo:** A, pequeño.

### N18. ¿Atender una alerta se registra en la bitácora?

**Hoy:** atender una alerta guarda quién y cuándo en la propia alerta, pero no escribe la bitácora.

**Opciones:**
- **A.** Escribirla también en la bitácora.
- **B.** Queda como está.

**Recomendación:** A, para que la auditoría lo vea junto con lo demás.

**Costo:** pequeño.

### N19. ¿Los filtros de cliente y proveedor de dos reportes ofrecen inactivos?

**Hoy:** el filtro de cliente del reporte de ventas y cobranzas y el de proveedor del reporte de
proveedores y compras solo ofrecen activos. Las ventas o compras de uno inactivo no se pueden
filtrar.

**Opciones:**
- **A.** Ofrecer todos, con la marca «Inactivo».
- **B.** Queda como está.

**Recomendación:** A. Un reporte mira el pasado, cuando el cliente estaba activo.

**Costo:** pequeño.

### N20. ¿El filtro «Producto» de pedidos ofrece productos inactivos?

**Hoy:** sí los ofrece.

**Opciones:**
- **A.** Ofrecer todos, con la marca «Inactivo».
- **B.** Solo activos.
- **C.** Queda como está, sin marca.

**Recomendación:** A, por la misma razón que N19.

**Costo:** pequeño.

### N21. ¿El filtro «Estado» de pedidos ofrece «En producción»?

**Hoy:** ofrece Registrado, Aprobado y Cancelado, pero crear una orden deja el pedido «En
producción»: esos pedidos no se pueden filtrar por su estado.

**Opciones:**
- **A.** Agregar «En producción».
- **B.** Queda como está.

**Recomendación:** A.

**Costo:** pequeño.

### N22. Los totales de reparaciones antiguas que difieren en un céntimo

**Hoy:** las reparaciones guardadas antes de un arreglo de redondeo conservan su total: los detalles
pueden sumar 25,62 y el total decir 25,63. La lista muestra lo guardado.

**Opciones:**
- **A.** Recalcularlas con un script de migración revisado.
- **B.** Dejarlas.

**Recomendación:** B, salvo que esos totales se usen para pagar.

**Costo:** A, mediano.

### N23. ¿El nombre de usuario distingue mayúsculas?

**Hoy:** «Ana» y «ana» pueden ser dos usuarios distintos.

**Opciones:**
- **A.** No distinguir mayúsculas al crear ni al iniciar sesión (con un índice en la base).
- **B.** Queda como está.

**Recomendación:** A, si hay más de un par de usuarios. Antes hay que comprobar que no existan dos
que choquen.

**Costo:** A, mediano (migración).
