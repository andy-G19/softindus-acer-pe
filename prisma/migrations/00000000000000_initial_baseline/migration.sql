-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "aceros";

-- CreateTable
CREATE TABLE "alerta_stock" (
    "id_alerta" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "fecha_alerta" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stock_detectado" DECIMAL(10,2) NOT NULL,
    "stock_minimo" DECIMAL(10,2) NOT NULL,
    "estado_alerta" VARCHAR(30) NOT NULL DEFAULT 'activa',
    "mensaje" VARCHAR(255),
    "fecha_atencion" TIMESTAMPTZ(6),
    "id_usuario_atencion" CHAR(11),

    CONSTRAINT "alerta_stock_pkey" PRIMARY KEY ("id_alerta")
);

-- CreateTable
CREATE TABLE "asignacion_herramienta_epp" (
    "id_asignacion" CHAR(11) NOT NULL,
    "id_herramienta_epp" CHAR(11) NOT NULL,
    "id_operario" CHAR(11) NOT NULL,
    "fecha_entrega" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_devolucion_programada" TIMESTAMPTZ(6),
    "fecha_devolucion_real" TIMESTAMPTZ(6),
    "estado_devolucion" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "id_usuario_registro" CHAR(11) NOT NULL,

    CONSTRAINT "asignacion_herramienta_epp_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateTable
CREATE TABLE "asistencia" (
    "id_asistencia" CHAR(11) NOT NULL,
    "id_operario" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_ingreso" TIME(6),
    "hora_salida" TIME(6),
    "tardanza" BOOLEAN NOT NULL DEFAULT false,
    "falta" BOOLEAN NOT NULL DEFAULT false,
    "horas_trabajadas" DECIMAL(5,2),
    "observaciones" TEXT,

    CONSTRAINT "asistencia_pkey" PRIMARY KEY ("id_asistencia")
);

-- CreateTable
CREATE TABLE "avance_orden" (
    "id_avance" CHAR(11) NOT NULL,
    "id_orden_trabajo" CHAR(11) NOT NULL,
    "id_etapa_ruta" CHAR(11) NOT NULL,
    "id_operario" CHAR(11),
    "estado_etapa" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "porcentaje_avance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fecha_inicio_etapa" TIMESTAMPTZ(6),
    "fecha_fin_etapa" TIMESTAMPTZ(6),
    "observaciones" TEXT,
    "id_usuario_actualiza" CHAR(11) NOT NULL,

    CONSTRAINT "avance_orden_pkey" PRIMARY KEY ("id_avance")
);

-- CreateTable
CREATE TABLE "bitacora_operacion" (
    "id_bitacora" CHAR(11) NOT NULL,
    "id_usuario" CHAR(11) NOT NULL,
    "entidad_afectada" VARCHAR(80) NOT NULL,
    "id_registro_afectado" CHAR(11),
    "accion" VARCHAR(30) NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalle" TEXT,
    "ip_origen" VARCHAR(45),

    CONSTRAINT "bitacora_operacion_pkey" PRIMARY KEY ("id_bitacora")
);

-- CreateTable
CREATE TABLE "caja_chica" (
    "id_caja_chica" CHAR(11) NOT NULL,
    "nombre_caja" VARCHAR(100) NOT NULL,
    "saldo_inicial" DECIMAL(12,2) NOT NULL,
    "saldo_actual" DECIMAL(12,2) NOT NULL,
    "fecha_apertura" DATE NOT NULL DEFAULT CURRENT_DATE,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'abierta',
    "responsable" VARCHAR(100),
    "observaciones" TEXT,

    CONSTRAINT "caja_chica_pkey" PRIMARY KEY ("id_caja_chica")
);

-- CreateTable
CREATE TABLE "campania_detalle" (
    "id_campania_detalle" CHAR(11) NOT NULL,
    "id_campania" CHAR(11) NOT NULL,
    "id_producto" CHAR(11) NOT NULL,
    "cantidad_objetivo" DECIMAL(10,2) NOT NULL,
    "cantidad_producida" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,

    CONSTRAINT "campania_detalle_pkey" PRIMARY KEY ("id_campania_detalle")
);

-- CreateTable
CREATE TABLE "campania_produccion" (
    "id_campania" CHAR(11) NOT NULL,
    "nombre_campania" VARCHAR(100) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "objetivo_general" TEXT,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'planificada',
    "id_usuario_registro" CHAR(11) NOT NULL,

    CONSTRAINT "campania_produccion_pkey" PRIMARY KEY ("id_campania")
);

-- CreateTable
CREATE TABLE "categoria_gasto" (
    "id_categoria_gasto" CHAR(11) NOT NULL,
    "nombre_categoria" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_gasto_pkey" PRIMARY KEY ("id_categoria_gasto")
);

-- CreateTable
CREATE TABLE "chatarra" (
    "id_chatarra" CHAR(11) NOT NULL,
    "id_material" CHAR(11),
    "tipo_material" VARCHAR(50) NOT NULL,
    "peso_kg" DECIMAL(10,2),
    "cantidad" DECIMAL(10,2),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'acumulada',
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "chatarra_pkey" PRIMARY KEY ("id_chatarra")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" CHAR(11) NOT NULL,
    "tipo_cliente" VARCHAR(50) NOT NULL,
    "nombre_razon_social" VARCHAR(150) NOT NULL,
    "tipo_documento" VARCHAR(20),
    "numero_documento" VARCHAR(20),
    "telefono" VARCHAR(20),
    "correo" VARCHAR(100),
    "direccion" VARCHAR(150),
    "lugar_origen" VARCHAR(100),
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "compra" (
    "id_compra" CHAR(11) NOT NULL,
    "id_proveedor" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_compra" DATE NOT NULL DEFAULT CURRENT_DATE,
    "tipo_comprobante" VARCHAR(30),
    "numero_comprobante" VARCHAR(30),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2),
    "monto_total" DECIMAL(12,2) NOT NULL,
    "estado_pago" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "estado_compra" VARCHAR(30) NOT NULL DEFAULT 'registrada',
    "observaciones" TEXT,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id_compra")
);

-- CreateTable
CREATE TABLE "comprobante_venta" (
    "id_comprobante" CHAR(11) NOT NULL,
    "id_pedido" CHAR(11) NOT NULL,
    "id_proforma" CHAR(11),
    "tipo_comprobante" VARCHAR(30) NOT NULL,
    "numero_comprobante" VARCHAR(30) NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_DATE,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'emitido',
    "observaciones" TEXT,

    CONSTRAINT "comprobante_venta_pkey" PRIMARY KEY ("id_comprobante")
);

-- CreateTable
CREATE TABLE "costeo" (
    "id_costeo" CHAR(11) NOT NULL,
    "id_pedido" CHAR(11),
    "id_orden_trabajo" CHAR(11),
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_costeo" DATE NOT NULL DEFAULT CURRENT_DATE,
    "costo_materiales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_consumibles" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_mano_obra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_indirecto_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costo_unitario" DECIMAL(12,2),
    "cantidad_base" DECIMAL(10,2),
    "observaciones" TEXT,

    CONSTRAINT "costeo_pkey" PRIMARY KEY ("id_costeo")
);

-- CreateTable
CREATE TABLE "costo_indirecto" (
    "id_costo_indirecto" CHAR(11) NOT NULL,
    "id_costeo" CHAR(11),
    "concepto" VARCHAR(100) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "criterio_prorrateo" VARCHAR(100),
    "periodo" VARCHAR(30),
    "fecha_registro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "observaciones" TEXT,

    CONSTRAINT "costo_indirecto_pkey" PRIMARY KEY ("id_costo_indirecto")
);

-- CreateTable
CREATE TABLE "dashboard_indicador" (
    "id_indicador" CHAR(11) NOT NULL,
    "nombre_indicador" VARCHAR(100) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "valor_numerico" DECIMAL(12,2),
    "valor_texto" VARCHAR(100),
    "unidad" VARCHAR(20),
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,

    CONSTRAINT "dashboard_indicador_pkey" PRIMARY KEY ("id_indicador")
);

-- CreateTable
CREATE TABLE "detalle_compra" (
    "id_detalle_compra" CHAR(11) NOT NULL,
    "id_compra" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "detalle_compra_pkey" PRIMARY KEY ("id_detalle_compra")
);

-- CreateTable
CREATE TABLE "detalle_pedido" (
    "id_detalle_pedido" CHAR(11) NOT NULL,
    "id_pedido" CHAR(11) NOT NULL,
    "id_producto" CHAR(11) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "detalle_pedido_pkey" PRIMARY KEY ("id_detalle_pedido")
);

-- CreateTable
CREATE TABLE "detalle_receta" (
    "id_detalle_receta" CHAR(11) NOT NULL,
    "id_version_receta" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "cantidad_requerida" DECIMAL(10,2) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "tipo_consumo" VARCHAR(30) NOT NULL,
    "merma_estimada_porcentaje" DECIMAL(5,2),
    "observaciones" TEXT,

    CONSTRAINT "detalle_receta_pkey" PRIMARY KEY ("id_detalle_receta")
);

-- CreateTable
CREATE TABLE "detalle_repuesto_reparacion" (
    "id_detalle_repuesto" CHAR(11) NOT NULL,
    "id_reparacion" CHAR(11) NOT NULL,
    "id_repuesto" CHAR(11) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalle_repuesto_reparacion_pkey" PRIMARY KEY ("id_detalle_repuesto")
);

-- CreateTable
CREATE TABLE "etapa_ruta" (
    "id_etapa_ruta" CHAR(11) NOT NULL,
    "id_ruta" CHAR(11) NOT NULL,
    "nombre_etapa" VARCHAR(100) NOT NULL,
    "orden_secuencia" INTEGER NOT NULL,
    "descripcion" TEXT,
    "tiempo_estimado_horas" DECIMAL(10,2),
    "requiere_maquina" BOOLEAN NOT NULL DEFAULT false,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "etapa_ruta_pkey" PRIMARY KEY ("id_etapa_ruta")
);

-- CreateTable
CREATE TABLE "etapa_ruta_maquina" (
    "id_etapa_ruta_maquina" CHAR(11) NOT NULL,
    "id_etapa_ruta" CHAR(11) NOT NULL,
    "id_maquina" CHAR(11) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "etapa_ruta_maquina_pkey" PRIMARY KEY ("id_etapa_ruta_maquina")
);

-- CreateTable
CREATE TABLE "exportacion_datos" (
    "id_exportacion" CHAR(11) NOT NULL,
    "id_usuario" CHAR(11) NOT NULL,
    "modulo_origen" VARCHAR(80) NOT NULL,
    "formato" VARCHAR(20) NOT NULL,
    "fecha_exportacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parametros" TEXT,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'generada',
    "ruta_archivo" VARCHAR(255),

    CONSTRAINT "exportacion_datos_pkey" PRIMARY KEY ("id_exportacion")
);

-- CreateTable
CREATE TABLE "falla_maquina" (
    "id_falla" CHAR(11) NOT NULL,
    "id_maquina" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_falla" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "responsable_registro" VARCHAR(100),
    "estado_atencion" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "tiempo_perdido_horas" DECIMAL(10,2),
    "impacto_produccion" TEXT,

    CONSTRAINT "falla_maquina_pkey" PRIMARY KEY ("id_falla")
);

-- CreateTable
CREATE TABLE "herramienta_epp" (
    "id_herramienta_epp" CHAR(11) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "codigo_interno" VARCHAR(30),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'operativo',
    "ubicacion" VARCHAR(100),
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "herramienta_epp_pkey" PRIMARY KEY ("id_herramienta_epp")
);

-- CreateTable
CREATE TABLE "historial_pago_operario" (
    "id_historial_pago" CHAR(11) NOT NULL,
    "id_planilla" CHAR(11) NOT NULL,
    "id_operario" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_pago" DATE NOT NULL DEFAULT CURRENT_DATE,
    "monto_pagado" DECIMAL(12,2) NOT NULL,
    "metodo_pago" VARCHAR(30),
    "periodo" VARCHAR(30) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "historial_pago_operario_pkey" PRIMARY KEY ("id_historial_pago")
);

-- CreateTable
CREATE TABLE "historial_precio_proveedor" (
    "id_historial_precio" CHAR(11) NOT NULL,
    "id_proveedor" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "id_compra" CHAR(11),
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "fecha_registro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "origen_registro" VARCHAR(50) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "historial_precio_proveedor_pkey" PRIMARY KEY ("id_historial_precio")
);

-- CreateTable
CREATE TABLE "mantenimiento_preventivo" (
    "id_mantenimiento" CHAR(11) NOT NULL,
    "id_maquina" CHAR(11) NOT NULL,
    "id_usuario_programa" CHAR(11) NOT NULL,
    "fecha_programada" DATE NOT NULL,
    "fecha_realizada" DATE,
    "responsable" VARCHAR(100),
    "actividad" VARCHAR(255) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,

    CONSTRAINT "mantenimiento_preventivo_pkey" PRIMARY KEY ("id_mantenimiento")
);

-- CreateTable
CREATE TABLE "maquina" (
    "id_maquina" CHAR(11) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(80) NOT NULL,
    "codigo_interno" VARCHAR(30),
    "ubicacion" VARCHAR(100),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'operativa',
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "maquina_pkey" PRIMARY KEY ("id_maquina")
);

-- CreateTable
CREATE TABLE "margen_ganancia" (
    "id_margen" CHAR(11) NOT NULL,
    "id_costeo" CHAR(11) NOT NULL,
    "id_usuario_aplica" CHAR(11) NOT NULL,
    "porcentaje_margen" DECIMAL(5,2) NOT NULL,
    "precio_sugerido" DECIMAL(12,2) NOT NULL,
    "precio_final" DECIMAL(12,2),
    "fecha_aplicacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo_ajuste" TEXT,

    CONSTRAINT "margen_ganancia_pkey" PRIMARY KEY ("id_margen")
);

-- CreateTable
CREATE TABLE "material" (
    "id_material" CHAR(11) NOT NULL,
    "nombre_material" VARCHAR(100) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "stock_actual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stock_reservado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costo_unitario_actual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id_material")
);

-- CreateTable
CREATE TABLE "movimiento_caja" (
    "id_movimiento_caja" CHAR(11) NOT NULL,
    "id_caja_chica" CHAR(11) NOT NULL,
    "id_categoria_gasto" CHAR(11),
    "id_usuario_registro" CHAR(11) NOT NULL,
    "tipo_movimiento" VARCHAR(20) NOT NULL,
    "concepto" VARCHAR(150) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha_movimiento" DATE NOT NULL DEFAULT CURRENT_DATE,
    "comprobante" VARCHAR(50),
    "responsable" VARCHAR(100),
    "observaciones" TEXT,

    CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("id_movimiento_caja")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id_movimiento" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "id_orden_trabajo" CHAR(11),
    "id_compra" CHAR(11),
    "tipo_movimiento" VARCHAR(30) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "stock_anterior" DECIMAL(10,2) NOT NULL,
    "stock_resultante" DECIMAL(10,2) NOT NULL,
    "fecha_movimiento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" VARCHAR(255),
    "id_usuario_responsable" CHAR(11) NOT NULL,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "operario" (
    "id_operario" CHAR(11) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "cargo" VARCHAR(50),
    "especialidad" VARCHAR(80),
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(150),
    "modalidad_pago" VARCHAR(30) NOT NULL,
    "tarifa" DECIMAL(12,2),
    "fecha_ingreso" DATE,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
    "observaciones" TEXT,

    CONSTRAINT "operario_pkey" PRIMARY KEY ("id_operario")
);

-- CreateTable
CREATE TABLE "orden_trabajo" (
    "id_orden_trabajo" CHAR(11) NOT NULL,
    "id_cliente" CHAR(11),
    "id_producto" CHAR(11) NOT NULL,
    "id_campania" CHAR(11),
    "id_detalle_pedido" CHAR(11),
    "id_ruta" CHAR(11),
    "id_version_receta" CHAR(11),
    "tipo_produccion" VARCHAR(30) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_entrega_estimada" DATE,
    "fecha_entrega_real" DATE,
    "prioridad" VARCHAR(20) NOT NULL DEFAULT 'media',
    "estado" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_trabajo_pkey" PRIMARY KEY ("id_orden_trabajo")
);

-- CreateTable
CREATE TABLE "pago_cliente" (
    "id_pago_cliente" CHAR(11) NOT NULL,
    "id_proforma" CHAR(11) NOT NULL,
    "id_pedido" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_pago" DATE NOT NULL DEFAULT CURRENT_DATE,
    "monto_pagado" DECIMAL(12,2) NOT NULL,
    "metodo_pago" VARCHAR(30) NOT NULL,
    "tipo_pago" VARCHAR(30) NOT NULL,
    "saldo_actual" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "pago_cliente_pkey" PRIMARY KEY ("id_pago_cliente")
);

-- CreateTable
CREATE TABLE "pago_proveedor" (
    "id_pago_proveedor" CHAR(11) NOT NULL,
    "id_compra" CHAR(11) NOT NULL,
    "id_proveedor" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_pago" DATE NOT NULL DEFAULT CURRENT_DATE,
    "monto_pagado" DECIMAL(12,2) NOT NULL,
    "metodo_pago" VARCHAR(30) NOT NULL,
    "saldo_pendiente" DECIMAL(12,2) NOT NULL,
    "estado_pago" VARCHAR(30) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "pago_proveedor_pkey" PRIMARY KEY ("id_pago_proveedor")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id_pedido" CHAR(11) NOT NULL,
    "id_cliente" CHAR(11) NOT NULL,
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_pedido" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fecha_entrega_estimada" DATE,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'registrado',
    "monto_estimado" DECIMAL(12,2),
    "observaciones" TEXT,

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id_pedido")
);

-- CreateTable
CREATE TABLE "planilla_pago" (
    "id_planilla" CHAR(11) NOT NULL,
    "id_operario" CHAR(11) NOT NULL,
    "id_usuario_genera" CHAR(11) NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fin" DATE NOT NULL,
    "modalidad_pago" VARCHAR(30) NOT NULL,
    "monto_bruto" DECIMAL(12,2) NOT NULL,
    "descuentos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_neto" DECIMAL(12,2) NOT NULL,
    "estado_pago" VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    "fecha_generacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planilla_pago_pkey" PRIMARY KEY ("id_planilla")
);

-- CreateTable
CREATE TABLE "producto" (
    "id_producto" CHAR(11) NOT NULL,
    "nombre_producto" VARCHAR(100) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "precio_referencial" DECIMAL(12,2),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "proforma" (
    "id_proforma" CHAR(11) NOT NULL,
    "id_pedido" CHAR(11) NOT NULL,
    "numero_proforma" VARCHAR(30) NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_DATE,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "adelanto_inicial" DECIMAL(12,2),
    "saldo" DECIMAL(12,2) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'vigente',
    "validez_dias" INTEGER,
    "observaciones" TEXT,

    CONSTRAINT "proforma_pkey" PRIMARY KEY ("id_proforma")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id_proveedor" CHAR(11) NOT NULL,
    "razon_social" VARCHAR(150) NOT NULL,
    "tipo_documento" VARCHAR(20),
    "numero_documento" VARCHAR(20),
    "telefono" VARCHAR(20),
    "correo" VARCHAR(100),
    "direccion" VARCHAR(150),
    "contacto_principal" VARCHAR(100),
    "tipo_proveedor" VARCHAR(50) NOT NULL,
    "condicion_pago" VARCHAR(50),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "proveedor_material" (
    "id_proveedor_material" CHAR(11) NOT NULL,
    "id_proveedor" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "precio_referencial" DECIMAL(12,2),
    "unidad_medida" VARCHAR(20) NOT NULL,
    "tiempo_entrega_dias" INTEGER,
    "disponibilidad" VARCHAR(30),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_actualizacion" TIMESTAMPTZ(6),

    CONSTRAINT "proveedor_material_pkey" PRIMARY KEY ("id_proveedor_material")
);

-- CreateTable
CREATE TABLE "reasignacion_tarea" (
    "id_reasignacion" CHAR(11) NOT NULL,
    "id_avance" CHAR(11) NOT NULL,
    "id_operario_anterior" CHAR(11),
    "id_operario_nuevo" CHAR(11) NOT NULL,
    "motivo" VARCHAR(255) NOT NULL,
    "fecha_reasignacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_responsable" CHAR(11) NOT NULL,

    CONSTRAINT "reasignacion_tarea_pkey" PRIMARY KEY ("id_reasignacion")
);

-- CreateTable
CREATE TABLE "receta_tecnica" (
    "id_receta" CHAR(11) NOT NULL,
    "id_producto" CHAR(11) NOT NULL,
    "nombre_receta" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activa',
    "fecha_creacion" DATE NOT NULL DEFAULT CURRENT_DATE,
    "id_usuario_creacion" CHAR(11) NOT NULL,

    CONSTRAINT "receta_tecnica_pkey" PRIMARY KEY ("id_receta")
);

-- CreateTable
CREATE TABLE "rentabilidad" (
    "id_rentabilidad" CHAR(11) NOT NULL,
    "id_pedido" CHAR(11),
    "id_costeo" CHAR(11) NOT NULL,
    "ingreso_estimado" DECIMAL(12,2) NOT NULL,
    "costo_total" DECIMAL(12,2) NOT NULL,
    "utilidad_estimada" DECIMAL(12,2) NOT NULL,
    "margen_real" DECIMAL(5,2) NOT NULL,
    "alerta_bajo_margen" BOOLEAN NOT NULL DEFAULT false,
    "fecha_calculo" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "rentabilidad_pkey" PRIMARY KEY ("id_rentabilidad")
);

-- CreateTable
CREATE TABLE "reparacion" (
    "id_reparacion" CHAR(11) NOT NULL,
    "id_falla" CHAR(11) NOT NULL,
    "fecha_reparacion" DATE NOT NULL DEFAULT CURRENT_DATE,
    "tecnico_proveedor" VARCHAR(100),
    "mano_obra" DECIMAL(12,2),
    "costo_total" DECIMAL(12,2) NOT NULL,
    "estado_reparacion" VARCHAR(30) NOT NULL DEFAULT 'programada',
    "observaciones" TEXT,

    CONSTRAINT "reparacion_pkey" PRIMARY KEY ("id_reparacion")
);

-- CreateTable
CREATE TABLE "reporte" (
    "id_reporte" CHAR(11) NOT NULL,
    "id_usuario" CHAR(11) NOT NULL,
    "tipo_reporte" VARCHAR(80) NOT NULL,
    "fecha_generacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formato" VARCHAR(20) NOT NULL,
    "parametros" TEXT,
    "ruta_archivo" VARCHAR(255),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'generado',

    CONSTRAINT "reporte_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateTable
CREATE TABLE "repuesto" (
    "id_repuesto" CHAR(11) NOT NULL,
    "id_proveedor" CHAR(11),
    "nombre_repuesto" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "repuesto_pkey" PRIMARY KEY ("id_repuesto")
);

-- CreateTable
CREATE TABLE "retazo_reutilizable" (
    "id_retazo" CHAR(11) NOT NULL,
    "id_material" CHAR(11) NOT NULL,
    "id_orden_trabajo" CHAR(11),
    "tipo_material" VARCHAR(50) NOT NULL,
    "medida_aproximada" VARCHAR(80),
    "cantidad" DECIMAL(10,2) NOT NULL,
    "unidad_medida" VARCHAR(20) NOT NULL,
    "ubicacion" VARCHAR(100),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'disponible',
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_registro" CHAR(11) NOT NULL,

    CONSTRAINT "retazo_reutilizable_pkey" PRIMARY KEY ("id_retazo")
);

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" CHAR(11) NOT NULL,
    "nombre_rol" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "ruta_fabricacion" (
    "id_ruta" CHAR(11) NOT NULL,
    "id_producto" CHAR(11) NOT NULL,
    "nombre_ruta" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ruta_fabricacion_pkey" PRIMARY KEY ("id_ruta")
);

-- CreateTable
CREATE TABLE "tarea_operario" (
    "id_tarea_operario" CHAR(11) NOT NULL,
    "id_operario" CHAR(11) NOT NULL,
    "id_orden_trabajo" CHAR(11) NOT NULL,
    "id_etapa_ruta" CHAR(11),
    "id_usuario_registro" CHAR(11) NOT NULL,
    "fecha_tarea" DATE NOT NULL DEFAULT CURRENT_DATE,
    "descripcion" VARCHAR(255) NOT NULL,
    "horas_dedicadas" DECIMAL(5,2),
    "estado" VARCHAR(30) NOT NULL DEFAULT 'registrada',
    "observaciones" TEXT,

    CONSTRAINT "tarea_operario_pkey" PRIMARY KEY ("id_tarea_operario")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" CHAR(11) NOT NULL,
    "id_rol" CHAR(11) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "correo" VARCHAR(100),
    "clave_hash" VARCHAR(255) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acceso" TIMESTAMPTZ(6),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "venta_chatarra" (
    "id_venta_chatarra" CHAR(11) NOT NULL,
    "id_chatarra" CHAR(11) NOT NULL,
    "id_movimiento_caja" CHAR(11),
    "fecha_venta" DATE NOT NULL DEFAULT CURRENT_DATE,
    "cantidad_vendida" DECIMAL(10,2),
    "peso_vendido_kg" DECIMAL(10,2),
    "monto_recibido" DECIMAL(12,2) NOT NULL,
    "destino_dinero" VARCHAR(150),
    "id_usuario_registro" CHAR(11) NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "venta_chatarra_pkey" PRIMARY KEY ("id_venta_chatarra")
);

-- CreateTable
CREATE TABLE "version_receta" (
    "id_version_receta" CHAR(11) NOT NULL,
    "id_receta" CHAR(11) NOT NULL,
    "numero_version" VARCHAR(20) NOT NULL,
    "fecha_version" DATE NOT NULL DEFAULT CURRENT_DATE,
    "motivo_cambio" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'vigente',
    "id_usuario_aprueba" CHAR(11),

    CONSTRAINT "version_receta_pkey" PRIMARY KEY ("id_version_receta")
);

-- CreateIndex
CREATE INDEX "idx_alerta_estado" ON "alerta_stock"("estado_alerta");

-- CreateIndex
CREATE INDEX "idx_alerta_material" ON "alerta_stock"("id_material");

-- CreateIndex
CREATE INDEX "idx_asignacion_estado" ON "asignacion_herramienta_epp"("estado_devolucion");

-- CreateIndex
CREATE INDEX "idx_asignacion_herramienta" ON "asignacion_herramienta_epp"("id_herramienta_epp");

-- CreateIndex
CREATE INDEX "idx_asignacion_operario" ON "asignacion_herramienta_epp"("id_operario");

-- CreateIndex
CREATE INDEX "idx_asistencia_fecha" ON "asistencia"("fecha" DESC);

-- CreateIndex
CREATE INDEX "idx_asistencia_operario" ON "asistencia"("id_operario");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asistencia_operario_fecha" ON "asistencia"("id_operario", "fecha");

-- CreateIndex
CREATE INDEX "idx_avance_estado" ON "avance_orden"("estado_etapa");

-- CreateIndex
CREATE INDEX "idx_avance_etapa" ON "avance_orden"("id_etapa_ruta");

-- CreateIndex
CREATE INDEX "idx_avance_operario" ON "avance_orden"("id_operario");

-- CreateIndex
CREATE INDEX "idx_avance_orden" ON "avance_orden"("id_orden_trabajo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_avance_orden_etapa" ON "avance_orden"("id_orden_trabajo", "id_etapa_ruta");

-- CreateIndex
CREATE INDEX "idx_bitacora_accion" ON "bitacora_operacion"("accion");

-- CreateIndex
CREATE INDEX "idx_bitacora_entidad" ON "bitacora_operacion"("entidad_afectada", "id_registro_afectado");

-- CreateIndex
CREATE INDEX "idx_bitacora_usuario_fecha" ON "bitacora_operacion"("id_usuario", "fecha_hora" DESC);

-- CreateIndex
CREATE INDEX "idx_caja_estado" ON "caja_chica"("estado");

-- CreateIndex
CREATE INDEX "idx_campania_detalle_campania" ON "campania_detalle"("id_campania");

-- CreateIndex
CREATE INDEX "idx_campania_detalle_producto" ON "campania_detalle"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_campania_producto" ON "campania_detalle"("id_campania", "id_producto");

-- CreateIndex
CREATE INDEX "idx_campania_estado" ON "campania_produccion"("estado");

-- CreateIndex
CREATE INDEX "idx_campania_fechas" ON "campania_produccion"("fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_gasto_nombre_categoria_key" ON "categoria_gasto"("nombre_categoria");

-- CreateIndex
CREATE INDEX "idx_categoria_gasto_estado" ON "categoria_gasto"("estado");

-- CreateIndex
CREATE INDEX "idx_chatarra_estado" ON "chatarra"("estado");

-- CreateIndex
CREATE INDEX "idx_chatarra_material" ON "chatarra"("id_material");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_numero_documento_key" ON "cliente"("numero_documento");

-- CreateIndex
CREATE INDEX "idx_cliente_estado" ON "cliente"("estado");

-- CreateIndex
CREATE INDEX "idx_cliente_nombre" ON "cliente"("nombre_razon_social");

-- CreateIndex
CREATE INDEX "idx_cliente_tipo" ON "cliente"("tipo_cliente");

-- CreateIndex
CREATE INDEX "idx_compra_estado" ON "compra"("estado_compra");

-- CreateIndex
CREATE INDEX "idx_compra_estado_pago" ON "compra"("estado_pago");

-- CreateIndex
CREATE INDEX "idx_compra_fecha" ON "compra"("fecha_compra" DESC);

-- CreateIndex
CREATE INDEX "idx_compra_proveedor" ON "compra"("id_proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "uq_compra_comprobante" ON "compra"("tipo_comprobante", "numero_comprobante");

-- CreateIndex
CREATE UNIQUE INDEX "uq_compra_proveedor_ref" ON "compra"("id_compra", "id_proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_venta_numero_comprobante_key" ON "comprobante_venta"("numero_comprobante");

-- CreateIndex
CREATE INDEX "idx_comprobante_fecha" ON "comprobante_venta"("fecha_emision" DESC);

-- CreateIndex
CREATE INDEX "idx_comprobante_pedido" ON "comprobante_venta"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_comprobante_proforma" ON "comprobante_venta"("id_proforma");

-- CreateIndex
CREATE INDEX "idx_costeo_fecha" ON "costeo"("fecha_costeo" DESC);

-- CreateIndex
CREATE INDEX "idx_costeo_orden" ON "costeo"("id_orden_trabajo");

-- CreateIndex
CREATE INDEX "idx_costeo_pedido" ON "costeo"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_costo_indirecto_costeo" ON "costo_indirecto"("id_costeo");

-- CreateIndex
CREATE INDEX "idx_costo_indirecto_periodo" ON "costo_indirecto"("periodo");

-- CreateIndex
CREATE INDEX "idx_dashboard_categoria" ON "dashboard_indicador"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dashboard_indicador" ON "dashboard_indicador"("nombre_indicador", "categoria");

-- CreateIndex
CREATE INDEX "idx_detalle_compra_compra" ON "detalle_compra"("id_compra");

-- CreateIndex
CREATE INDEX "idx_detalle_compra_material" ON "detalle_compra"("id_material");

-- CreateIndex
CREATE INDEX "idx_detalle_pedido_pedido" ON "detalle_pedido"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_detalle_pedido_producto" ON "detalle_pedido"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_detalle_pedido_producto" ON "detalle_pedido"("id_pedido", "id_producto");

-- CreateIndex
CREATE INDEX "idx_detalle_receta_material" ON "detalle_receta"("id_material");

-- CreateIndex
CREATE INDEX "idx_detalle_receta_version" ON "detalle_receta"("id_version_receta");

-- CreateIndex
CREATE UNIQUE INDEX "uq_detalle_receta_material" ON "detalle_receta"("id_version_receta", "id_material");

-- CreateIndex
CREATE INDEX "idx_det_repuesto_reparacion" ON "detalle_repuesto_reparacion"("id_reparacion");

-- CreateIndex
CREATE INDEX "idx_det_repuesto_repuesto" ON "detalle_repuesto_reparacion"("id_repuesto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_det_repuesto_reparacion" ON "detalle_repuesto_reparacion"("id_reparacion", "id_repuesto");

-- CreateIndex
CREATE INDEX "idx_etapa_ruta" ON "etapa_ruta"("id_ruta");

-- CreateIndex
CREATE INDEX "idx_etapa_ruta_orden" ON "etapa_ruta"("id_ruta", "orden_secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "uq_etapa_ruta_nombre" ON "etapa_ruta"("id_ruta", "nombre_etapa");

-- CreateIndex
CREATE UNIQUE INDEX "uq_etapa_ruta_orden" ON "etapa_ruta"("id_ruta", "orden_secuencia");

-- CreateIndex
CREATE INDEX "idx_etapa_ruta_maquina_etapa" ON "etapa_ruta_maquina"("id_etapa_ruta");

-- CreateIndex
CREATE INDEX "idx_etapa_ruta_maquina_maquina" ON "etapa_ruta_maquina"("id_maquina");

-- CreateIndex
CREATE UNIQUE INDEX "uq_etapa_ruta_maquina" ON "etapa_ruta_maquina"("id_etapa_ruta", "id_maquina");

-- CreateIndex
CREATE INDEX "idx_exportacion_fecha" ON "exportacion_datos"("fecha_exportacion" DESC);

-- CreateIndex
CREATE INDEX "idx_exportacion_modulo" ON "exportacion_datos"("modulo_origen");

-- CreateIndex
CREATE INDEX "idx_exportacion_usuario" ON "exportacion_datos"("id_usuario");

-- CreateIndex
CREATE INDEX "idx_falla_estado" ON "falla_maquina"("estado_atencion");

-- CreateIndex
CREATE INDEX "idx_falla_fecha" ON "falla_maquina"("fecha_falla" DESC);

-- CreateIndex
CREATE INDEX "idx_falla_maquina" ON "falla_maquina"("id_maquina");

-- CreateIndex
CREATE UNIQUE INDEX "herramienta_epp_codigo_interno_key" ON "herramienta_epp"("codigo_interno");

-- CreateIndex
CREATE INDEX "idx_herramienta_estado" ON "herramienta_epp"("estado");

-- CreateIndex
CREATE INDEX "idx_herramienta_tipo" ON "herramienta_epp"("tipo");

-- CreateIndex
CREATE INDEX "idx_hist_pago_fecha" ON "historial_pago_operario"("fecha_pago" DESC);

-- CreateIndex
CREATE INDEX "idx_hist_pago_operario" ON "historial_pago_operario"("id_operario");

-- CreateIndex
CREATE INDEX "idx_hist_precio_fecha" ON "historial_precio_proveedor"("fecha_registro" DESC);

-- CreateIndex
CREATE INDEX "idx_hist_precio_material" ON "historial_precio_proveedor"("id_material");

-- CreateIndex
CREATE INDEX "idx_hist_precio_proveedor" ON "historial_precio_proveedor"("id_proveedor");

-- CreateIndex
CREATE INDEX "idx_mantenimiento_estado" ON "mantenimiento_preventivo"("estado");

-- CreateIndex
CREATE INDEX "idx_mantenimiento_fecha" ON "mantenimiento_preventivo"("fecha_programada" DESC);

-- CreateIndex
CREATE INDEX "idx_mantenimiento_maquina" ON "mantenimiento_preventivo"("id_maquina");

-- CreateIndex
CREATE UNIQUE INDEX "maquina_codigo_interno_key" ON "maquina"("codigo_interno");

-- CreateIndex
CREATE INDEX "idx_maquina_estado" ON "maquina"("estado");

-- CreateIndex
CREATE INDEX "idx_margen_costeo" ON "margen_ganancia"("id_costeo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_material_nombre" ON "material"("nombre_material");

-- CreateIndex
CREATE INDEX "idx_material_categoria" ON "material"("categoria");

-- CreateIndex
CREATE INDEX "idx_material_estado" ON "material"("estado");

-- CreateIndex
CREATE INDEX "idx_material_stock" ON "material"("stock_actual", "stock_minimo");

-- CreateIndex
CREATE INDEX "idx_mov_caja_caja" ON "movimiento_caja"("id_caja_chica");

-- CreateIndex
CREATE INDEX "idx_mov_caja_categoria" ON "movimiento_caja"("id_categoria_gasto");

-- CreateIndex
CREATE INDEX "idx_mov_caja_fecha" ON "movimiento_caja"("fecha_movimiento" DESC);

-- CreateIndex
CREATE INDEX "idx_mov_caja_tipo" ON "movimiento_caja"("tipo_movimiento");

-- CreateIndex
CREATE INDEX "idx_mov_caja_usuario" ON "movimiento_caja"("id_usuario_registro");

-- CreateIndex
CREATE INDEX "idx_mov_inv_compra" ON "movimiento_inventario"("id_compra");

-- CreateIndex
CREATE INDEX "idx_mov_inv_fecha" ON "movimiento_inventario"("fecha_movimiento" DESC);

-- CreateIndex
CREATE INDEX "idx_mov_inv_material" ON "movimiento_inventario"("id_material");

-- CreateIndex
CREATE INDEX "idx_mov_inv_orden" ON "movimiento_inventario"("id_orden_trabajo");

-- CreateIndex
CREATE INDEX "idx_mov_inv_tipo" ON "movimiento_inventario"("tipo_movimiento");

-- CreateIndex
CREATE INDEX "idx_operario_estado" ON "operario"("estado");

-- CreateIndex
CREATE INDEX "idx_operario_modalidad" ON "operario"("modalidad_pago");

-- CreateIndex
CREATE INDEX "idx_orden_campania" ON "orden_trabajo"("id_campania");

-- CreateIndex
CREATE INDEX "idx_orden_cliente" ON "orden_trabajo"("id_cliente");

-- CreateIndex
CREATE INDEX "idx_orden_detalle_pedido" ON "orden_trabajo"("id_detalle_pedido");

-- CreateIndex
CREATE INDEX "idx_orden_estado" ON "orden_trabajo"("estado");

-- CreateIndex
CREATE INDEX "idx_orden_fechas" ON "orden_trabajo"("fecha_inicio", "fecha_entrega_estimada");

-- CreateIndex
CREATE INDEX "idx_orden_prioridad" ON "orden_trabajo"("prioridad");

-- CreateIndex
CREATE INDEX "idx_orden_producto" ON "orden_trabajo"("id_producto");

-- CreateIndex
CREATE INDEX "idx_orden_ruta" ON "orden_trabajo"("id_ruta");

-- CreateIndex
CREATE INDEX "idx_orden_version_receta" ON "orden_trabajo"("id_version_receta");

-- CreateIndex
CREATE INDEX "idx_pago_cliente_fecha" ON "pago_cliente"("fecha_pago" DESC);

-- CreateIndex
CREATE INDEX "idx_pago_cliente_pedido" ON "pago_cliente"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_pago_cliente_proforma" ON "pago_cliente"("id_proforma");

-- CreateIndex
CREATE INDEX "idx_pago_proveedor_compra" ON "pago_proveedor"("id_compra");

-- CreateIndex
CREATE INDEX "idx_pago_proveedor_fecha" ON "pago_proveedor"("fecha_pago" DESC);

-- CreateIndex
CREATE INDEX "idx_pago_proveedor_proveedor" ON "pago_proveedor"("id_proveedor");

-- CreateIndex
CREATE INDEX "idx_pedido_cliente" ON "pedido"("id_cliente");

-- CreateIndex
CREATE INDEX "idx_pedido_estado" ON "pedido"("estado");

-- CreateIndex
CREATE INDEX "idx_pedido_fecha" ON "pedido"("fecha_pedido" DESC);

-- CreateIndex
CREATE INDEX "idx_pedido_usuario" ON "pedido"("id_usuario_registro");

-- CreateIndex
CREATE INDEX "idx_planilla_estado" ON "planilla_pago"("estado_pago");

-- CreateIndex
CREATE INDEX "idx_planilla_operario" ON "planilla_pago"("id_operario");

-- CreateIndex
CREATE UNIQUE INDEX "uq_planilla_operario_periodo" ON "planilla_pago"("id_operario", "periodo_inicio", "periodo_fin");

-- CreateIndex
CREATE UNIQUE INDEX "uq_planilla_operario_ref" ON "planilla_pago"("id_planilla", "id_operario");

-- CreateIndex
CREATE UNIQUE INDEX "uq_producto_nombre" ON "producto"("nombre_producto");

-- CreateIndex
CREATE INDEX "idx_producto_categoria" ON "producto"("categoria");

-- CreateIndex
CREATE INDEX "idx_producto_estado" ON "producto"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "proforma_numero_proforma_key" ON "proforma"("numero_proforma");

-- CreateIndex
CREATE INDEX "idx_proforma_estado" ON "proforma"("estado");

-- CreateIndex
CREATE INDEX "idx_proforma_fecha" ON "proforma"("fecha_emision" DESC);

-- CreateIndex
CREATE INDEX "idx_proforma_pedido" ON "proforma"("id_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "uq_proforma_pedido_ref" ON "proforma"("id_proforma", "id_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_numero_documento_key" ON "proveedor"("numero_documento");

-- CreateIndex
CREATE INDEX "idx_proveedor_estado" ON "proveedor"("estado");

-- CreateIndex
CREATE INDEX "idx_proveedor_razon_social" ON "proveedor"("razon_social");

-- CreateIndex
CREATE INDEX "idx_proveedor_tipo" ON "proveedor"("tipo_proveedor");

-- CreateIndex
CREATE INDEX "idx_proveedor_material_material" ON "proveedor_material"("id_material");

-- CreateIndex
CREATE INDEX "idx_proveedor_material_proveedor" ON "proveedor_material"("id_proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "uq_proveedor_material" ON "proveedor_material"("id_proveedor", "id_material");

-- CreateIndex
CREATE INDEX "idx_reasignacion_avance" ON "reasignacion_tarea"("id_avance");

-- CreateIndex
CREATE INDEX "idx_reasignacion_operario_nuevo" ON "reasignacion_tarea"("id_operario_nuevo");

-- CreateIndex
CREATE INDEX "idx_receta_estado" ON "receta_tecnica"("estado");

-- CreateIndex
CREATE INDEX "idx_receta_producto" ON "receta_tecnica"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_receta_producto_nombre" ON "receta_tecnica"("id_producto", "nombre_receta");

-- CreateIndex
CREATE INDEX "idx_rentabilidad_costeo" ON "rentabilidad"("id_costeo");

-- CreateIndex
CREATE INDEX "idx_rentabilidad_fecha" ON "rentabilidad"("fecha_calculo" DESC);

-- CreateIndex
CREATE INDEX "idx_rentabilidad_pedido" ON "rentabilidad"("id_pedido");

-- CreateIndex
CREATE INDEX "idx_reparacion_falla" ON "reparacion"("id_falla");

-- CreateIndex
CREATE INDEX "idx_reparacion_fecha" ON "reparacion"("fecha_reparacion" DESC);

-- CreateIndex
CREATE INDEX "idx_reporte_fecha" ON "reporte"("fecha_generacion" DESC);

-- CreateIndex
CREATE INDEX "idx_reporte_tipo" ON "reporte"("tipo_reporte");

-- CreateIndex
CREATE INDEX "idx_reporte_usuario" ON "reporte"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "uq_repuesto_nombre" ON "repuesto"("nombre_repuesto");

-- CreateIndex
CREATE INDEX "idx_repuesto_proveedor" ON "repuesto"("id_proveedor");

-- CreateIndex
CREATE INDEX "idx_retazo_estado" ON "retazo_reutilizable"("estado");

-- CreateIndex
CREATE INDEX "idx_retazo_material" ON "retazo_reutilizable"("id_material");

-- CreateIndex
CREATE INDEX "idx_retazo_orden" ON "retazo_reutilizable"("id_orden_trabajo");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_rol_key" ON "rol"("nombre_rol");

-- CreateIndex
CREATE INDEX "idx_ruta_producto" ON "ruta_fabricacion"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ruta_producto_nombre" ON "ruta_fabricacion"("id_producto", "nombre_ruta");

-- CreateIndex
CREATE INDEX "idx_tarea_fecha" ON "tarea_operario"("fecha_tarea" DESC);

-- CreateIndex
CREATE INDEX "idx_tarea_operario" ON "tarea_operario"("id_operario");

-- CreateIndex
CREATE INDEX "idx_tarea_orden" ON "tarea_operario"("id_orden_trabajo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_usuario_key" ON "usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "idx_usuario_estado" ON "usuario"("estado");

-- CreateIndex
CREATE INDEX "idx_usuario_id_rol" ON "usuario"("id_rol");

-- CreateIndex
CREATE INDEX "idx_venta_chatarra_fecha" ON "venta_chatarra"("fecha_venta" DESC);

-- CreateIndex
CREATE INDEX "idx_venta_chatarra_mov_caja" ON "venta_chatarra"("id_movimiento_caja");

-- CreateIndex
CREATE UNIQUE INDEX "uq_version_receta_vigente" ON "version_receta"("id_receta") WHERE ((estado)::text = 'vigente'::text);

-- CreateIndex
CREATE INDEX "idx_version_receta_estado" ON "version_receta"("estado");

-- CreateIndex
CREATE INDEX "idx_version_receta_id_receta" ON "version_receta"("id_receta");

-- CreateIndex
CREATE UNIQUE INDEX "uq_version_receta_numero" ON "version_receta"("id_receta", "numero_version");

-- AddForeignKey
ALTER TABLE "alerta_stock" ADD CONSTRAINT "fk_alerta_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_stock" ADD CONSTRAINT "fk_alerta_usuario_atencion" FOREIGN KEY ("id_usuario_atencion") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_herramienta_epp" ADD CONSTRAINT "fk_asignacion_herramienta" FOREIGN KEY ("id_herramienta_epp") REFERENCES "herramienta_epp"("id_herramienta_epp") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_herramienta_epp" ADD CONSTRAINT "fk_asignacion_operario" FOREIGN KEY ("id_operario") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_herramienta_epp" ADD CONSTRAINT "fk_asignacion_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "fk_asistencia_operario" FOREIGN KEY ("id_operario") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencia" ADD CONSTRAINT "fk_asistencia_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_orden" ADD CONSTRAINT "fk_avance_etapa" FOREIGN KEY ("id_etapa_ruta") REFERENCES "etapa_ruta"("id_etapa_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_orden" ADD CONSTRAINT "fk_avance_operario" FOREIGN KEY ("id_operario") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_orden" ADD CONSTRAINT "fk_avance_orden" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden_trabajo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avance_orden" ADD CONSTRAINT "fk_avance_usuario_actualiza" FOREIGN KEY ("id_usuario_actualiza") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_operacion" ADD CONSTRAINT "fk_bitacora_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campania_detalle" ADD CONSTRAINT "fk_campania_detalle_campania" FOREIGN KEY ("id_campania") REFERENCES "campania_produccion"("id_campania") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campania_detalle" ADD CONSTRAINT "fk_campania_detalle_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campania_produccion" ADD CONSTRAINT "fk_campania_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatarra" ADD CONSTRAINT "fk_chatarra_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "fk_compra_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "fk_compra_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_venta" ADD CONSTRAINT "fk_comprobante_pedido" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_venta" ADD CONSTRAINT "fk_comprobante_proforma_pedido" FOREIGN KEY ("id_proforma", "id_pedido") REFERENCES "proforma"("id_proforma", "id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costeo" ADD CONSTRAINT "fk_costeo_orden" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden_trabajo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costeo" ADD CONSTRAINT "fk_costeo_pedido" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costeo" ADD CONSTRAINT "fk_costeo_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costo_indirecto" ADD CONSTRAINT "fk_costo_indirecto_costeo" FOREIGN KEY ("id_costeo") REFERENCES "costeo"("id_costeo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_compra" ADD CONSTRAINT "fk_detalle_compra_compra" FOREIGN KEY ("id_compra") REFERENCES "compra"("id_compra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_compra" ADD CONSTRAINT "fk_detalle_compra_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedido" ADD CONSTRAINT "fk_detalle_pedido_pedido" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedido" ADD CONSTRAINT "fk_detalle_pedido_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_receta" ADD CONSTRAINT "fk_detalle_receta_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_receta" ADD CONSTRAINT "fk_detalle_receta_version" FOREIGN KEY ("id_version_receta") REFERENCES "version_receta"("id_version_receta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_repuesto_reparacion" ADD CONSTRAINT "fk_det_repuesto_reparacion" FOREIGN KEY ("id_reparacion") REFERENCES "reparacion"("id_reparacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_repuesto_reparacion" ADD CONSTRAINT "fk_det_repuesto_repuesto" FOREIGN KEY ("id_repuesto") REFERENCES "repuesto"("id_repuesto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_ruta" ADD CONSTRAINT "fk_etapa_ruta" FOREIGN KEY ("id_ruta") REFERENCES "ruta_fabricacion"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_ruta_maquina" ADD CONSTRAINT "fk_etapa_ruta_maquina_etapa" FOREIGN KEY ("id_etapa_ruta") REFERENCES "etapa_ruta"("id_etapa_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_ruta_maquina" ADD CONSTRAINT "fk_etapa_ruta_maquina_maquina" FOREIGN KEY ("id_maquina") REFERENCES "maquina"("id_maquina") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exportacion_datos" ADD CONSTRAINT "fk_exportacion_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "falla_maquina" ADD CONSTRAINT "fk_falla_maquina" FOREIGN KEY ("id_maquina") REFERENCES "maquina"("id_maquina") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "falla_maquina" ADD CONSTRAINT "fk_falla_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_pago_operario" ADD CONSTRAINT "fk_hist_pago_planilla_operario" FOREIGN KEY ("id_planilla", "id_operario") REFERENCES "planilla_pago"("id_planilla", "id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_pago_operario" ADD CONSTRAINT "fk_hist_pago_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precio_proveedor" ADD CONSTRAINT "fk_hist_precio_compra_proveedor" FOREIGN KEY ("id_compra", "id_proveedor") REFERENCES "compra"("id_compra", "id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precio_proveedor" ADD CONSTRAINT "fk_hist_precio_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precio_proveedor" ADD CONSTRAINT "fk_hist_precio_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_preventivo" ADD CONSTRAINT "fk_mantenimiento_maquina" FOREIGN KEY ("id_maquina") REFERENCES "maquina"("id_maquina") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenimiento_preventivo" ADD CONSTRAINT "fk_mantenimiento_usuario" FOREIGN KEY ("id_usuario_programa") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "margen_ganancia" ADD CONSTRAINT "fk_margen_costeo" FOREIGN KEY ("id_costeo") REFERENCES "costeo"("id_costeo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "margen_ganancia" ADD CONSTRAINT "fk_margen_usuario" FOREIGN KEY ("id_usuario_aplica") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "fk_mov_caja_caja" FOREIGN KEY ("id_caja_chica") REFERENCES "caja_chica"("id_caja_chica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "fk_mov_caja_categoria" FOREIGN KEY ("id_categoria_gasto") REFERENCES "categoria_gasto"("id_categoria_gasto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "fk_mov_caja_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_mov_inv_compra" FOREIGN KEY ("id_compra") REFERENCES "compra"("id_compra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_mov_inv_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_mov_inv_orden" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden_trabajo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_mov_inv_usuario" FOREIGN KEY ("id_usuario_responsable") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_campania" FOREIGN KEY ("id_campania") REFERENCES "campania_produccion"("id_campania") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_detalle_pedido" FOREIGN KEY ("id_detalle_pedido") REFERENCES "detalle_pedido"("id_detalle_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_ruta" FOREIGN KEY ("id_ruta") REFERENCES "ruta_fabricacion"("id_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_usuario_registro" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_version_receta" FOREIGN KEY ("id_version_receta") REFERENCES "version_receta"("id_version_receta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cliente" ADD CONSTRAINT "fk_pago_cliente_proforma_pedido" FOREIGN KEY ("id_proforma", "id_pedido") REFERENCES "proforma"("id_proforma", "id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cliente" ADD CONSTRAINT "fk_pago_cliente_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "fk_pago_proveedor_compra_proveedor" FOREIGN KEY ("id_compra", "id_proveedor") REFERENCES "compra"("id_compra", "id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_proveedor" ADD CONSTRAINT "fk_pago_proveedor_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "fk_pedido_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "fk_pedido_usuario_registro" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planilla_pago" ADD CONSTRAINT "fk_planilla_operario" FOREIGN KEY ("id_operario") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planilla_pago" ADD CONSTRAINT "fk_planilla_usuario" FOREIGN KEY ("id_usuario_genera") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma" ADD CONSTRAINT "fk_proforma_pedido" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_material" ADD CONSTRAINT "fk_proveedor_material_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_material" ADD CONSTRAINT "fk_proveedor_material_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignacion_tarea" ADD CONSTRAINT "fk_reasignacion_avance" FOREIGN KEY ("id_avance") REFERENCES "avance_orden"("id_avance") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignacion_tarea" ADD CONSTRAINT "fk_reasignacion_operario_anterior" FOREIGN KEY ("id_operario_anterior") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignacion_tarea" ADD CONSTRAINT "fk_reasignacion_operario_nuevo" FOREIGN KEY ("id_operario_nuevo") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignacion_tarea" ADD CONSTRAINT "fk_reasignacion_usuario" FOREIGN KEY ("id_usuario_responsable") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_tecnica" ADD CONSTRAINT "fk_receta_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_tecnica" ADD CONSTRAINT "fk_receta_usuario_creacion" FOREIGN KEY ("id_usuario_creacion") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentabilidad" ADD CONSTRAINT "fk_rentabilidad_costeo" FOREIGN KEY ("id_costeo") REFERENCES "costeo"("id_costeo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentabilidad" ADD CONSTRAINT "fk_rentabilidad_pedido" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reparacion" ADD CONSTRAINT "fk_reparacion_falla" FOREIGN KEY ("id_falla") REFERENCES "falla_maquina"("id_falla") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "fk_reporte_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repuesto" ADD CONSTRAINT "fk_repuesto_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retazo_reutilizable" ADD CONSTRAINT "fk_retazo_material" FOREIGN KEY ("id_material") REFERENCES "material"("id_material") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retazo_reutilizable" ADD CONSTRAINT "fk_retazo_orden" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden_trabajo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retazo_reutilizable" ADD CONSTRAINT "fk_retazo_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_fabricacion" ADD CONSTRAINT "fk_ruta_producto" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_operario" ADD CONSTRAINT "fk_tarea_etapa" FOREIGN KEY ("id_etapa_ruta") REFERENCES "etapa_ruta"("id_etapa_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_operario" ADD CONSTRAINT "fk_tarea_operario" FOREIGN KEY ("id_operario") REFERENCES "operario"("id_operario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_operario" ADD CONSTRAINT "fk_tarea_orden" FOREIGN KEY ("id_orden_trabajo") REFERENCES "orden_trabajo"("id_orden_trabajo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_operario" ADD CONSTRAINT "fk_tarea_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_rol" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_chatarra" ADD CONSTRAINT "fk_venta_chatarra_chatarra" FOREIGN KEY ("id_chatarra") REFERENCES "chatarra"("id_chatarra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_chatarra" ADD CONSTRAINT "fk_venta_chatarra_mov_caja" FOREIGN KEY ("id_movimiento_caja") REFERENCES "movimiento_caja"("id_movimiento_caja") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_chatarra" ADD CONSTRAINT "fk_venta_chatarra_usuario" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_receta" ADD CONSTRAINT "fk_version_receta" FOREIGN KEY ("id_receta") REFERENCES "receta_tecnica"("id_receta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_receta" ADD CONSTRAINT "fk_version_usuario_aprueba" FOREIGN KEY ("id_usuario_aprueba") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

