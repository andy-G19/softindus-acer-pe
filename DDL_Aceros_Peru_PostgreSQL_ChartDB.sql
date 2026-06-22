
-- =============================================================
-- Base de Datos General - Taller Metalurgico Industrias Aceros Peru
-- PostgreSQL / ChartDB
-- Version: 1.0
-- Criterios aplicados:
--   - Esquema propio: aceros
--   - Identificadores PK/FK CHAR(11), formato recomendado: AAA00000000
--   - Fechas DATETIME convertidas a TIMESTAMPTZ
--   - Tablas primero, luego FKs, indices y comentarios
--   - Integridad referencial con ON UPDATE CASCADE y ON DELETE RESTRICT
-- =============================================================

CREATE SCHEMA IF NOT EXISTS aceros;
SET search_path TO aceros, public;

-- =============================================================
-- 1. CREATE TABLES
-- =============================================================

-- -------------------------------------------------------------
-- Modulo 0: Seguridad, usuarios y trazabilidad transversal
-- -------------------------------------------------------------

CREATE TABLE rol (
    id_rol CHAR(11) PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_rol_id_formato CHECK (id_rol ~ '^[A-Z]{3}[0-9]{8}$')
);

CREATE TABLE usuario (
    id_usuario CHAR(11) PRIMARY KEY,
    id_rol CHAR(11) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    correo VARCHAR(100) UNIQUE,
    clave_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_acceso TIMESTAMPTZ,
    CONSTRAINT chk_usuario_id_formato CHECK (id_usuario ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_usuario_estado CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
    CONSTRAINT chk_usuario_correo_formato CHECK (correo IS NULL OR correo ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE TABLE bitacora_operacion (
    id_bitacora CHAR(11) PRIMARY KEY,
    id_usuario CHAR(11) NOT NULL,
    entidad_afectada VARCHAR(80) NOT NULL,
    id_registro_afectado CHAR(11),
    accion VARCHAR(30) NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
    detalle TEXT,
    ip_origen VARCHAR(45),
    CONSTRAINT chk_bitacora_id_formato CHECK (id_bitacora ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_bitacora_accion CHECK (accion IN ('crear', 'actualizar', 'anular', 'eliminar_logico', 'consultar', 'login', 'logout'))
);

-- -------------------------------------------------------------
-- Modulo 2 base: Recetas tecnicas y lista de materiales
-- Se crean antes de produccion porque produccion depende de producto/material.
-- -------------------------------------------------------------

CREATE TABLE producto (
    id_producto CHAR(11) PRIMARY KEY,
    nombre_producto VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    descripcion TEXT,
    unidad_medida VARCHAR(20) NOT NULL,
    precio_referencial NUMERIC(12,2),
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_producto_id_formato CHECK (id_producto ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT uq_producto_nombre UNIQUE (nombre_producto),
    CONSTRAINT chk_producto_precio CHECK (precio_referencial IS NULL OR precio_referencial >= 0)
);

CREATE TABLE material (
    id_material CHAR(11) PRIMARY KEY,
    nombre_material VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    stock_actual NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock_reservado NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
    costo_unitario_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_material_id_formato CHECK (id_material ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT uq_material_nombre UNIQUE (nombre_material),
    CONSTRAINT chk_material_categoria CHECK (categoria IN ('materia_prima', 'consumible', 'repuesto', 'herramienta', 'otro')),
    CONSTRAINT chk_material_stock_actual CHECK (stock_actual >= 0),
    CONSTRAINT chk_material_stock_reservado CHECK (stock_reservado >= 0),
    CONSTRAINT chk_material_stock_minimo CHECK (stock_minimo >= 0),
    CONSTRAINT chk_material_costo CHECK (costo_unitario_actual >= 0),
    CONSTRAINT chk_material_stock_disponible CHECK (stock_actual >= stock_reservado)
);

CREATE TABLE receta_tecnica (
    id_receta CHAR(11) PRIMARY KEY,
    id_producto CHAR(11) NOT NULL,
    nombre_receta VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
    id_usuario_creacion CHAR(11) NOT NULL,
    CONSTRAINT chk_receta_id_formato CHECK (id_receta ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_receta_estado CHECK (estado IN ('activa', 'inactiva', 'reemplazada')),
    CONSTRAINT uq_receta_producto_nombre UNIQUE (id_producto, nombre_receta)
);

CREATE TABLE version_receta (
    id_version_receta CHAR(11) PRIMARY KEY,
    id_receta CHAR(11) NOT NULL,
    numero_version VARCHAR(20) NOT NULL,
    fecha_version DATE NOT NULL DEFAULT CURRENT_DATE,
    motivo_cambio TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
    id_usuario_aprueba CHAR(11),
    CONSTRAINT chk_version_receta_id_formato CHECK (id_version_receta ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_version_receta_estado CHECK (estado IN ('vigente', 'historica', 'anulada')),
    CONSTRAINT uq_version_receta_numero UNIQUE (id_receta, numero_version)
);

CREATE TABLE detalle_receta (
    id_detalle_receta CHAR(11) PRIMARY KEY,
    id_version_receta CHAR(11) NOT NULL,
    id_material CHAR(11) NOT NULL,
    cantidad_requerida NUMERIC(10,2) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    tipo_consumo VARCHAR(30) NOT NULL,
    merma_estimada_porcentaje NUMERIC(5,2),
    observaciones TEXT,
    CONSTRAINT chk_detalle_receta_id_formato CHECK (id_detalle_receta ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_detalle_receta_cantidad CHECK (cantidad_requerida > 0),
    CONSTRAINT chk_detalle_receta_tipo_consumo CHECK (tipo_consumo IN ('materia_prima', 'consumible', 'auxiliar')),
    CONSTRAINT chk_detalle_receta_merma CHECK (merma_estimada_porcentaje IS NULL OR merma_estimada_porcentaje BETWEEN 0 AND 100),
    CONSTRAINT uq_detalle_receta_material UNIQUE (id_version_receta, id_material)
);

-- -------------------------------------------------------------
-- Modulo 6 base: Comercial, clientes, pedidos y proformas
-- Cliente y pedido se crean antes de produccion por dependencias.
-- -------------------------------------------------------------

CREATE TABLE cliente (
    id_cliente CHAR(11) PRIMARY KEY,
    tipo_cliente VARCHAR(50) NOT NULL,
    nombre_razon_social VARCHAR(150) NOT NULL,
    tipo_documento VARCHAR(20),
    numero_documento VARCHAR(20) UNIQUE,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion VARCHAR(150),
    lugar_origen VARCHAR(100),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones TEXT,
    CONSTRAINT chk_cliente_id_formato CHECK (id_cliente ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_cliente_tipo CHECK (tipo_cliente IN ('ferreteria', 'distribuidora', 'constructora', 'cliente_final', 'otro')),
    CONSTRAINT chk_cliente_tipo_documento CHECK (tipo_documento IS NULL OR tipo_documento IN ('dni', 'ruc', 'otro')),
    CONSTRAINT chk_cliente_correo_formato CHECK (correo IS NULL OR correo ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE TABLE pedido (
    id_pedido CHAR(11) PRIMARY KEY,
    id_cliente CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega_estimada DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'registrado',
    monto_estimado NUMERIC(12,2),
    observaciones TEXT,
    CONSTRAINT chk_pedido_id_formato CHECK (id_pedido ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_pedido_estado CHECK (estado IN ('registrado', 'aprobado', 'en_produccion', 'entregado', 'cancelado')),
    CONSTRAINT chk_pedido_monto CHECK (monto_estimado IS NULL OR monto_estimado >= 0),
    CONSTRAINT chk_pedido_fechas CHECK (fecha_entrega_estimada IS NULL OR fecha_entrega_estimada >= fecha_pedido)
);

CREATE TABLE detalle_pedido (
    id_detalle_pedido CHAR(11) PRIMARY KEY,
    id_pedido CHAR(11) NOT NULL,
    id_producto CHAR(11) NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_detalle_pedido_id_formato CHECK (id_detalle_pedido ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_detalle_pedido_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_detalle_pedido_precio CHECK (precio_unitario >= 0),
    CONSTRAINT chk_detalle_pedido_subtotal CHECK (subtotal >= 0),
    CONSTRAINT uq_detalle_pedido_producto UNIQUE (id_pedido, id_producto)
);

CREATE TABLE proforma (
    id_proforma CHAR(11) PRIMARY KEY,
    id_pedido CHAR(11) NOT NULL,
    numero_proforma VARCHAR(30) NOT NULL UNIQUE,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_total NUMERIC(12,2) NOT NULL,
    adelanto_inicial NUMERIC(12,2),
    saldo NUMERIC(12,2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'vigente',
    validez_dias INTEGER,
    observaciones TEXT,
    CONSTRAINT chk_proforma_id_formato CHECK (id_proforma ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_proforma_monto_total CHECK (monto_total >= 0),
    CONSTRAINT chk_proforma_adelanto CHECK (adelanto_inicial IS NULL OR adelanto_inicial >= 0),
    CONSTRAINT chk_proforma_saldo CHECK (saldo >= 0),
    CONSTRAINT chk_proforma_estado CHECK (estado IN ('vigente', 'aceptada', 'anulada', 'pagada')),
    CONSTRAINT chk_proforma_validez CHECK (validez_dias IS NULL OR validez_dias > 0),
    CONSTRAINT uq_proforma_pedido_ref UNIQUE (id_proforma, id_pedido)
);

CREATE TABLE pago_cliente (
    id_pago_cliente CHAR(11) PRIMARY KEY,
    id_proforma CHAR(11) NOT NULL,
    id_pedido CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_pagado NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL,
    tipo_pago VARCHAR(30) NOT NULL,
    saldo_actual NUMERIC(12,2) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_pago_cliente_id_formato CHECK (id_pago_cliente ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_pago_cliente_monto CHECK (monto_pagado > 0),
    CONSTRAINT chk_pago_cliente_saldo CHECK (saldo_actual >= 0),
    CONSTRAINT chk_pago_cliente_metodo CHECK (metodo_pago IN ('efectivo', 'transferencia', 'yape', 'plin', 'otro')),
    CONSTRAINT chk_pago_cliente_tipo CHECK (tipo_pago IN ('adelanto', 'amortizacion', 'cancelacion'))
);

CREATE TABLE comprobante_venta (
    id_comprobante CHAR(11) PRIMARY KEY,
    id_pedido CHAR(11) NOT NULL,
    id_proforma CHAR(11),
    tipo_comprobante VARCHAR(30) NOT NULL,
    numero_comprobante VARCHAR(30) NOT NULL UNIQUE,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_total NUMERIC(12,2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'emitido',
    observaciones TEXT,
    CONSTRAINT chk_comprobante_id_formato CHECK (id_comprobante ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_comprobante_tipo CHECK (tipo_comprobante IN ('boleta', 'factura', 'recibo', 'otro')),
    CONSTRAINT chk_comprobante_monto CHECK (monto_total >= 0),
    CONSTRAINT chk_comprobante_estado CHECK (estado IN ('emitido', 'anulado', 'reemplazado'))
);

-- -------------------------------------------------------------
-- Modulo 1: Produccion y ordenes de trabajo
-- -------------------------------------------------------------

CREATE TABLE campania_produccion (
    id_campania CHAR(11) PRIMARY KEY,
    nombre_campania VARCHAR(100) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    objetivo_general TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'planificada',
    id_usuario_registro CHAR(11) NOT NULL,
    CONSTRAINT chk_campania_id_formato CHECK (id_campania ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_campania_estado CHECK (estado IN ('planificada', 'activa', 'finalizada', 'anulada')),
    CONSTRAINT chk_campania_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE ruta_fabricacion (
    id_ruta CHAR(11) PRIMARY KEY,
    id_producto CHAR(11) NOT NULL,
    nombre_ruta VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_ruta_id_formato CHECK (id_ruta ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT uq_ruta_producto_nombre UNIQUE (id_producto, nombre_ruta)
);

CREATE TABLE etapa_ruta (
    id_etapa_ruta CHAR(11) PRIMARY KEY,
    id_ruta CHAR(11) NOT NULL,
    nombre_etapa VARCHAR(100) NOT NULL,
    orden_secuencia INTEGER NOT NULL,
    descripcion TEXT,
    tiempo_estimado_horas NUMERIC(10,2),
    requiere_maquina BOOLEAN NOT NULL DEFAULT FALSE,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_etapa_ruta_id_formato CHECK (id_etapa_ruta ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_etapa_ruta_orden CHECK (orden_secuencia > 0),
    CONSTRAINT chk_etapa_ruta_tiempo CHECK (tiempo_estimado_horas IS NULL OR tiempo_estimado_horas >= 0),
    CONSTRAINT uq_etapa_ruta_orden UNIQUE (id_ruta, orden_secuencia),
    CONSTRAINT uq_etapa_ruta_nombre UNIQUE (id_ruta, nombre_etapa)
);

CREATE TABLE orden_trabajo (
    id_orden_trabajo CHAR(11) PRIMARY KEY,
    id_cliente CHAR(11),
    id_producto CHAR(11) NOT NULL,
    id_campania CHAR(11),
    id_detalle_pedido CHAR(11),
    id_ruta CHAR(11),
    id_version_receta CHAR(11),
    tipo_produccion VARCHAR(30) NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_entrega_estimada DATE,
    fecha_entrega_real DATE,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_orden_id_formato CHECK (id_orden_trabajo ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_orden_tipo_produccion CHECK (tipo_produccion IN ('pedido', 'campania', 'reposicion_stock')),
    CONSTRAINT chk_orden_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_orden_prioridad CHECK (prioridad IN ('alta', 'media', 'baja')),
    CONSTRAINT chk_orden_estado CHECK (estado IN ('pendiente', 'en_proceso', 'pausada', 'finalizada', 'anulada', 'retrasada')),
    CONSTRAINT chk_orden_fechas_estimada CHECK (fecha_entrega_estimada IS NULL OR fecha_entrega_estimada >= fecha_inicio),
    CONSTRAINT chk_orden_fechas_real CHECK (fecha_entrega_real IS NULL OR fecha_entrega_real >= fecha_inicio),
    CONSTRAINT chk_orden_tipo_relacion CHECK (
        (tipo_produccion = 'pedido' AND id_detalle_pedido IS NOT NULL)
        OR (tipo_produccion = 'campania' AND id_campania IS NOT NULL)
        OR (tipo_produccion = 'reposicion_stock')
    )
);

CREATE TABLE avance_orden (
    id_avance CHAR(11) PRIMARY KEY,
    id_orden_trabajo CHAR(11) NOT NULL,
    id_etapa_ruta CHAR(11) NOT NULL,
    id_operario CHAR(11),
    estado_etapa VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    porcentaje_avance NUMERIC(5,2) NOT NULL DEFAULT 0,
    fecha_inicio_etapa TIMESTAMPTZ,
    fecha_fin_etapa TIMESTAMPTZ,
    observaciones TEXT,
    id_usuario_actualiza CHAR(11) NOT NULL,
    CONSTRAINT chk_avance_id_formato CHECK (id_avance ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_avance_estado CHECK (estado_etapa IN ('pendiente', 'en_proceso', 'pausada', 'terminada')),
    CONSTRAINT chk_avance_porcentaje CHECK (porcentaje_avance BETWEEN 0 AND 100),
    CONSTRAINT chk_avance_fechas CHECK (fecha_fin_etapa IS NULL OR fecha_inicio_etapa IS NULL OR fecha_fin_etapa >= fecha_inicio_etapa),
    CONSTRAINT uq_avance_orden_etapa UNIQUE (id_orden_trabajo, id_etapa_ruta)
);

CREATE TABLE reasignacion_tarea (
    id_reasignacion CHAR(11) PRIMARY KEY,
    id_avance CHAR(11) NOT NULL,
    id_operario_anterior CHAR(11),
    id_operario_nuevo CHAR(11) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    fecha_reasignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_usuario_responsable CHAR(11) NOT NULL,
    CONSTRAINT chk_reasignacion_id_formato CHECK (id_reasignacion ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_reasignacion_operarios CHECK (id_operario_anterior IS NULL OR id_operario_anterior <> id_operario_nuevo)
);

CREATE TABLE campania_detalle (
    id_campania_detalle CHAR(11) PRIMARY KEY,
    id_campania CHAR(11) NOT NULL,
    id_producto CHAR(11) NOT NULL,
    cantidad_objetivo NUMERIC(10,2) NOT NULL,
    cantidad_producida NUMERIC(10,2) NOT NULL DEFAULT 0,
    observaciones TEXT,
    CONSTRAINT chk_campania_detalle_id_formato CHECK (id_campania_detalle ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_campania_detalle_objetivo CHECK (cantidad_objetivo > 0),
    CONSTRAINT chk_campania_detalle_producida CHECK (cantidad_producida >= 0),
    CONSTRAINT uq_campania_producto UNIQUE (id_campania, id_producto)
);

-- Ajuste aprobado: relacion de etapa con maquinas criticas.
CREATE TABLE etapa_ruta_maquina (
    id_etapa_ruta_maquina CHAR(11) PRIMARY KEY,
    id_etapa_ruta CHAR(11) NOT NULL,
    id_maquina CHAR(11) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_etapa_ruta_maquina_id_formato CHECK (id_etapa_ruta_maquina ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT uq_etapa_ruta_maquina UNIQUE (id_etapa_ruta, id_maquina)
);

-- -------------------------------------------------------------
-- Modulo 3: Proveedores y abastecimiento
-- -------------------------------------------------------------

CREATE TABLE proveedor (
    id_proveedor CHAR(11) PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    tipo_documento VARCHAR(20),
    numero_documento VARCHAR(20) UNIQUE,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion VARCHAR(150),
    contacto_principal VARCHAR(100),
    tipo_proveedor VARCHAR(50) NOT NULL,
    condicion_pago VARCHAR(50),
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    observaciones TEXT,
    CONSTRAINT chk_proveedor_id_formato CHECK (id_proveedor ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_proveedor_tipo_documento CHECK (tipo_documento IS NULL OR tipo_documento IN ('dni', 'ruc', 'otro')),
    CONSTRAINT chk_proveedor_tipo CHECK (tipo_proveedor IN ('materia_prima', 'consumibles', 'repuestos', 'servicios', 'otros')),
    CONSTRAINT chk_proveedor_condicion_pago CHECK (condicion_pago IS NULL OR condicion_pago IN ('contado', 'credito', 'parcial', 'otro')),
    CONSTRAINT chk_proveedor_correo_formato CHECK (correo IS NULL OR correo ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE TABLE proveedor_material (
    id_proveedor_material CHAR(11) PRIMARY KEY,
    id_proveedor CHAR(11) NOT NULL,
    id_material CHAR(11) NOT NULL,
    precio_referencial NUMERIC(12,2),
    unidad_medida VARCHAR(20) NOT NULL,
    tiempo_entrega_dias INTEGER,
    disponibilidad VARCHAR(30),
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_actualizacion TIMESTAMPTZ,
    CONSTRAINT chk_proveedor_material_id_formato CHECK (id_proveedor_material ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_proveedor_material_precio CHECK (precio_referencial IS NULL OR precio_referencial >= 0),
    CONSTRAINT chk_proveedor_material_tiempo CHECK (tiempo_entrega_dias IS NULL OR tiempo_entrega_dias >= 0),
    CONSTRAINT chk_proveedor_material_disponibilidad CHECK (disponibilidad IS NULL OR disponibilidad IN ('alta', 'media', 'baja', 'no_disponible')),
    CONSTRAINT uq_proveedor_material UNIQUE (id_proveedor, id_material)
);

CREATE TABLE compra (
    id_compra CHAR(11) PRIMARY KEY,
    id_proveedor CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_comprobante VARCHAR(30),
    numero_comprobante VARCHAR(30),
    subtotal NUMERIC(12,2) NOT NULL,
    igv NUMERIC(12,2),
    monto_total NUMERIC(12,2) NOT NULL,
    estado_pago VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    estado_compra VARCHAR(30) NOT NULL DEFAULT 'registrada',
    observaciones TEXT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_compra_id_formato CHECK (id_compra ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_compra_tipo_comprobante CHECK (tipo_comprobante IS NULL OR tipo_comprobante IN ('boleta', 'factura', 'recibo', 'otro')),
    CONSTRAINT chk_compra_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_compra_igv CHECK (igv IS NULL OR igv >= 0),
    CONSTRAINT chk_compra_total CHECK (monto_total >= 0),
    CONSTRAINT chk_compra_estado_pago CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado')),
    CONSTRAINT chk_compra_estado CHECK (estado_compra IN ('registrada', 'confirmada', 'anulada')),
    CONSTRAINT uq_compra_comprobante UNIQUE (tipo_comprobante, numero_comprobante),
    CONSTRAINT uq_compra_proveedor_ref UNIQUE (id_compra, id_proveedor)
);

CREATE TABLE detalle_compra (
    id_detalle_compra CHAR(11) PRIMARY KEY,
    id_compra CHAR(11) NOT NULL,
    id_material CHAR(11) NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    costo_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_detalle_compra_id_formato CHECK (id_detalle_compra ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_detalle_compra_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_detalle_compra_costo CHECK (costo_unitario >= 0),
    CONSTRAINT chk_detalle_compra_subtotal CHECK (subtotal >= 0)
);

CREATE TABLE pago_proveedor (
    id_pago_proveedor CHAR(11) PRIMARY KEY,
    id_compra CHAR(11) NOT NULL,
    id_proveedor CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_pagado NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL,
    saldo_pendiente NUMERIC(12,2) NOT NULL,
    estado_pago VARCHAR(30) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_pago_proveedor_id_formato CHECK (id_pago_proveedor ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_pago_proveedor_monto CHECK (monto_pagado > 0),
    CONSTRAINT chk_pago_proveedor_saldo CHECK (saldo_pendiente >= 0),
    CONSTRAINT chk_pago_proveedor_metodo CHECK (metodo_pago IN ('efectivo', 'transferencia', 'yape', 'plin', 'otro')),
    CONSTRAINT chk_pago_proveedor_estado CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado'))
);

CREATE TABLE historial_precio_proveedor (
    id_historial_precio CHAR(11) PRIMARY KEY,
    id_proveedor CHAR(11) NOT NULL,
    id_material CHAR(11) NOT NULL,
    id_compra CHAR(11),
    precio_unitario NUMERIC(12,2) NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    origen_registro VARCHAR(50) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_hist_precio_id_formato CHECK (id_historial_precio ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_hist_precio_valor CHECK (precio_unitario >= 0),
    CONSTRAINT chk_hist_precio_origen CHECK (origen_registro IN ('compra', 'cotizacion', 'actualizacion_manual'))
);

-- -------------------------------------------------------------
-- Modulo 4: Inventario y almacen
-- -------------------------------------------------------------

CREATE TABLE movimiento_inventario (
    id_movimiento CHAR(11) PRIMARY KEY,
    id_material CHAR(11) NOT NULL,
    id_orden_trabajo CHAR(11),
    id_compra CHAR(11),
    tipo_movimiento VARCHAR(30) NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    stock_anterior NUMERIC(10,2) NOT NULL,
    stock_resultante NUMERIC(10,2) NOT NULL,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo VARCHAR(255),
    id_usuario_responsable CHAR(11) NOT NULL,
    CONSTRAINT chk_mov_inv_id_formato CHECK (id_movimiento ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_mov_inv_tipo CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'reserva', 'devolucion', 'prestamo', 'compra_urgente')),
    CONSTRAINT chk_mov_inv_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_mov_inv_stock_anterior CHECK (stock_anterior >= 0),
    CONSTRAINT chk_mov_inv_stock_resultante CHECK (stock_resultante >= 0),
    CONSTRAINT chk_mov_inv_compra CHECK ((tipo_movimiento <> 'entrada') OR id_compra IS NOT NULL OR motivo IS NOT NULL),
    CONSTRAINT chk_mov_inv_orden CHECK ((tipo_movimiento <> 'salida') OR id_orden_trabajo IS NOT NULL OR motivo IS NOT NULL)
);

CREATE TABLE alerta_stock (
    id_alerta CHAR(11) PRIMARY KEY,
    id_material CHAR(11) NOT NULL,
    fecha_alerta TIMESTAMPTZ NOT NULL DEFAULT now(),
    stock_detectado NUMERIC(10,2) NOT NULL,
    stock_minimo NUMERIC(10,2) NOT NULL,
    estado_alerta VARCHAR(30) NOT NULL DEFAULT 'activa',
    mensaje VARCHAR(255),
    fecha_atencion TIMESTAMPTZ,
    id_usuario_atencion CHAR(11),
    CONSTRAINT chk_alerta_id_formato CHECK (id_alerta ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_alerta_stock_detectado CHECK (stock_detectado >= 0),
    CONSTRAINT chk_alerta_stock_minimo CHECK (stock_minimo >= 0),
    CONSTRAINT chk_alerta_estado CHECK (estado_alerta IN ('activa', 'atendida', 'descartada')),
    CONSTRAINT chk_alerta_atencion CHECK ((estado_alerta = 'activa' AND fecha_atencion IS NULL) OR estado_alerta <> 'activa')
);

CREATE TABLE herramienta_epp (
    id_herramienta_epp CHAR(11) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    codigo_interno VARCHAR(30) UNIQUE,
    estado VARCHAR(30) NOT NULL DEFAULT 'operativo',
    ubicacion VARCHAR(100),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones TEXT,
    CONSTRAINT chk_herramienta_id_formato CHECK (id_herramienta_epp ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_herramienta_tipo CHECK (tipo IN ('herramienta', 'epp', 'otro')),
    CONSTRAINT chk_herramienta_estado CHECK (estado IN ('operativo', 'danado', 'perdido', 'dado_de_baja'))
);

CREATE TABLE asignacion_herramienta_epp (
    id_asignacion CHAR(11) PRIMARY KEY,
    id_herramienta_epp CHAR(11) NOT NULL,
    id_operario CHAR(11) NOT NULL,
    fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_devolucion_programada TIMESTAMPTZ,
    fecha_devolucion_real TIMESTAMPTZ,
    estado_devolucion VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    id_usuario_registro CHAR(11) NOT NULL,
    CONSTRAINT chk_asignacion_id_formato CHECK (id_asignacion ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_asignacion_estado CHECK (estado_devolucion IN ('pendiente', 'devuelto', 'perdido', 'danado')),
    CONSTRAINT chk_asignacion_fecha_programada CHECK (fecha_devolucion_programada IS NULL OR fecha_devolucion_programada >= fecha_entrega),
    CONSTRAINT chk_asignacion_fecha_real CHECK (fecha_devolucion_real IS NULL OR fecha_devolucion_real >= fecha_entrega)
);

-- -------------------------------------------------------------
-- Modulo 5: Mermas, retazos y chatarra
-- -------------------------------------------------------------

CREATE TABLE retazo_reutilizable (
    id_retazo CHAR(11) PRIMARY KEY,
    id_material CHAR(11) NOT NULL,
    id_orden_trabajo CHAR(11),
    tipo_material VARCHAR(50) NOT NULL,
    medida_aproximada VARCHAR(80),
    cantidad NUMERIC(10,2) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    ubicacion VARCHAR(100),
    estado VARCHAR(30) NOT NULL DEFAULT 'disponible',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_usuario_registro CHAR(11) NOT NULL,
    CONSTRAINT chk_retazo_id_formato CHECK (id_retazo ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_retazo_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_retazo_estado CHECK (estado IN ('disponible', 'reutilizado', 'descartado'))
);

CREATE TABLE chatarra (
    id_chatarra CHAR(11) PRIMARY KEY,
    id_material CHAR(11),
    tipo_material VARCHAR(50) NOT NULL,
    peso_kg NUMERIC(10,2),
    cantidad NUMERIC(10,2),
    estado VARCHAR(30) NOT NULL DEFAULT 'acumulada',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones TEXT,
    CONSTRAINT chk_chatarra_id_formato CHECK (id_chatarra ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_chatarra_peso CHECK (peso_kg IS NULL OR peso_kg > 0),
    CONSTRAINT chk_chatarra_cantidad CHECK (cantidad IS NULL OR cantidad > 0),
    CONSTRAINT chk_chatarra_medida CHECK (peso_kg IS NOT NULL OR cantidad IS NOT NULL),
    CONSTRAINT chk_chatarra_estado CHECK (estado IN ('acumulada', 'disponible', 'vendida'))
);

CREATE TABLE venta_chatarra (
    id_venta_chatarra CHAR(11) PRIMARY KEY,
    id_chatarra CHAR(11) NOT NULL,
    id_movimiento_caja CHAR(11),
    fecha_venta DATE NOT NULL DEFAULT CURRENT_DATE,
    cantidad_vendida NUMERIC(10,2),
    peso_vendido_kg NUMERIC(10,2),
    monto_recibido NUMERIC(12,2) NOT NULL,
    destino_dinero VARCHAR(150),
    id_usuario_registro CHAR(11) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_venta_chatarra_id_formato CHECK (id_venta_chatarra ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_venta_chatarra_cantidad CHECK (cantidad_vendida IS NULL OR cantidad_vendida > 0),
    CONSTRAINT chk_venta_chatarra_peso CHECK (peso_vendido_kg IS NULL OR peso_vendido_kg > 0),
    CONSTRAINT chk_venta_chatarra_medida CHECK (cantidad_vendida IS NOT NULL OR peso_vendido_kg IS NOT NULL),
    CONSTRAINT chk_venta_chatarra_monto CHECK (monto_recibido >= 0)
);

-- -------------------------------------------------------------
-- Modulo 7: Costos y rentabilidad
-- -------------------------------------------------------------

CREATE TABLE costeo (
    id_costeo CHAR(11) PRIMARY KEY,
    id_pedido CHAR(11),
    id_orden_trabajo CHAR(11),
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_costeo DATE NOT NULL DEFAULT CURRENT_DATE,
    costo_materiales NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_consumibles NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_mano_obra NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_indirecto_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(12,2),
    cantidad_base NUMERIC(10,2),
    observaciones TEXT,
    CONSTRAINT chk_costeo_id_formato CHECK (id_costeo ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_costeo_relacion CHECK (id_pedido IS NOT NULL OR id_orden_trabajo IS NOT NULL),
    CONSTRAINT chk_costeo_materiales CHECK (costo_materiales >= 0),
    CONSTRAINT chk_costeo_consumibles CHECK (costo_consumibles >= 0),
    CONSTRAINT chk_costeo_mano_obra CHECK (costo_mano_obra >= 0),
    CONSTRAINT chk_costeo_indirecto CHECK (costo_indirecto_total >= 0),
    CONSTRAINT chk_costeo_total CHECK (costo_total >= 0),
    CONSTRAINT chk_costeo_unitario CHECK (costo_unitario IS NULL OR costo_unitario >= 0),
    CONSTRAINT chk_costeo_cantidad_base CHECK (cantidad_base IS NULL OR cantidad_base > 0)
);

CREATE TABLE costo_indirecto (
    id_costo_indirecto CHAR(11) PRIMARY KEY,
    id_costeo CHAR(11),
    concepto VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    criterio_prorrateo VARCHAR(100),
    periodo VARCHAR(30),
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones TEXT,
    CONSTRAINT chk_costo_indirecto_id_formato CHECK (id_costo_indirecto ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_costo_indirecto_monto CHECK (monto >= 0)
);

CREATE TABLE margen_ganancia (
    id_margen CHAR(11) PRIMARY KEY,
    id_costeo CHAR(11) NOT NULL,
    id_usuario_aplica CHAR(11) NOT NULL,
    porcentaje_margen NUMERIC(5,2) NOT NULL,
    precio_sugerido NUMERIC(12,2) NOT NULL,
    precio_final NUMERIC(12,2),
    fecha_aplicacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo_ajuste TEXT,
    CONSTRAINT chk_margen_id_formato CHECK (id_margen ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_margen_porcentaje CHECK (porcentaje_margen BETWEEN 0 AND 100),
    CONSTRAINT chk_margen_precio_sugerido CHECK (precio_sugerido >= 0),
    CONSTRAINT chk_margen_precio_final CHECK (precio_final IS NULL OR precio_final >= 0)
);

CREATE TABLE rentabilidad (
    id_rentabilidad CHAR(11) PRIMARY KEY,
    id_pedido CHAR(11),
    id_costeo CHAR(11) NOT NULL,
    ingreso_estimado NUMERIC(12,2) NOT NULL,
    costo_total NUMERIC(12,2) NOT NULL,
    utilidad_estimada NUMERIC(12,2) NOT NULL,
    margen_real NUMERIC(5,2) NOT NULL,
    alerta_bajo_margen BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_calculo TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones TEXT,
    CONSTRAINT chk_rentabilidad_id_formato CHECK (id_rentabilidad ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_rentabilidad_ingreso CHECK (ingreso_estimado >= 0),
    CONSTRAINT chk_rentabilidad_costo CHECK (costo_total >= 0),
    CONSTRAINT chk_rentabilidad_margen CHECK (margen_real BETWEEN -100 AND 100)
);

-- -------------------------------------------------------------
-- Modulo 8: Caja chica y finanzas
-- -------------------------------------------------------------

CREATE TABLE caja_chica (
    id_caja_chica CHAR(11) PRIMARY KEY,
    nombre_caja VARCHAR(100) NOT NULL,
    saldo_inicial NUMERIC(12,2) NOT NULL,
    saldo_actual NUMERIC(12,2) NOT NULL,
    fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'abierta',
    responsable VARCHAR(100),
    observaciones TEXT,
    CONSTRAINT chk_caja_id_formato CHECK (id_caja_chica ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_caja_saldo_inicial CHECK (saldo_inicial >= 0),
    CONSTRAINT chk_caja_saldo_actual CHECK (saldo_actual >= 0),
    CONSTRAINT chk_caja_estado CHECK (estado IN ('abierta', 'cerrada', 'suspendida'))
);

CREATE TABLE categoria_gasto (
    id_categoria_gasto CHAR(11) PRIMARY KEY,
    nombre_categoria VARCHAR(80) NOT NULL UNIQUE,
    descripcion TEXT,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_categoria_gasto_id_formato CHECK (id_categoria_gasto ~ '^[A-Z]{3}[0-9]{8}$')
);

CREATE TABLE movimiento_caja (
    id_movimiento_caja CHAR(11) PRIMARY KEY,
    id_caja_chica CHAR(11) NOT NULL,
    id_categoria_gasto CHAR(11),
    id_usuario_registro CHAR(11) NOT NULL,
    tipo_movimiento VARCHAR(20) NOT NULL,
    concepto VARCHAR(150) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
    comprobante VARCHAR(50),
    responsable VARCHAR(100),
    observaciones TEXT,
    CONSTRAINT chk_mov_caja_id_formato CHECK (id_movimiento_caja ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_mov_caja_tipo CHECK (tipo_movimiento IN ('ingreso', 'egreso', 'ajuste')),
    CONSTRAINT chk_mov_caja_monto CHECK (monto > 0),
    CONSTRAINT chk_mov_caja_categoria CHECK ((tipo_movimiento <> 'egreso') OR id_categoria_gasto IS NOT NULL)
);

-- -------------------------------------------------------------
-- Modulo 9: Personal, asistencia y pagos
-- -------------------------------------------------------------

CREATE TABLE operario (
    id_operario CHAR(11) PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cargo VARCHAR(50),
    especialidad VARCHAR(80),
    telefono VARCHAR(20),
    direccion VARCHAR(150),
    modalidad_pago VARCHAR(30) NOT NULL,
    tarifa NUMERIC(12,2),
    fecha_ingreso DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    observaciones TEXT,
    CONSTRAINT chk_operario_id_formato CHECK (id_operario ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_operario_modalidad CHECK (modalidad_pago IN ('semanal', 'quincenal', 'mensual')),
    CONSTRAINT chk_operario_tarifa CHECK (tarifa IS NULL OR tarifa >= 0),
    CONSTRAINT chk_operario_estado CHECK (estado IN ('activo', 'inactivo', 'retirado'))
);

CREATE TABLE asistencia (
    id_asistencia CHAR(11) PRIMARY KEY,
    id_operario CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha DATE NOT NULL,
    hora_ingreso TIME,
    hora_salida TIME,
    tardanza BOOLEAN NOT NULL DEFAULT FALSE,
    falta BOOLEAN NOT NULL DEFAULT FALSE,
    horas_trabajadas NUMERIC(5,2),
    observaciones TEXT,
    CONSTRAINT chk_asistencia_id_formato CHECK (id_asistencia ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_asistencia_horas CHECK (horas_trabajadas IS NULL OR horas_trabajadas >= 0),
    CONSTRAINT chk_asistencia_horario CHECK (hora_salida IS NULL OR hora_ingreso IS NULL OR hora_salida >= hora_ingreso),
    CONSTRAINT uq_asistencia_operario_fecha UNIQUE (id_operario, fecha)
);

CREATE TABLE tarea_operario (
    id_tarea_operario CHAR(11) PRIMARY KEY,
    id_operario CHAR(11) NOT NULL,
    id_orden_trabajo CHAR(11) NOT NULL,
    id_etapa_ruta CHAR(11),
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_tarea DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion VARCHAR(255) NOT NULL,
    horas_dedicadas NUMERIC(5,2),
    estado VARCHAR(30) NOT NULL DEFAULT 'registrada',
    observaciones TEXT,
    CONSTRAINT chk_tarea_id_formato CHECK (id_tarea_operario ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_tarea_horas CHECK (horas_dedicadas IS NULL OR horas_dedicadas >= 0),
    CONSTRAINT chk_tarea_estado CHECK (estado IN ('registrada', 'validada', 'anulada'))
);

CREATE TABLE planilla_pago (
    id_planilla CHAR(11) PRIMARY KEY,
    id_operario CHAR(11) NOT NULL,
    id_usuario_genera CHAR(11) NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    modalidad_pago VARCHAR(30) NOT NULL,
    monto_bruto NUMERIC(12,2) NOT NULL,
    descuentos NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_neto NUMERIC(12,2) NOT NULL,
    estado_pago VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    fecha_generacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_planilla_id_formato CHECK (id_planilla ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_planilla_periodo CHECK (periodo_fin >= periodo_inicio),
    CONSTRAINT chk_planilla_modalidad CHECK (modalidad_pago IN ('semanal', 'quincenal', 'mensual')),
    CONSTRAINT chk_planilla_monto_bruto CHECK (monto_bruto >= 0),
    CONSTRAINT chk_planilla_descuentos CHECK (descuentos >= 0),
    CONSTRAINT chk_planilla_monto_neto CHECK (monto_neto >= 0),
    CONSTRAINT chk_planilla_estado_pago CHECK (estado_pago IN ('pendiente', 'aprobado', 'pagado')),
    CONSTRAINT uq_planilla_operario_periodo UNIQUE (id_operario, periodo_inicio, periodo_fin),
    CONSTRAINT uq_planilla_operario_ref UNIQUE (id_planilla, id_operario)
);

CREATE TABLE historial_pago_operario (
    id_historial_pago CHAR(11) PRIMARY KEY,
    id_planilla CHAR(11) NOT NULL,
    id_operario CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    monto_pagado NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(30),
    periodo VARCHAR(30) NOT NULL,
    observaciones TEXT,
    CONSTRAINT chk_hist_pago_id_formato CHECK (id_historial_pago ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_hist_pago_monto CHECK (monto_pagado > 0),
    CONSTRAINT chk_hist_pago_metodo CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo', 'transferencia', 'yape', 'plin', 'otro'))
);

-- -------------------------------------------------------------
-- Modulo 10: Mantenimiento de maquinaria
-- -------------------------------------------------------------

CREATE TABLE maquina (
    id_maquina CHAR(11) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(80) NOT NULL,
    codigo_interno VARCHAR(30) UNIQUE,
    ubicacion VARCHAR(100),
    estado VARCHAR(30) NOT NULL DEFAULT 'operativa',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones TEXT,
    CONSTRAINT chk_maquina_id_formato CHECK (id_maquina ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_maquina_estado CHECK (estado IN ('operativa', 'en_reparacion', 'inactiva', 'dada_de_baja'))
);

CREATE TABLE falla_maquina (
    id_falla CHAR(11) PRIMARY KEY,
    id_maquina CHAR(11) NOT NULL,
    id_usuario_registro CHAR(11) NOT NULL,
    fecha_falla TIMESTAMPTZ NOT NULL DEFAULT now(),
    descripcion TEXT NOT NULL,
    responsable_registro VARCHAR(100),
    estado_atencion VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    tiempo_perdido_horas NUMERIC(10,2),
    impacto_produccion TEXT,
    CONSTRAINT chk_falla_id_formato CHECK (id_falla ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_falla_estado CHECK (estado_atencion IN ('pendiente', 'en_atencion', 'reparada', 'anulada')),
    CONSTRAINT chk_falla_tiempo CHECK (tiempo_perdido_horas IS NULL OR tiempo_perdido_horas >= 0)
);

CREATE TABLE reparacion (
    id_reparacion CHAR(11) PRIMARY KEY,
    id_falla CHAR(11) NOT NULL,
    fecha_reparacion DATE NOT NULL DEFAULT CURRENT_DATE,
    tecnico_proveedor VARCHAR(100),
    mano_obra NUMERIC(12,2),
    costo_total NUMERIC(12,2) NOT NULL,
    estado_reparacion VARCHAR(30) NOT NULL DEFAULT 'programada',
    observaciones TEXT,
    CONSTRAINT chk_reparacion_id_formato CHECK (id_reparacion ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_reparacion_mano_obra CHECK (mano_obra IS NULL OR mano_obra >= 0),
    CONSTRAINT chk_reparacion_costo CHECK (costo_total >= 0),
    CONSTRAINT chk_reparacion_estado CHECK (estado_reparacion IN ('programada', 'ejecutada', 'observada', 'anulada'))
);

CREATE TABLE repuesto (
    id_repuesto CHAR(11) PRIMARY KEY,
    id_proveedor CHAR(11),
    nombre_repuesto VARCHAR(100) NOT NULL,
    descripcion TEXT,
    costo_unitario NUMERIC(12,2) NOT NULL,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_repuesto_id_formato CHECK (id_repuesto ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_repuesto_costo CHECK (costo_unitario >= 0),
    CONSTRAINT uq_repuesto_nombre UNIQUE (nombre_repuesto)
);

CREATE TABLE detalle_repuesto_reparacion (
    id_detalle_repuesto CHAR(11) PRIMARY KEY,
    id_reparacion CHAR(11) NOT NULL,
    id_repuesto CHAR(11) NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    costo_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    CONSTRAINT chk_det_repuesto_id_formato CHECK (id_detalle_repuesto ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_det_repuesto_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_det_repuesto_costo CHECK (costo_unitario >= 0),
    CONSTRAINT chk_det_repuesto_subtotal CHECK (subtotal >= 0),
    CONSTRAINT uq_det_repuesto_reparacion UNIQUE (id_reparacion, id_repuesto)
);

CREATE TABLE mantenimiento_preventivo (
    id_mantenimiento CHAR(11) PRIMARY KEY,
    id_maquina CHAR(11) NOT NULL,
    id_usuario_programa CHAR(11) NOT NULL,
    fecha_programada DATE NOT NULL,
    fecha_realizada DATE,
    responsable VARCHAR(100),
    actividad VARCHAR(255) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    CONSTRAINT chk_mantenimiento_id_formato CHECK (id_mantenimiento ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_mantenimiento_estado CHECK (estado IN ('pendiente', 'realizado', 'vencido', 'anulado')),
    CONSTRAINT chk_mantenimiento_fecha CHECK (fecha_realizada IS NULL OR fecha_realizada >= fecha_programada OR estado IN ('realizado', 'vencido'))
);

-- -------------------------------------------------------------
-- Modulo 11: Reportes, dashboard y exportacion
-- -------------------------------------------------------------

CREATE TABLE reporte (
    id_reporte CHAR(11) PRIMARY KEY,
    id_usuario CHAR(11) NOT NULL,
    tipo_reporte VARCHAR(80) NOT NULL,
    fecha_generacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    formato VARCHAR(20) NOT NULL,
    parametros TEXT,
    ruta_archivo VARCHAR(255),
    estado VARCHAR(30) NOT NULL DEFAULT 'generado',
    CONSTRAINT chk_reporte_id_formato CHECK (id_reporte ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_reporte_tipo CHECK (tipo_reporte IN ('produccion', 'inventario', 'ventas', 'proveedores', 'compras', 'caja_chica', 'personal', 'mantenimiento', 'costos', 'general')),
    CONSTRAINT chk_reporte_formato CHECK (formato IN ('pdf', 'excel', 'vista_web')),
    CONSTRAINT chk_reporte_estado CHECK (estado IN ('generado', 'descargado', 'fallido', 'eliminado_logico'))
);

CREATE TABLE dashboard_indicador (
    id_indicador CHAR(11) PRIMARY KEY,
    nombre_indicador VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    valor_numerico NUMERIC(12,2),
    valor_texto VARCHAR(100),
    unidad VARCHAR(20),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    descripcion TEXT,
    CONSTRAINT chk_dashboard_id_formato CHECK (id_indicador ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_dashboard_categoria CHECK (categoria IN ('produccion', 'inventario', 'ventas', 'finanzas', 'proveedores', 'personal', 'mantenimiento', 'costos', 'general')),
    CONSTRAINT chk_dashboard_valor CHECK (valor_numerico IS NOT NULL OR valor_texto IS NOT NULL),
    CONSTRAINT uq_dashboard_indicador UNIQUE (nombre_indicador, categoria)
);

CREATE TABLE exportacion_datos (
    id_exportacion CHAR(11) PRIMARY KEY,
    id_usuario CHAR(11) NOT NULL,
    modulo_origen VARCHAR(80) NOT NULL,
    formato VARCHAR(20) NOT NULL,
    fecha_exportacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    parametros TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'generada',
    ruta_archivo VARCHAR(255),
    CONSTRAINT chk_exportacion_id_formato CHECK (id_exportacion ~ '^[A-Z]{3}[0-9]{8}$'),
    CONSTRAINT chk_exportacion_formato CHECK (formato IN ('pdf', 'excel')),
    CONSTRAINT chk_exportacion_estado CHECK (estado IN ('generada', 'fallida', 'anulada'))
);

-- =============================================================
-- 2. FOREIGN KEYS
-- =============================================================

-- Seguridad
ALTER TABLE usuario
    ADD CONSTRAINT fk_usuario_rol
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE bitacora_operacion
    ADD CONSTRAINT fk_bitacora_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Recetas tecnicas
ALTER TABLE receta_tecnica
    ADD CONSTRAINT fk_receta_producto
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE receta_tecnica
    ADD CONSTRAINT fk_receta_usuario_creacion
    FOREIGN KEY (id_usuario_creacion) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE version_receta
    ADD CONSTRAINT fk_version_receta
    FOREIGN KEY (id_receta) REFERENCES receta_tecnica(id_receta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE version_receta
    ADD CONSTRAINT fk_version_usuario_aprueba
    FOREIGN KEY (id_usuario_aprueba) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_receta
    ADD CONSTRAINT fk_detalle_receta_version
    FOREIGN KEY (id_version_receta) REFERENCES version_receta(id_version_receta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_receta
    ADD CONSTRAINT fk_detalle_receta_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Comercial
ALTER TABLE pedido
    ADD CONSTRAINT fk_pedido_cliente
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE pedido
    ADD CONSTRAINT fk_pedido_usuario_registro
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_pedido
    ADD CONSTRAINT fk_detalle_pedido_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_pedido
    ADD CONSTRAINT fk_detalle_pedido_producto
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE proforma
    ADD CONSTRAINT fk_proforma_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE pago_cliente
    ADD CONSTRAINT fk_pago_cliente_proforma_pedido
    FOREIGN KEY (id_proforma, id_pedido) REFERENCES proforma(id_proforma, id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE pago_cliente
    ADD CONSTRAINT fk_pago_cliente_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE comprobante_venta
    ADD CONSTRAINT fk_comprobante_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE comprobante_venta
    ADD CONSTRAINT fk_comprobante_proforma_pedido
    FOREIGN KEY (id_proforma, id_pedido) REFERENCES proforma(id_proforma, id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Produccion
ALTER TABLE campania_produccion
    ADD CONSTRAINT fk_campania_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ruta_fabricacion
    ADD CONSTRAINT fk_ruta_producto
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE etapa_ruta
    ADD CONSTRAINT fk_etapa_ruta
    FOREIGN KEY (id_ruta) REFERENCES ruta_fabricacion(id_ruta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_cliente
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_producto
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_campania
    FOREIGN KEY (id_campania) REFERENCES campania_produccion(id_campania)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_detalle_pedido
    FOREIGN KEY (id_detalle_pedido) REFERENCES detalle_pedido(id_detalle_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_ruta
    FOREIGN KEY (id_ruta) REFERENCES ruta_fabricacion(id_ruta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_version_receta
    FOREIGN KEY (id_version_receta) REFERENCES version_receta(id_version_receta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE orden_trabajo
    ADD CONSTRAINT fk_orden_usuario_registro
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE avance_orden
    ADD CONSTRAINT fk_avance_orden
    FOREIGN KEY (id_orden_trabajo) REFERENCES orden_trabajo(id_orden_trabajo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE avance_orden
    ADD CONSTRAINT fk_avance_etapa
    FOREIGN KEY (id_etapa_ruta) REFERENCES etapa_ruta(id_etapa_ruta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE avance_orden
    ADD CONSTRAINT fk_avance_operario
    FOREIGN KEY (id_operario) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE avance_orden
    ADD CONSTRAINT fk_avance_usuario_actualiza
    FOREIGN KEY (id_usuario_actualiza) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE reasignacion_tarea
    ADD CONSTRAINT fk_reasignacion_avance
    FOREIGN KEY (id_avance) REFERENCES avance_orden(id_avance)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE reasignacion_tarea
    ADD CONSTRAINT fk_reasignacion_operario_anterior
    FOREIGN KEY (id_operario_anterior) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE reasignacion_tarea
    ADD CONSTRAINT fk_reasignacion_operario_nuevo
    FOREIGN KEY (id_operario_nuevo) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE reasignacion_tarea
    ADD CONSTRAINT fk_reasignacion_usuario
    FOREIGN KEY (id_usuario_responsable) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE campania_detalle
    ADD CONSTRAINT fk_campania_detalle_campania
    FOREIGN KEY (id_campania) REFERENCES campania_produccion(id_campania)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE campania_detalle
    ADD CONSTRAINT fk_campania_detalle_producto
    FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE etapa_ruta_maquina
    ADD CONSTRAINT fk_etapa_ruta_maquina_etapa
    FOREIGN KEY (id_etapa_ruta) REFERENCES etapa_ruta(id_etapa_ruta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE etapa_ruta_maquina
    ADD CONSTRAINT fk_etapa_ruta_maquina_maquina
    FOREIGN KEY (id_maquina) REFERENCES maquina(id_maquina)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Proveedores y abastecimiento
ALTER TABLE proveedor_material
    ADD CONSTRAINT fk_proveedor_material_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE proveedor_material
    ADD CONSTRAINT fk_proveedor_material_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE compra
    ADD CONSTRAINT fk_compra_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE compra
    ADD CONSTRAINT fk_compra_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_compra
    ADD CONSTRAINT fk_detalle_compra_compra
    FOREIGN KEY (id_compra) REFERENCES compra(id_compra)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_compra
    ADD CONSTRAINT fk_detalle_compra_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE pago_proveedor
    ADD CONSTRAINT fk_pago_proveedor_compra_proveedor
    FOREIGN KEY (id_compra, id_proveedor) REFERENCES compra(id_compra, id_proveedor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE pago_proveedor
    ADD CONSTRAINT fk_pago_proveedor_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE historial_precio_proveedor
    ADD CONSTRAINT fk_hist_precio_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE historial_precio_proveedor
    ADD CONSTRAINT fk_hist_precio_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE historial_precio_proveedor
    ADD CONSTRAINT fk_hist_precio_compra_proveedor
    FOREIGN KEY (id_compra, id_proveedor) REFERENCES compra(id_compra, id_proveedor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Inventario
ALTER TABLE movimiento_inventario
    ADD CONSTRAINT fk_mov_inv_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE movimiento_inventario
    ADD CONSTRAINT fk_mov_inv_orden
    FOREIGN KEY (id_orden_trabajo) REFERENCES orden_trabajo(id_orden_trabajo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE movimiento_inventario
    ADD CONSTRAINT fk_mov_inv_compra
    FOREIGN KEY (id_compra) REFERENCES compra(id_compra)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE movimiento_inventario
    ADD CONSTRAINT fk_mov_inv_usuario
    FOREIGN KEY (id_usuario_responsable) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE alerta_stock
    ADD CONSTRAINT fk_alerta_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE alerta_stock
    ADD CONSTRAINT fk_alerta_usuario_atencion
    FOREIGN KEY (id_usuario_atencion) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE asignacion_herramienta_epp
    ADD CONSTRAINT fk_asignacion_herramienta
    FOREIGN KEY (id_herramienta_epp) REFERENCES herramienta_epp(id_herramienta_epp)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE asignacion_herramienta_epp
    ADD CONSTRAINT fk_asignacion_operario
    FOREIGN KEY (id_operario) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE asignacion_herramienta_epp
    ADD CONSTRAINT fk_asignacion_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Mermas, retazos y chatarra
ALTER TABLE retazo_reutilizable
    ADD CONSTRAINT fk_retazo_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE retazo_reutilizable
    ADD CONSTRAINT fk_retazo_orden
    FOREIGN KEY (id_orden_trabajo) REFERENCES orden_trabajo(id_orden_trabajo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE retazo_reutilizable
    ADD CONSTRAINT fk_retazo_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE chatarra
    ADD CONSTRAINT fk_chatarra_material
    FOREIGN KEY (id_material) REFERENCES material(id_material)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE venta_chatarra
    ADD CONSTRAINT fk_venta_chatarra_chatarra
    FOREIGN KEY (id_chatarra) REFERENCES chatarra(id_chatarra)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE venta_chatarra
    ADD CONSTRAINT fk_venta_chatarra_mov_caja
    FOREIGN KEY (id_movimiento_caja) REFERENCES movimiento_caja(id_movimiento_caja)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE venta_chatarra
    ADD CONSTRAINT fk_venta_chatarra_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Costos y rentabilidad
ALTER TABLE costeo
    ADD CONSTRAINT fk_costeo_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE costeo
    ADD CONSTRAINT fk_costeo_orden
    FOREIGN KEY (id_orden_trabajo) REFERENCES orden_trabajo(id_orden_trabajo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE costeo
    ADD CONSTRAINT fk_costeo_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE costo_indirecto
    ADD CONSTRAINT fk_costo_indirecto_costeo
    FOREIGN KEY (id_costeo) REFERENCES costeo(id_costeo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE margen_ganancia
    ADD CONSTRAINT fk_margen_costeo
    FOREIGN KEY (id_costeo) REFERENCES costeo(id_costeo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE margen_ganancia
    ADD CONSTRAINT fk_margen_usuario
    FOREIGN KEY (id_usuario_aplica) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE rentabilidad
    ADD CONSTRAINT fk_rentabilidad_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE rentabilidad
    ADD CONSTRAINT fk_rentabilidad_costeo
    FOREIGN KEY (id_costeo) REFERENCES costeo(id_costeo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Caja chica y finanzas
ALTER TABLE movimiento_caja
    ADD CONSTRAINT fk_mov_caja_caja
    FOREIGN KEY (id_caja_chica) REFERENCES caja_chica(id_caja_chica)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE movimiento_caja
    ADD CONSTRAINT fk_mov_caja_categoria
    FOREIGN KEY (id_categoria_gasto) REFERENCES categoria_gasto(id_categoria_gasto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE movimiento_caja
    ADD CONSTRAINT fk_mov_caja_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Personal, asistencia y pagos
ALTER TABLE asistencia
    ADD CONSTRAINT fk_asistencia_operario
    FOREIGN KEY (id_operario) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE asistencia
    ADD CONSTRAINT fk_asistencia_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE tarea_operario
    ADD CONSTRAINT fk_tarea_operario
    FOREIGN KEY (id_operario) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE tarea_operario
    ADD CONSTRAINT fk_tarea_orden
    FOREIGN KEY (id_orden_trabajo) REFERENCES orden_trabajo(id_orden_trabajo)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE tarea_operario
    ADD CONSTRAINT fk_tarea_etapa
    FOREIGN KEY (id_etapa_ruta) REFERENCES etapa_ruta(id_etapa_ruta)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE tarea_operario
    ADD CONSTRAINT fk_tarea_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE planilla_pago
    ADD CONSTRAINT fk_planilla_operario
    FOREIGN KEY (id_operario) REFERENCES operario(id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE planilla_pago
    ADD CONSTRAINT fk_planilla_usuario
    FOREIGN KEY (id_usuario_genera) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE historial_pago_operario
    ADD CONSTRAINT fk_hist_pago_planilla_operario
    FOREIGN KEY (id_planilla, id_operario) REFERENCES planilla_pago(id_planilla, id_operario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE historial_pago_operario
    ADD CONSTRAINT fk_hist_pago_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Mantenimiento
ALTER TABLE falla_maquina
    ADD CONSTRAINT fk_falla_maquina
    FOREIGN KEY (id_maquina) REFERENCES maquina(id_maquina)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE falla_maquina
    ADD CONSTRAINT fk_falla_usuario
    FOREIGN KEY (id_usuario_registro) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE reparacion
    ADD CONSTRAINT fk_reparacion_falla
    FOREIGN KEY (id_falla) REFERENCES falla_maquina(id_falla)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE repuesto
    ADD CONSTRAINT fk_repuesto_proveedor
    FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_repuesto_reparacion
    ADD CONSTRAINT fk_det_repuesto_reparacion
    FOREIGN KEY (id_reparacion) REFERENCES reparacion(id_reparacion)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE detalle_repuesto_reparacion
    ADD CONSTRAINT fk_det_repuesto_repuesto
    FOREIGN KEY (id_repuesto) REFERENCES repuesto(id_repuesto)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE mantenimiento_preventivo
    ADD CONSTRAINT fk_mantenimiento_maquina
    FOREIGN KEY (id_maquina) REFERENCES maquina(id_maquina)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE mantenimiento_preventivo
    ADD CONSTRAINT fk_mantenimiento_usuario
    FOREIGN KEY (id_usuario_programa) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Reportes
ALTER TABLE reporte
    ADD CONSTRAINT fk_reporte_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE exportacion_datos
    ADD CONSTRAINT fk_exportacion_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- =============================================================
-- 3. INDEXES
-- =============================================================

-- Seguridad
CREATE INDEX idx_usuario_id_rol ON usuario(id_rol);
CREATE INDEX idx_usuario_estado ON usuario(estado);
CREATE INDEX idx_bitacora_usuario_fecha ON bitacora_operacion(id_usuario, fecha_hora DESC);
CREATE INDEX idx_bitacora_entidad ON bitacora_operacion(entidad_afectada, id_registro_afectado);
CREATE INDEX idx_bitacora_accion ON bitacora_operacion(accion);

-- Recetas y materiales
CREATE INDEX idx_producto_categoria ON producto(categoria);
CREATE INDEX idx_producto_estado ON producto(estado);
CREATE INDEX idx_material_categoria ON material(categoria);
CREATE INDEX idx_material_estado ON material(estado);
CREATE INDEX idx_material_stock ON material(stock_actual, stock_minimo);
CREATE INDEX idx_receta_producto ON receta_tecnica(id_producto);
CREATE INDEX idx_receta_estado ON receta_tecnica(estado);
CREATE INDEX idx_version_receta_id_receta ON version_receta(id_receta);
CREATE INDEX idx_version_receta_estado ON version_receta(estado);
CREATE UNIQUE INDEX uq_version_receta_vigente ON version_receta(id_receta) WHERE estado = 'vigente';
CREATE INDEX idx_detalle_receta_version ON detalle_receta(id_version_receta);
CREATE INDEX idx_detalle_receta_material ON detalle_receta(id_material);

-- Comercial
CREATE INDEX idx_cliente_tipo ON cliente(tipo_cliente);
CREATE INDEX idx_cliente_estado ON cliente(estado);
CREATE INDEX idx_cliente_nombre ON cliente(nombre_razon_social);
CREATE INDEX idx_pedido_cliente ON pedido(id_cliente);
CREATE INDEX idx_pedido_usuario ON pedido(id_usuario_registro);
CREATE INDEX idx_pedido_estado ON pedido(estado);
CREATE INDEX idx_pedido_fecha ON pedido(fecha_pedido DESC);
CREATE INDEX idx_detalle_pedido_pedido ON detalle_pedido(id_pedido);
CREATE INDEX idx_detalle_pedido_producto ON detalle_pedido(id_producto);
CREATE INDEX idx_proforma_pedido ON proforma(id_pedido);
CREATE INDEX idx_proforma_estado ON proforma(estado);
CREATE INDEX idx_proforma_fecha ON proforma(fecha_emision DESC);
CREATE INDEX idx_pago_cliente_proforma ON pago_cliente(id_proforma);
CREATE INDEX idx_pago_cliente_pedido ON pago_cliente(id_pedido);
CREATE INDEX idx_pago_cliente_fecha ON pago_cliente(fecha_pago DESC);
CREATE INDEX idx_comprobante_pedido ON comprobante_venta(id_pedido);
CREATE INDEX idx_comprobante_proforma ON comprobante_venta(id_proforma);
CREATE INDEX idx_comprobante_fecha ON comprobante_venta(fecha_emision DESC);

-- Produccion
CREATE INDEX idx_campania_estado ON campania_produccion(estado);
CREATE INDEX idx_campania_fechas ON campania_produccion(fecha_inicio, fecha_fin);
CREATE INDEX idx_ruta_producto ON ruta_fabricacion(id_producto);
CREATE INDEX idx_etapa_ruta ON etapa_ruta(id_ruta);
CREATE INDEX idx_etapa_ruta_orden ON etapa_ruta(id_ruta, orden_secuencia);
CREATE INDEX idx_orden_cliente ON orden_trabajo(id_cliente);
CREATE INDEX idx_orden_producto ON orden_trabajo(id_producto);
CREATE INDEX idx_orden_campania ON orden_trabajo(id_campania);
CREATE INDEX idx_orden_detalle_pedido ON orden_trabajo(id_detalle_pedido);
CREATE INDEX idx_orden_ruta ON orden_trabajo(id_ruta);
CREATE INDEX idx_orden_version_receta ON orden_trabajo(id_version_receta);
CREATE INDEX idx_orden_estado ON orden_trabajo(estado);
CREATE INDEX idx_orden_prioridad ON orden_trabajo(prioridad);
CREATE INDEX idx_orden_fechas ON orden_trabajo(fecha_inicio, fecha_entrega_estimada);
CREATE INDEX idx_avance_orden ON avance_orden(id_orden_trabajo);
CREATE INDEX idx_avance_etapa ON avance_orden(id_etapa_ruta);
CREATE INDEX idx_avance_operario ON avance_orden(id_operario);
CREATE INDEX idx_avance_estado ON avance_orden(estado_etapa);
CREATE INDEX idx_reasignacion_avance ON reasignacion_tarea(id_avance);
CREATE INDEX idx_reasignacion_operario_nuevo ON reasignacion_tarea(id_operario_nuevo);
CREATE INDEX idx_campania_detalle_campania ON campania_detalle(id_campania);
CREATE INDEX idx_campania_detalle_producto ON campania_detalle(id_producto);
CREATE INDEX idx_etapa_ruta_maquina_etapa ON etapa_ruta_maquina(id_etapa_ruta);
CREATE INDEX idx_etapa_ruta_maquina_maquina ON etapa_ruta_maquina(id_maquina);

-- Proveedores y compras
CREATE INDEX idx_proveedor_tipo ON proveedor(tipo_proveedor);
CREATE INDEX idx_proveedor_estado ON proveedor(estado);
CREATE INDEX idx_proveedor_razon_social ON proveedor(razon_social);
CREATE INDEX idx_proveedor_material_proveedor ON proveedor_material(id_proveedor);
CREATE INDEX idx_proveedor_material_material ON proveedor_material(id_material);
CREATE INDEX idx_compra_proveedor ON compra(id_proveedor);
CREATE INDEX idx_compra_fecha ON compra(fecha_compra DESC);
CREATE INDEX idx_compra_estado_pago ON compra(estado_pago);
CREATE INDEX idx_compra_estado ON compra(estado_compra);
CREATE INDEX idx_detalle_compra_compra ON detalle_compra(id_compra);
CREATE INDEX idx_detalle_compra_material ON detalle_compra(id_material);
CREATE INDEX idx_pago_proveedor_compra ON pago_proveedor(id_compra);
CREATE INDEX idx_pago_proveedor_proveedor ON pago_proveedor(id_proveedor);
CREATE INDEX idx_pago_proveedor_fecha ON pago_proveedor(fecha_pago DESC);
CREATE INDEX idx_hist_precio_proveedor ON historial_precio_proveedor(id_proveedor);
CREATE INDEX idx_hist_precio_material ON historial_precio_proveedor(id_material);
CREATE INDEX idx_hist_precio_fecha ON historial_precio_proveedor(fecha_registro DESC);

-- Inventario
CREATE INDEX idx_mov_inv_material ON movimiento_inventario(id_material);
CREATE INDEX idx_mov_inv_orden ON movimiento_inventario(id_orden_trabajo);
CREATE INDEX idx_mov_inv_compra ON movimiento_inventario(id_compra);
CREATE INDEX idx_mov_inv_tipo ON movimiento_inventario(tipo_movimiento);
CREATE INDEX idx_mov_inv_fecha ON movimiento_inventario(fecha_movimiento DESC);
CREATE INDEX idx_alerta_material ON alerta_stock(id_material);
CREATE INDEX idx_alerta_estado ON alerta_stock(estado_alerta);
CREATE INDEX idx_herramienta_tipo ON herramienta_epp(tipo);
CREATE INDEX idx_herramienta_estado ON herramienta_epp(estado);
CREATE INDEX idx_asignacion_herramienta ON asignacion_herramienta_epp(id_herramienta_epp);
CREATE INDEX idx_asignacion_operario ON asignacion_herramienta_epp(id_operario);
CREATE INDEX idx_asignacion_estado ON asignacion_herramienta_epp(estado_devolucion);

-- Mermas y chatarra
CREATE INDEX idx_retazo_material ON retazo_reutilizable(id_material);
CREATE INDEX idx_retazo_orden ON retazo_reutilizable(id_orden_trabajo);
CREATE INDEX idx_retazo_estado ON retazo_reutilizable(estado);
CREATE INDEX idx_chatarra_material ON chatarra(id_material);
CREATE INDEX idx_chatarra_estado ON chatarra(estado);
CREATE INDEX idx_venta_chatarra_fecha ON venta_chatarra(fecha_venta DESC);
CREATE INDEX idx_venta_chatarra_mov_caja ON venta_chatarra(id_movimiento_caja);

-- Costos
CREATE INDEX idx_costeo_pedido ON costeo(id_pedido);
CREATE INDEX idx_costeo_orden ON costeo(id_orden_trabajo);
CREATE INDEX idx_costeo_fecha ON costeo(fecha_costeo DESC);
CREATE INDEX idx_costo_indirecto_costeo ON costo_indirecto(id_costeo);
CREATE INDEX idx_costo_indirecto_periodo ON costo_indirecto(periodo);
CREATE INDEX idx_margen_costeo ON margen_ganancia(id_costeo);
CREATE INDEX idx_rentabilidad_pedido ON rentabilidad(id_pedido);
CREATE INDEX idx_rentabilidad_costeo ON rentabilidad(id_costeo);
CREATE INDEX idx_rentabilidad_fecha ON rentabilidad(fecha_calculo DESC);

-- Caja chica
CREATE INDEX idx_caja_estado ON caja_chica(estado);
CREATE INDEX idx_categoria_gasto_estado ON categoria_gasto(estado);
CREATE INDEX idx_mov_caja_caja ON movimiento_caja(id_caja_chica);
CREATE INDEX idx_mov_caja_categoria ON movimiento_caja(id_categoria_gasto);
CREATE INDEX idx_mov_caja_usuario ON movimiento_caja(id_usuario_registro);
CREATE INDEX idx_mov_caja_tipo ON movimiento_caja(tipo_movimiento);
CREATE INDEX idx_mov_caja_fecha ON movimiento_caja(fecha_movimiento DESC);

-- Personal
CREATE INDEX idx_operario_modalidad ON operario(modalidad_pago);
CREATE INDEX idx_operario_estado ON operario(estado);
CREATE INDEX idx_asistencia_operario ON asistencia(id_operario);
CREATE INDEX idx_asistencia_fecha ON asistencia(fecha DESC);
CREATE INDEX idx_tarea_operario ON tarea_operario(id_operario);
CREATE INDEX idx_tarea_orden ON tarea_operario(id_orden_trabajo);
CREATE INDEX idx_tarea_fecha ON tarea_operario(fecha_tarea DESC);
CREATE INDEX idx_planilla_operario ON planilla_pago(id_operario);
CREATE INDEX idx_planilla_estado ON planilla_pago(estado_pago);
CREATE INDEX idx_hist_pago_operario ON historial_pago_operario(id_operario);
CREATE INDEX idx_hist_pago_fecha ON historial_pago_operario(fecha_pago DESC);

-- Mantenimiento
CREATE INDEX idx_maquina_estado ON maquina(estado);
CREATE INDEX idx_falla_maquina ON falla_maquina(id_maquina);
CREATE INDEX idx_falla_fecha ON falla_maquina(fecha_falla DESC);
CREATE INDEX idx_falla_estado ON falla_maquina(estado_atencion);
CREATE INDEX idx_reparacion_falla ON reparacion(id_falla);
CREATE INDEX idx_reparacion_fecha ON reparacion(fecha_reparacion DESC);
CREATE INDEX idx_repuesto_proveedor ON repuesto(id_proveedor);
CREATE INDEX idx_det_repuesto_reparacion ON detalle_repuesto_reparacion(id_reparacion);
CREATE INDEX idx_det_repuesto_repuesto ON detalle_repuesto_reparacion(id_repuesto);
CREATE INDEX idx_mantenimiento_maquina ON mantenimiento_preventivo(id_maquina);
CREATE INDEX idx_mantenimiento_fecha ON mantenimiento_preventivo(fecha_programada DESC);
CREATE INDEX idx_mantenimiento_estado ON mantenimiento_preventivo(estado);

-- Reportes
CREATE INDEX idx_reporte_usuario ON reporte(id_usuario);
CREATE INDEX idx_reporte_tipo ON reporte(tipo_reporte);
CREATE INDEX idx_reporte_fecha ON reporte(fecha_generacion DESC);
CREATE INDEX idx_dashboard_categoria ON dashboard_indicador(categoria);
CREATE INDEX idx_exportacion_usuario ON exportacion_datos(id_usuario);
CREATE INDEX idx_exportacion_modulo ON exportacion_datos(modulo_origen);
CREATE INDEX idx_exportacion_fecha ON exportacion_datos(fecha_exportacion DESC);

-- =============================================================
-- 4. COMMENTS
-- =============================================================

-- Table comments
COMMENT ON TABLE rol IS 'Catalogo de roles del sistema: Administrador/Dueno, Maestro de taller, Vendedor u otros roles autorizados.';
COMMENT ON TABLE usuario IS 'Usuarios autenticados del sistema con rol asignado, credenciales cifradas y estado de acceso.';
COMMENT ON TABLE bitacora_operacion IS 'Bitacora transversal para auditar operaciones criticas realizadas por usuarios.';
COMMENT ON TABLE producto IS 'Productos terminados fabricados por el taller, como lampas, rastrillos y tripodes.';
COMMENT ON TABLE material IS 'Materiales, materias primas, consumibles, repuestos o herramientas controladas en almacen.';
COMMENT ON TABLE receta_tecnica IS 'Recetas tecnicas asociadas a productos para estandarizar materiales y procesos.';
COMMENT ON TABLE version_receta IS 'Versiones historicas o vigentes de una receta tecnica.';
COMMENT ON TABLE detalle_receta IS 'Detalle de materiales y cantidades requeridas por version de receta.';
COMMENT ON TABLE cliente IS 'Clientes del taller: ferreterias, distribuidoras, constructoras, cliente final u otros.';
COMMENT ON TABLE pedido IS 'Pedidos comerciales registrados para clientes.';
COMMENT ON TABLE detalle_pedido IS 'Productos solicitados dentro de un pedido.';
COMMENT ON TABLE proforma IS 'Proformas digitales asociadas a pedidos, con montos, adelantos y saldo.';
COMMENT ON TABLE pago_cliente IS 'Pagos, adelantos, amortizaciones o cancelaciones realizadas por clientes.';
COMMENT ON TABLE comprobante_venta IS 'Comprobantes de venta emitidos por pedidos o proformas.';
COMMENT ON TABLE campania_produccion IS 'Campanias o temporadas de produccion planificadas.';
COMMENT ON TABLE ruta_fabricacion IS 'Rutas de fabricacion por producto.';
COMMENT ON TABLE etapa_ruta IS 'Etapas ordenadas que componen una ruta de fabricacion.';
COMMENT ON TABLE orden_trabajo IS 'Ordenes de trabajo para producir por pedido, campania o reposicion de stock.';
COMMENT ON TABLE avance_orden IS 'Avances de produccion por etapa de una orden de trabajo.';
COMMENT ON TABLE reasignacion_tarea IS 'Historial de reasignaciones de tareas ante contingencias o fallas.';
COMMENT ON TABLE campania_detalle IS 'Detalle de productos y cantidades objetivo por campania de produccion.';
COMMENT ON TABLE etapa_ruta_maquina IS 'Relacion entre etapas de fabricacion y maquinas criticas requeridas.';
COMMENT ON TABLE proveedor IS 'Proveedores de materia prima, consumibles, repuestos, servicios u otros.';
COMMENT ON TABLE proveedor_material IS 'Relacion proveedor-material con precio referencial, disponibilidad y plazo de entrega.';
COMMENT ON TABLE compra IS 'Compras registradas a proveedores.';
COMMENT ON TABLE detalle_compra IS 'Detalle de materiales comprados en una compra.';
COMMENT ON TABLE pago_proveedor IS 'Pagos realizados a proveedores sobre compras registradas.';
COMMENT ON TABLE historial_precio_proveedor IS 'Historial de precios por proveedor y material.';
COMMENT ON TABLE movimiento_inventario IS 'Movimientos de inventario: entradas, salidas, ajustes, reservas, devoluciones y prestamos.';
COMMENT ON TABLE alerta_stock IS 'Alertas generadas cuando el stock detectado alcanza o baja del minimo.';
COMMENT ON TABLE herramienta_epp IS 'Herramientas manuales y equipos de proteccion personal controlados por el taller.';
COMMENT ON TABLE asignacion_herramienta_epp IS 'Asignacion de herramientas o EPP a operarios.';
COMMENT ON TABLE retazo_reutilizable IS 'Retazos viables generados en produccion que pueden reutilizarse.';
COMMENT ON TABLE chatarra IS 'Chatarra acumulada o disponible para venta.';
COMMENT ON TABLE venta_chatarra IS 'Ventas de chatarra y su posible vinculacion con caja chica.';
COMMENT ON TABLE costeo IS 'Calculo de costos asociados a pedidos u ordenes de trabajo.';
COMMENT ON TABLE costo_indirecto IS 'Costos indirectos como luz, desgaste de maquina o transporte.';
COMMENT ON TABLE margen_ganancia IS 'Margenes aplicados sobre costeos para obtener precio sugerido o final.';
COMMENT ON TABLE rentabilidad IS 'Analisis de rentabilidad estimada por pedido o costeo.';
COMMENT ON TABLE caja_chica IS 'Fondos de caja chica del taller.';
COMMENT ON TABLE categoria_gasto IS 'Categorias usadas para clasificar egresos de caja chica.';
COMMENT ON TABLE movimiento_caja IS 'Movimientos financieros menores de caja chica.';
COMMENT ON TABLE operario IS 'Operarios registrados para asistencia, tareas y pagos.';
COMMENT ON TABLE asistencia IS 'Registro diario de asistencia de operarios.';
COMMENT ON TABLE tarea_operario IS 'Tareas diarias realizadas por operarios en ordenes o etapas.';
COMMENT ON TABLE planilla_pago IS 'Planillas generadas por periodo y operario.';
COMMENT ON TABLE historial_pago_operario IS 'Historial de pagos efectuados a operarios.';
COMMENT ON TABLE maquina IS 'Maquinas y equipos criticos del taller.';
COMMENT ON TABLE falla_maquina IS 'Fallas de maquinaria con impacto y tiempo perdido.';
COMMENT ON TABLE reparacion IS 'Reparaciones efectuadas para atender fallas.';
COMMENT ON TABLE repuesto IS 'Repuestos usados en mantenimiento y reparaciones.';
COMMENT ON TABLE detalle_repuesto_reparacion IS 'Detalle de repuestos utilizados en reparaciones.';
COMMENT ON TABLE mantenimiento_preventivo IS 'Programacion y seguimiento de mantenimiento preventivo.';
COMMENT ON TABLE reporte IS 'Historial de reportes generados por usuarios.';
COMMENT ON TABLE dashboard_indicador IS 'Indicadores almacenados para dashboard gerencial.';
COMMENT ON TABLE exportacion_datos IS 'Historial de exportaciones de informacion del sistema.';

-- Column comments are generated below for traceability.
COMMENT ON COLUMN rol.id_rol IS 'Identificador unico del rol.';
COMMENT ON COLUMN rol.nombre_rol IS 'Nombre unico del rol del sistema.';
COMMENT ON COLUMN rol.descripcion IS 'Descripcion del alcance funcional del rol.';
COMMENT ON COLUMN rol.estado IS 'Indica si el rol esta activo.';
COMMENT ON COLUMN usuario.id_usuario IS 'Identificador unico del usuario.';
COMMENT ON COLUMN usuario.id_rol IS 'Rol asignado al usuario.';
COMMENT ON COLUMN usuario.nombres IS 'Nombres del usuario.';
COMMENT ON COLUMN usuario.apellidos IS 'Apellidos del usuario.';
COMMENT ON COLUMN usuario.usuario IS 'Nombre de usuario para inicio de sesion.';
COMMENT ON COLUMN usuario.correo IS 'Correo electronico del usuario.';
COMMENT ON COLUMN usuario.clave_hash IS 'Contrasena cifrada.';
COMMENT ON COLUMN usuario.estado IS 'Estado de acceso del usuario.';
COMMENT ON COLUMN usuario.fecha_registro IS 'Fecha y hora de creacion.';
COMMENT ON COLUMN usuario.ultimo_acceso IS 'Fecha y hora del ultimo acceso.';
COMMENT ON COLUMN bitacora_operacion.id_bitacora IS 'Identificador unico de la bitacora.';
COMMENT ON COLUMN bitacora_operacion.id_usuario IS 'Usuario que ejecuto la operacion.';
COMMENT ON COLUMN bitacora_operacion.entidad_afectada IS 'Entidad modificada, consultada o afectada.';
COMMENT ON COLUMN bitacora_operacion.id_registro_afectado IS 'Identificador del registro afectado.';
COMMENT ON COLUMN bitacora_operacion.accion IS 'Accion auditada.';
COMMENT ON COLUMN bitacora_operacion.fecha_hora IS 'Fecha y hora de la operacion.';
COMMENT ON COLUMN bitacora_operacion.detalle IS 'Detalle descriptivo de la operacion.';
COMMENT ON COLUMN bitacora_operacion.ip_origen IS 'Direccion IP o referencia de origen.';
COMMENT ON COLUMN producto.id_producto IS 'Identificador unico del producto.';
COMMENT ON COLUMN producto.nombre_producto IS 'Nombre comercial o tecnico del producto.';
COMMENT ON COLUMN producto.categoria IS 'Categoria del producto.';
COMMENT ON COLUMN producto.descripcion IS 'Descripcion del producto.';
COMMENT ON COLUMN producto.unidad_medida IS 'Unidad de medida del producto terminado.';
COMMENT ON COLUMN producto.precio_referencial IS 'Precio referencial del producto.';
COMMENT ON COLUMN producto.estado IS 'Indica si el producto esta activo.';
COMMENT ON COLUMN producto.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN material.id_material IS 'Identificador unico del material.';
COMMENT ON COLUMN material.nombre_material IS 'Nombre del material o insumo.';
COMMENT ON COLUMN material.categoria IS 'Categoria del material.';
COMMENT ON COLUMN material.unidad_medida IS 'Unidad de medida del material.';
COMMENT ON COLUMN material.stock_actual IS 'Cantidad total disponible en almacen.';
COMMENT ON COLUMN material.stock_reservado IS 'Cantidad reservada para ordenes.';
COMMENT ON COLUMN material.stock_minimo IS 'Cantidad minima para generar alerta.';
COMMENT ON COLUMN material.costo_unitario_actual IS 'Costo unitario vigente.';
COMMENT ON COLUMN material.estado IS 'Indica si el material esta activo.';
COMMENT ON COLUMN material.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN receta_tecnica.id_receta IS 'Identificador unico de la receta.';
COMMENT ON COLUMN receta_tecnica.id_producto IS 'Producto al que pertenece la receta.';
COMMENT ON COLUMN receta_tecnica.nombre_receta IS 'Nombre de la receta tecnica.';
COMMENT ON COLUMN receta_tecnica.descripcion IS 'Descripcion general de la receta.';
COMMENT ON COLUMN receta_tecnica.estado IS 'Estado de la receta.';
COMMENT ON COLUMN receta_tecnica.fecha_creacion IS 'Fecha de creacion de la receta.';
COMMENT ON COLUMN receta_tecnica.id_usuario_creacion IS 'Usuario que registro la receta.';
COMMENT ON COLUMN version_receta.id_version_receta IS 'Identificador unico de la version.';
COMMENT ON COLUMN version_receta.id_receta IS 'Receta tecnica a la que pertenece.';
COMMENT ON COLUMN version_receta.numero_version IS 'Numero o codigo de version.';
COMMENT ON COLUMN version_receta.fecha_version IS 'Fecha de la version.';
COMMENT ON COLUMN version_receta.motivo_cambio IS 'Motivo del cambio respecto a la version anterior.';
COMMENT ON COLUMN version_receta.estado IS 'Estado de la version.';
COMMENT ON COLUMN version_receta.id_usuario_aprueba IS 'Usuario que aprobo la version.';
COMMENT ON COLUMN detalle_receta.id_detalle_receta IS 'Identificador unico del detalle de receta.';
COMMENT ON COLUMN detalle_receta.id_version_receta IS 'Version de receta relacionada.';
COMMENT ON COLUMN detalle_receta.id_material IS 'Material requerido.';
COMMENT ON COLUMN detalle_receta.cantidad_requerida IS 'Cantidad requerida por unidad de producto.';
COMMENT ON COLUMN detalle_receta.unidad_medida IS 'Unidad aplicada al material.';
COMMENT ON COLUMN detalle_receta.tipo_consumo IS 'Tipo de consumo del material.';
COMMENT ON COLUMN detalle_receta.merma_estimada_porcentaje IS 'Porcentaje estimado de merma.';
COMMENT ON COLUMN detalle_receta.observaciones IS 'Observaciones adicionales.';
COMMENT ON COLUMN cliente.id_cliente IS 'Identificador unico del cliente.';
COMMENT ON COLUMN cliente.tipo_cliente IS 'Tipo de cliente.';
COMMENT ON COLUMN cliente.nombre_razon_social IS 'Nombre o razon social del cliente.';
COMMENT ON COLUMN cliente.tipo_documento IS 'Tipo de documento.';
COMMENT ON COLUMN cliente.numero_documento IS 'Numero de documento.';
COMMENT ON COLUMN cliente.telefono IS 'Telefono de contacto.';
COMMENT ON COLUMN cliente.correo IS 'Correo electronico.';
COMMENT ON COLUMN cliente.direccion IS 'Direccion del cliente.';
COMMENT ON COLUMN cliente.lugar_origen IS 'Lugar de procedencia.';
COMMENT ON COLUMN cliente.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN cliente.estado IS 'Indica si el cliente esta activo.';
COMMENT ON COLUMN cliente.observaciones IS 'Observaciones comerciales.';
COMMENT ON COLUMN pedido.id_pedido IS 'Identificador unico del pedido.';
COMMENT ON COLUMN pedido.id_cliente IS 'Cliente que realiza el pedido.';
COMMENT ON COLUMN pedido.id_usuario_registro IS 'Usuario que registro el pedido.';
COMMENT ON COLUMN pedido.fecha_pedido IS 'Fecha del pedido.';
COMMENT ON COLUMN pedido.fecha_entrega_estimada IS 'Fecha estimada de entrega.';
COMMENT ON COLUMN pedido.estado IS 'Estado del pedido.';
COMMENT ON COLUMN pedido.monto_estimado IS 'Monto estimado del pedido.';
COMMENT ON COLUMN pedido.observaciones IS 'Comentarios del pedido.';
COMMENT ON COLUMN detalle_pedido.id_detalle_pedido IS 'Identificador unico del detalle de pedido.';
COMMENT ON COLUMN detalle_pedido.id_pedido IS 'Pedido al que pertenece.';
COMMENT ON COLUMN detalle_pedido.id_producto IS 'Producto solicitado.';
COMMENT ON COLUMN detalle_pedido.cantidad IS 'Cantidad solicitada.';
COMMENT ON COLUMN detalle_pedido.precio_unitario IS 'Precio unitario acordado.';
COMMENT ON COLUMN detalle_pedido.subtotal IS 'Importe parcial.';
COMMENT ON COLUMN detalle_pedido.observaciones IS 'Notas adicionales.';
COMMENT ON COLUMN proforma.id_proforma IS 'Identificador unico de la proforma.';
COMMENT ON COLUMN proforma.id_pedido IS 'Pedido asociado.';
COMMENT ON COLUMN proforma.numero_proforma IS 'Numero unico de proforma.';
COMMENT ON COLUMN proforma.fecha_emision IS 'Fecha de emision.';
COMMENT ON COLUMN proforma.monto_total IS 'Monto total de la proforma.';
COMMENT ON COLUMN proforma.adelanto_inicial IS 'Adelanto inicial registrado.';
COMMENT ON COLUMN proforma.saldo IS 'Saldo pendiente.';
COMMENT ON COLUMN proforma.estado IS 'Estado de la proforma.';
COMMENT ON COLUMN proforma.validez_dias IS 'Dias de validez.';
COMMENT ON COLUMN proforma.observaciones IS 'Condiciones o comentarios.';
COMMENT ON COLUMN pago_cliente.id_pago_cliente IS 'Identificador unico del pago de cliente.';
COMMENT ON COLUMN pago_cliente.id_proforma IS 'Proforma asociada.';
COMMENT ON COLUMN pago_cliente.id_pedido IS 'Pedido asociado validado con la proforma.';
COMMENT ON COLUMN pago_cliente.id_usuario_registro IS 'Usuario que registro el pago.';
COMMENT ON COLUMN pago_cliente.fecha_pago IS 'Fecha del pago.';
COMMENT ON COLUMN pago_cliente.monto_pagado IS 'Monto pagado por el cliente.';
COMMENT ON COLUMN pago_cliente.metodo_pago IS 'Medio de pago utilizado.';
COMMENT ON COLUMN pago_cliente.tipo_pago IS 'Tipo de pago.';
COMMENT ON COLUMN pago_cliente.saldo_actual IS 'Saldo despues del pago.';
COMMENT ON COLUMN pago_cliente.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN comprobante_venta.id_comprobante IS 'Identificador unico del comprobante.';
COMMENT ON COLUMN comprobante_venta.id_pedido IS 'Pedido asociado.';
COMMENT ON COLUMN comprobante_venta.id_proforma IS 'Proforma asociada si corresponde.';
COMMENT ON COLUMN comprobante_venta.tipo_comprobante IS 'Tipo de comprobante.';
COMMENT ON COLUMN comprobante_venta.numero_comprobante IS 'Numero unico del comprobante.';
COMMENT ON COLUMN comprobante_venta.fecha_emision IS 'Fecha de emision.';
COMMENT ON COLUMN comprobante_venta.monto_total IS 'Monto total del comprobante.';
COMMENT ON COLUMN comprobante_venta.estado IS 'Estado del comprobante.';
COMMENT ON COLUMN comprobante_venta.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN campania_produccion.id_campania IS 'Identificador unico de campania.';
COMMENT ON COLUMN campania_produccion.nombre_campania IS 'Nombre de campania o temporada.';
COMMENT ON COLUMN campania_produccion.fecha_inicio IS 'Fecha de inicio.';
COMMENT ON COLUMN campania_produccion.fecha_fin IS 'Fecha de fin.';
COMMENT ON COLUMN campania_produccion.objetivo_general IS 'Objetivo productivo general.';
COMMENT ON COLUMN campania_produccion.estado IS 'Estado de la campania.';
COMMENT ON COLUMN campania_produccion.id_usuario_registro IS 'Usuario que registro la campania.';
COMMENT ON COLUMN ruta_fabricacion.id_ruta IS 'Identificador unico de la ruta.';
COMMENT ON COLUMN ruta_fabricacion.id_producto IS 'Producto al que pertenece la ruta.';
COMMENT ON COLUMN ruta_fabricacion.nombre_ruta IS 'Nombre de la ruta.';
COMMENT ON COLUMN ruta_fabricacion.descripcion IS 'Descripcion del proceso.';
COMMENT ON COLUMN ruta_fabricacion.estado IS 'Indica si la ruta esta activa.';
COMMENT ON COLUMN etapa_ruta.id_etapa_ruta IS 'Identificador unico de la etapa.';
COMMENT ON COLUMN etapa_ruta.id_ruta IS 'Ruta a la que pertenece.';
COMMENT ON COLUMN etapa_ruta.nombre_etapa IS 'Nombre de la etapa productiva.';
COMMENT ON COLUMN etapa_ruta.orden_secuencia IS 'Orden de ejecucion.';
COMMENT ON COLUMN etapa_ruta.descripcion IS 'Detalle tecnico de la etapa.';
COMMENT ON COLUMN etapa_ruta.tiempo_estimado_horas IS 'Tiempo estimado en horas.';
COMMENT ON COLUMN etapa_ruta.requiere_maquina IS 'Indica si requiere maquina critica.';
COMMENT ON COLUMN etapa_ruta.estado IS 'Indica si la etapa esta activa.';
COMMENT ON COLUMN orden_trabajo.id_orden_trabajo IS 'Identificador unico de la orden.';
COMMENT ON COLUMN orden_trabajo.id_cliente IS 'Cliente asociado si aplica.';
COMMENT ON COLUMN orden_trabajo.id_producto IS 'Producto a fabricar.';
COMMENT ON COLUMN orden_trabajo.id_campania IS 'Campania asociada si aplica.';
COMMENT ON COLUMN orden_trabajo.id_detalle_pedido IS 'Detalle de pedido que origina la orden.';
COMMENT ON COLUMN orden_trabajo.id_ruta IS 'Ruta de fabricacion usada.';
COMMENT ON COLUMN orden_trabajo.id_version_receta IS 'Version de receta usada.';
COMMENT ON COLUMN orden_trabajo.tipo_produccion IS 'Tipo de produccion.';
COMMENT ON COLUMN orden_trabajo.cantidad IS 'Cantidad total a fabricar.';
COMMENT ON COLUMN orden_trabajo.fecha_inicio IS 'Fecha de inicio programada.';
COMMENT ON COLUMN orden_trabajo.fecha_entrega_estimada IS 'Fecha estimada de entrega.';
COMMENT ON COLUMN orden_trabajo.fecha_entrega_real IS 'Fecha real de finalizacion.';
COMMENT ON COLUMN orden_trabajo.prioridad IS 'Prioridad de atencion.';
COMMENT ON COLUMN orden_trabajo.estado IS 'Estado de la orden.';
COMMENT ON COLUMN orden_trabajo.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN orden_trabajo.id_usuario_registro IS 'Usuario que registro la orden.';
COMMENT ON COLUMN orden_trabajo.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN avance_orden.id_avance IS 'Identificador unico del avance.';
COMMENT ON COLUMN avance_orden.id_orden_trabajo IS 'Orden asociada.';
COMMENT ON COLUMN avance_orden.id_etapa_ruta IS 'Etapa controlada.';
COMMENT ON COLUMN avance_orden.id_operario IS 'Operario asignado.';
COMMENT ON COLUMN avance_orden.estado_etapa IS 'Estado de la etapa.';
COMMENT ON COLUMN avance_orden.porcentaje_avance IS 'Porcentaje de avance.';
COMMENT ON COLUMN avance_orden.fecha_inicio_etapa IS 'Fecha y hora de inicio de etapa.';
COMMENT ON COLUMN avance_orden.fecha_fin_etapa IS 'Fecha y hora de fin de etapa.';
COMMENT ON COLUMN avance_orden.observaciones IS 'Observaciones del avance.';
COMMENT ON COLUMN avance_orden.id_usuario_actualiza IS 'Usuario que actualizo el avance.';
COMMENT ON COLUMN reasignacion_tarea.id_reasignacion IS 'Identificador unico de reasignacion.';
COMMENT ON COLUMN reasignacion_tarea.id_avance IS 'Avance afectado.';
COMMENT ON COLUMN reasignacion_tarea.id_operario_anterior IS 'Operario asignado anteriormente.';
COMMENT ON COLUMN reasignacion_tarea.id_operario_nuevo IS 'Nuevo operario asignado.';
COMMENT ON COLUMN reasignacion_tarea.motivo IS 'Motivo de reasignacion.';
COMMENT ON COLUMN reasignacion_tarea.fecha_reasignacion IS 'Fecha y hora de reasignacion.';
COMMENT ON COLUMN reasignacion_tarea.id_usuario_responsable IS 'Usuario responsable de la reasignacion.';
COMMENT ON COLUMN campania_detalle.id_campania_detalle IS 'Identificador del detalle de campania.';
COMMENT ON COLUMN campania_detalle.id_campania IS 'Campania relacionada.';
COMMENT ON COLUMN campania_detalle.id_producto IS 'Producto incluido.';
COMMENT ON COLUMN campania_detalle.cantidad_objetivo IS 'Cantidad objetivo a fabricar.';
COMMENT ON COLUMN campania_detalle.cantidad_producida IS 'Cantidad producida acumulada.';
COMMENT ON COLUMN campania_detalle.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN etapa_ruta_maquina.id_etapa_ruta_maquina IS 'Identificador de relacion etapa-maquina.';
COMMENT ON COLUMN etapa_ruta_maquina.id_etapa_ruta IS 'Etapa de ruta asociada.';
COMMENT ON COLUMN etapa_ruta_maquina.id_maquina IS 'Maquina requerida.';
COMMENT ON COLUMN etapa_ruta_maquina.observaciones IS 'Observaciones de uso o restriccion.';
COMMENT ON COLUMN proveedor.id_proveedor IS 'Identificador unico del proveedor.';
COMMENT ON COLUMN proveedor.razon_social IS 'Nombre o razon social.';
COMMENT ON COLUMN proveedor.tipo_documento IS 'Tipo de documento.';
COMMENT ON COLUMN proveedor.numero_documento IS 'Numero de documento.';
COMMENT ON COLUMN proveedor.telefono IS 'Telefono de contacto.';
COMMENT ON COLUMN proveedor.correo IS 'Correo electronico.';
COMMENT ON COLUMN proveedor.direccion IS 'Direccion comercial.';
COMMENT ON COLUMN proveedor.contacto_principal IS 'Persona de contacto.';
COMMENT ON COLUMN proveedor.tipo_proveedor IS 'Tipo de proveedor.';
COMMENT ON COLUMN proveedor.condicion_pago IS 'Condicion de pago.';
COMMENT ON COLUMN proveedor.estado IS 'Indica si el proveedor esta activo.';
COMMENT ON COLUMN proveedor.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN proveedor_material.id_proveedor_material IS 'Identificador de relacion proveedor-material.';
COMMENT ON COLUMN proveedor_material.id_proveedor IS 'Proveedor que suministra.';
COMMENT ON COLUMN proveedor_material.id_material IS 'Material suministrado.';
COMMENT ON COLUMN proveedor_material.precio_referencial IS 'Precio referencial ofrecido.';
COMMENT ON COLUMN proveedor_material.unidad_medida IS 'Unidad de compra.';
COMMENT ON COLUMN proveedor_material.tiempo_entrega_dias IS 'Tiempo estimado de entrega.';
COMMENT ON COLUMN proveedor_material.disponibilidad IS 'Disponibilidad del material.';
COMMENT ON COLUMN proveedor_material.estado IS 'Estado de la relacion.';
COMMENT ON COLUMN proveedor_material.fecha_actualizacion IS 'Ultima actualizacion.';
COMMENT ON COLUMN compra.id_compra IS 'Identificador unico de compra.';
COMMENT ON COLUMN compra.id_proveedor IS 'Proveedor de la compra.';
COMMENT ON COLUMN compra.id_usuario_registro IS 'Usuario que registro la compra.';
COMMENT ON COLUMN compra.fecha_compra IS 'Fecha de compra.';
COMMENT ON COLUMN compra.tipo_comprobante IS 'Tipo de comprobante.';
COMMENT ON COLUMN compra.numero_comprobante IS 'Numero de comprobante.';
COMMENT ON COLUMN compra.subtotal IS 'Subtotal de compra.';
COMMENT ON COLUMN compra.igv IS 'Impuesto registrado.';
COMMENT ON COLUMN compra.monto_total IS 'Monto total.';
COMMENT ON COLUMN compra.estado_pago IS 'Estado de pago.';
COMMENT ON COLUMN compra.estado_compra IS 'Estado de la compra.';
COMMENT ON COLUMN compra.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN compra.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN detalle_compra.id_detalle_compra IS 'Identificador del detalle de compra.';
COMMENT ON COLUMN detalle_compra.id_compra IS 'Compra relacionada.';
COMMENT ON COLUMN detalle_compra.id_material IS 'Material comprado.';
COMMENT ON COLUMN detalle_compra.cantidad IS 'Cantidad comprada.';
COMMENT ON COLUMN detalle_compra.unidad_medida IS 'Unidad de compra.';
COMMENT ON COLUMN detalle_compra.costo_unitario IS 'Costo unitario.';
COMMENT ON COLUMN detalle_compra.subtotal IS 'Subtotal del detalle.';
COMMENT ON COLUMN detalle_compra.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN pago_proveedor.id_pago_proveedor IS 'Identificador unico del pago a proveedor.';
COMMENT ON COLUMN pago_proveedor.id_compra IS 'Compra asociada.';
COMMENT ON COLUMN pago_proveedor.id_proveedor IS 'Proveedor pagado validado con la compra.';
COMMENT ON COLUMN pago_proveedor.id_usuario_registro IS 'Usuario que registro el pago.';
COMMENT ON COLUMN pago_proveedor.fecha_pago IS 'Fecha de pago.';
COMMENT ON COLUMN pago_proveedor.monto_pagado IS 'Monto pagado.';
COMMENT ON COLUMN pago_proveedor.metodo_pago IS 'Metodo de pago.';
COMMENT ON COLUMN pago_proveedor.saldo_pendiente IS 'Saldo restante.';
COMMENT ON COLUMN pago_proveedor.estado_pago IS 'Estado posterior al pago.';
COMMENT ON COLUMN pago_proveedor.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN historial_precio_proveedor.id_historial_precio IS 'Identificador del historial de precio.';
COMMENT ON COLUMN historial_precio_proveedor.id_proveedor IS 'Proveedor relacionado.';
COMMENT ON COLUMN historial_precio_proveedor.id_material IS 'Material relacionado.';
COMMENT ON COLUMN historial_precio_proveedor.id_compra IS 'Compra que origino el precio.';
COMMENT ON COLUMN historial_precio_proveedor.precio_unitario IS 'Precio unitario registrado.';
COMMENT ON COLUMN historial_precio_proveedor.fecha_registro IS 'Fecha del precio.';
COMMENT ON COLUMN historial_precio_proveedor.origen_registro IS 'Origen del registro.';
COMMENT ON COLUMN historial_precio_proveedor.observaciones IS 'Notas adicionales.';
COMMENT ON COLUMN movimiento_inventario.id_movimiento IS 'Identificador unico de movimiento.';
COMMENT ON COLUMN movimiento_inventario.id_material IS 'Material afectado.';
COMMENT ON COLUMN movimiento_inventario.id_orden_trabajo IS 'Orden asociada si aplica.';
COMMENT ON COLUMN movimiento_inventario.id_compra IS 'Compra asociada si aplica.';
COMMENT ON COLUMN movimiento_inventario.tipo_movimiento IS 'Tipo de movimiento.';
COMMENT ON COLUMN movimiento_inventario.cantidad IS 'Cantidad movida.';
COMMENT ON COLUMN movimiento_inventario.stock_anterior IS 'Stock antes del movimiento.';
COMMENT ON COLUMN movimiento_inventario.stock_resultante IS 'Stock despues del movimiento.';
COMMENT ON COLUMN movimiento_inventario.fecha_movimiento IS 'Fecha y hora del movimiento.';
COMMENT ON COLUMN movimiento_inventario.motivo IS 'Motivo del movimiento.';
COMMENT ON COLUMN movimiento_inventario.id_usuario_responsable IS 'Usuario responsable.';
COMMENT ON COLUMN alerta_stock.id_alerta IS 'Identificador unico de alerta.';
COMMENT ON COLUMN alerta_stock.id_material IS 'Material que genero alerta.';
COMMENT ON COLUMN alerta_stock.fecha_alerta IS 'Fecha y hora de alerta.';
COMMENT ON COLUMN alerta_stock.stock_detectado IS 'Stock detectado.';
COMMENT ON COLUMN alerta_stock.stock_minimo IS 'Stock minimo configurado.';
COMMENT ON COLUMN alerta_stock.estado_alerta IS 'Estado de la alerta.';
COMMENT ON COLUMN alerta_stock.mensaje IS 'Mensaje descriptivo.';
COMMENT ON COLUMN alerta_stock.fecha_atencion IS 'Fecha de atencion.';
COMMENT ON COLUMN alerta_stock.id_usuario_atencion IS 'Usuario que atendio.';
COMMENT ON COLUMN herramienta_epp.id_herramienta_epp IS 'Identificador unico de herramienta o EPP.';
COMMENT ON COLUMN herramienta_epp.nombre IS 'Nombre de herramienta o EPP.';
COMMENT ON COLUMN herramienta_epp.tipo IS 'Tipo de item.';
COMMENT ON COLUMN herramienta_epp.codigo_interno IS 'Codigo interno del taller.';
COMMENT ON COLUMN herramienta_epp.estado IS 'Estado fisico o administrativo.';
COMMENT ON COLUMN herramienta_epp.ubicacion IS 'Ubicacion actual.';
COMMENT ON COLUMN herramienta_epp.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN herramienta_epp.observaciones IS 'Observaciones.';
COMMENT ON COLUMN asignacion_herramienta_epp.id_asignacion IS 'Identificador unico de asignacion.';
COMMENT ON COLUMN asignacion_herramienta_epp.id_herramienta_epp IS 'Herramienta o EPP asignado.';
COMMENT ON COLUMN asignacion_herramienta_epp.id_operario IS 'Operario receptor.';
COMMENT ON COLUMN asignacion_herramienta_epp.fecha_entrega IS 'Fecha y hora de entrega.';
COMMENT ON COLUMN asignacion_herramienta_epp.fecha_devolucion_programada IS 'Fecha programada de devolucion.';
COMMENT ON COLUMN asignacion_herramienta_epp.fecha_devolucion_real IS 'Fecha real de devolucion.';
COMMENT ON COLUMN asignacion_herramienta_epp.estado_devolucion IS 'Estado de devolucion.';
COMMENT ON COLUMN asignacion_herramienta_epp.observaciones IS 'Comentarios.';
COMMENT ON COLUMN asignacion_herramienta_epp.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN retazo_reutilizable.id_retazo IS 'Identificador unico del retazo.';
COMMENT ON COLUMN retazo_reutilizable.id_material IS 'Material de origen.';
COMMENT ON COLUMN retazo_reutilizable.id_orden_trabajo IS 'Orden donde se genero.';
COMMENT ON COLUMN retazo_reutilizable.tipo_material IS 'Tipo de material del retazo.';
COMMENT ON COLUMN retazo_reutilizable.medida_aproximada IS 'Medida aproximada.';
COMMENT ON COLUMN retazo_reutilizable.cantidad IS 'Cantidad registrada.';
COMMENT ON COLUMN retazo_reutilizable.unidad_medida IS 'Unidad de medida.';
COMMENT ON COLUMN retazo_reutilizable.ubicacion IS 'Ubicacion fisica.';
COMMENT ON COLUMN retazo_reutilizable.estado IS 'Estado del retazo.';
COMMENT ON COLUMN retazo_reutilizable.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN retazo_reutilizable.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN chatarra.id_chatarra IS 'Identificador unico de chatarra.';
COMMENT ON COLUMN chatarra.id_material IS 'Material de origen si se identifica.';
COMMENT ON COLUMN chatarra.tipo_material IS 'Tipo de material.';
COMMENT ON COLUMN chatarra.peso_kg IS 'Peso en kilogramos.';
COMMENT ON COLUMN chatarra.cantidad IS 'Cantidad aproximada.';
COMMENT ON COLUMN chatarra.estado IS 'Estado de chatarra.';
COMMENT ON COLUMN chatarra.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN chatarra.observaciones IS 'Observaciones.';
COMMENT ON COLUMN venta_chatarra.id_venta_chatarra IS 'Identificador unico de venta.';
COMMENT ON COLUMN venta_chatarra.id_chatarra IS 'Chatarra vendida.';
COMMENT ON COLUMN venta_chatarra.id_movimiento_caja IS 'Movimiento de caja generado.';
COMMENT ON COLUMN venta_chatarra.fecha_venta IS 'Fecha de venta.';
COMMENT ON COLUMN venta_chatarra.cantidad_vendida IS 'Cantidad vendida.';
COMMENT ON COLUMN venta_chatarra.peso_vendido_kg IS 'Peso vendido.';
COMMENT ON COLUMN venta_chatarra.monto_recibido IS 'Monto recibido.';
COMMENT ON COLUMN venta_chatarra.destino_dinero IS 'Destino del dinero.';
COMMENT ON COLUMN venta_chatarra.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN venta_chatarra.observaciones IS 'Comentarios adicionales.';
COMMENT ON COLUMN costeo.id_costeo IS 'Identificador unico del costeo.';
COMMENT ON COLUMN costeo.id_pedido IS 'Pedido asociado.';
COMMENT ON COLUMN costeo.id_orden_trabajo IS 'Orden asociada.';
COMMENT ON COLUMN costeo.id_usuario_registro IS 'Usuario que genero el costeo.';
COMMENT ON COLUMN costeo.fecha_costeo IS 'Fecha del calculo.';
COMMENT ON COLUMN costeo.costo_materiales IS 'Costo total de materiales.';
COMMENT ON COLUMN costeo.costo_consumibles IS 'Costo total de consumibles.';
COMMENT ON COLUMN costeo.costo_mano_obra IS 'Costo de mano de obra.';
COMMENT ON COLUMN costeo.costo_indirecto_total IS 'Total de costos indirectos.';
COMMENT ON COLUMN costeo.costo_total IS 'Costo total consolidado.';
COMMENT ON COLUMN costeo.costo_unitario IS 'Costo unitario calculado.';
COMMENT ON COLUMN costeo.cantidad_base IS 'Cantidad base de calculo.';
COMMENT ON COLUMN costeo.observaciones IS 'Comentarios.';
COMMENT ON COLUMN costo_indirecto.id_costo_indirecto IS 'Identificador del costo indirecto.';
COMMENT ON COLUMN costo_indirecto.id_costeo IS 'Costeo asociado.';
COMMENT ON COLUMN costo_indirecto.concepto IS 'Concepto del costo.';
COMMENT ON COLUMN costo_indirecto.categoria IS 'Categoria del costo.';
COMMENT ON COLUMN costo_indirecto.monto IS 'Monto del costo.';
COMMENT ON COLUMN costo_indirecto.criterio_prorrateo IS 'Criterio de prorrateo.';
COMMENT ON COLUMN costo_indirecto.periodo IS 'Periodo del costo.';
COMMENT ON COLUMN costo_indirecto.fecha_registro IS 'Fecha de registro.';
COMMENT ON COLUMN costo_indirecto.observaciones IS 'Comentarios.';
COMMENT ON COLUMN margen_ganancia.id_margen IS 'Identificador unico del margen.';
COMMENT ON COLUMN margen_ganancia.id_costeo IS 'Costeo base.';
COMMENT ON COLUMN margen_ganancia.id_usuario_aplica IS 'Usuario que aplica margen.';
COMMENT ON COLUMN margen_ganancia.porcentaje_margen IS 'Porcentaje de margen aplicado.';
COMMENT ON COLUMN margen_ganancia.precio_sugerido IS 'Precio sugerido.';
COMMENT ON COLUMN margen_ganancia.precio_final IS 'Precio final aprobado.';
COMMENT ON COLUMN margen_ganancia.fecha_aplicacion IS 'Fecha y hora de aplicacion.';
COMMENT ON COLUMN margen_ganancia.motivo_ajuste IS 'Motivo de ajuste manual.';
COMMENT ON COLUMN rentabilidad.id_rentabilidad IS 'Identificador unico de rentabilidad.';
COMMENT ON COLUMN rentabilidad.id_pedido IS 'Pedido relacionado.';
COMMENT ON COLUMN rentabilidad.id_costeo IS 'Costeo utilizado.';
COMMENT ON COLUMN rentabilidad.ingreso_estimado IS 'Ingreso esperado.';
COMMENT ON COLUMN rentabilidad.costo_total IS 'Costo total comparado.';
COMMENT ON COLUMN rentabilidad.utilidad_estimada IS 'Utilidad estimada.';
COMMENT ON COLUMN rentabilidad.margen_real IS 'Margen real estimado.';
COMMENT ON COLUMN rentabilidad.alerta_bajo_margen IS 'Indica bajo margen.';
COMMENT ON COLUMN rentabilidad.fecha_calculo IS 'Fecha y hora de calculo.';
COMMENT ON COLUMN rentabilidad.observaciones IS 'Comentarios.';
COMMENT ON COLUMN caja_chica.id_caja_chica IS 'Identificador unico de caja chica.';
COMMENT ON COLUMN caja_chica.nombre_caja IS 'Nombre de la caja.';
COMMENT ON COLUMN caja_chica.saldo_inicial IS 'Saldo inicial.';
COMMENT ON COLUMN caja_chica.saldo_actual IS 'Saldo actual.';
COMMENT ON COLUMN caja_chica.fecha_apertura IS 'Fecha de apertura.';
COMMENT ON COLUMN caja_chica.estado IS 'Estado de caja.';
COMMENT ON COLUMN caja_chica.responsable IS 'Responsable administrativo.';
COMMENT ON COLUMN caja_chica.observaciones IS 'Comentarios.';
COMMENT ON COLUMN categoria_gasto.id_categoria_gasto IS 'Identificador unico de categoria.';
COMMENT ON COLUMN categoria_gasto.nombre_categoria IS 'Nombre unico de categoria.';
COMMENT ON COLUMN categoria_gasto.descripcion IS 'Descripcion.';
COMMENT ON COLUMN categoria_gasto.estado IS 'Indica si la categoria esta activa.';
COMMENT ON COLUMN movimiento_caja.id_movimiento_caja IS 'Identificador unico de movimiento de caja.';
COMMENT ON COLUMN movimiento_caja.id_caja_chica IS 'Caja chica relacionada.';
COMMENT ON COLUMN movimiento_caja.id_categoria_gasto IS 'Categoria del egreso.';
COMMENT ON COLUMN movimiento_caja.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN movimiento_caja.tipo_movimiento IS 'Tipo de movimiento.';
COMMENT ON COLUMN movimiento_caja.concepto IS 'Concepto del movimiento.';
COMMENT ON COLUMN movimiento_caja.monto IS 'Monto.';
COMMENT ON COLUMN movimiento_caja.fecha_movimiento IS 'Fecha del movimiento.';
COMMENT ON COLUMN movimiento_caja.comprobante IS 'Referencia de comprobante.';
COMMENT ON COLUMN movimiento_caja.responsable IS 'Responsable del gasto o ingreso.';
COMMENT ON COLUMN movimiento_caja.observaciones IS 'Comentarios.';
COMMENT ON COLUMN operario.id_operario IS 'Identificador unico del operario.';
COMMENT ON COLUMN operario.nombres IS 'Nombres del operario.';
COMMENT ON COLUMN operario.apellidos IS 'Apellidos del operario.';
COMMENT ON COLUMN operario.cargo IS 'Cargo o funcion.';
COMMENT ON COLUMN operario.especialidad IS 'Especialidad tecnica.';
COMMENT ON COLUMN operario.telefono IS 'Telefono.';
COMMENT ON COLUMN operario.direccion IS 'Direccion.';
COMMENT ON COLUMN operario.modalidad_pago IS 'Modalidad de pago.';
COMMENT ON COLUMN operario.tarifa IS 'Tarifa base.';
COMMENT ON COLUMN operario.fecha_ingreso IS 'Fecha de ingreso.';
COMMENT ON COLUMN operario.estado IS 'Estado laboral.';
COMMENT ON COLUMN operario.observaciones IS 'Comentarios.';
COMMENT ON COLUMN asistencia.id_asistencia IS 'Identificador unico de asistencia.';
COMMENT ON COLUMN asistencia.id_operario IS 'Operario relacionado.';
COMMENT ON COLUMN asistencia.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN asistencia.fecha IS 'Fecha de asistencia.';
COMMENT ON COLUMN asistencia.hora_ingreso IS 'Hora de ingreso.';
COMMENT ON COLUMN asistencia.hora_salida IS 'Hora de salida.';
COMMENT ON COLUMN asistencia.tardanza IS 'Indica tardanza.';
COMMENT ON COLUMN asistencia.falta IS 'Indica falta.';
COMMENT ON COLUMN asistencia.horas_trabajadas IS 'Horas trabajadas.';
COMMENT ON COLUMN asistencia.observaciones IS 'Comentarios.';
COMMENT ON COLUMN tarea_operario.id_tarea_operario IS 'Identificador unico de tarea.';
COMMENT ON COLUMN tarea_operario.id_operario IS 'Operario que realizo tarea.';
COMMENT ON COLUMN tarea_operario.id_orden_trabajo IS 'Orden asociada.';
COMMENT ON COLUMN tarea_operario.id_etapa_ruta IS 'Etapa relacionada.';
COMMENT ON COLUMN tarea_operario.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN tarea_operario.fecha_tarea IS 'Fecha de tarea.';
COMMENT ON COLUMN tarea_operario.descripcion IS 'Descripcion de actividad.';
COMMENT ON COLUMN tarea_operario.horas_dedicadas IS 'Horas dedicadas.';
COMMENT ON COLUMN tarea_operario.estado IS 'Estado de tarea.';
COMMENT ON COLUMN tarea_operario.observaciones IS 'Comentarios.';
COMMENT ON COLUMN planilla_pago.id_planilla IS 'Identificador unico de planilla.';
COMMENT ON COLUMN planilla_pago.id_operario IS 'Operario incluido.';
COMMENT ON COLUMN planilla_pago.id_usuario_genera IS 'Usuario que genero planilla.';
COMMENT ON COLUMN planilla_pago.periodo_inicio IS 'Inicio del periodo.';
COMMENT ON COLUMN planilla_pago.periodo_fin IS 'Fin del periodo.';
COMMENT ON COLUMN planilla_pago.modalidad_pago IS 'Modalidad usada.';
COMMENT ON COLUMN planilla_pago.monto_bruto IS 'Monto antes de descuentos.';
COMMENT ON COLUMN planilla_pago.descuentos IS 'Descuentos aplicados.';
COMMENT ON COLUMN planilla_pago.monto_neto IS 'Monto final a pagar.';
COMMENT ON COLUMN planilla_pago.estado_pago IS 'Estado de pago.';
COMMENT ON COLUMN planilla_pago.fecha_generacion IS 'Fecha y hora de generacion.';
COMMENT ON COLUMN historial_pago_operario.id_historial_pago IS 'Identificador unico de historial.';
COMMENT ON COLUMN historial_pago_operario.id_planilla IS 'Planilla asociada.';
COMMENT ON COLUMN historial_pago_operario.id_operario IS 'Operario pagado.';
COMMENT ON COLUMN historial_pago_operario.id_usuario_registro IS 'Usuario que registro pago.';
COMMENT ON COLUMN historial_pago_operario.fecha_pago IS 'Fecha de pago.';
COMMENT ON COLUMN historial_pago_operario.monto_pagado IS 'Monto pagado.';
COMMENT ON COLUMN historial_pago_operario.metodo_pago IS 'Metodo de pago.';
COMMENT ON COLUMN historial_pago_operario.periodo IS 'Periodo pagado.';
COMMENT ON COLUMN historial_pago_operario.observaciones IS 'Comentarios.';
COMMENT ON COLUMN maquina.id_maquina IS 'Identificador unico de maquina.';
COMMENT ON COLUMN maquina.nombre IS 'Nombre de la maquina.';
COMMENT ON COLUMN maquina.tipo IS 'Tipo de maquina o equipo.';
COMMENT ON COLUMN maquina.codigo_interno IS 'Codigo interno.';
COMMENT ON COLUMN maquina.ubicacion IS 'Ubicacion fisica.';
COMMENT ON COLUMN maquina.estado IS 'Estado de la maquina.';
COMMENT ON COLUMN maquina.fecha_registro IS 'Fecha y hora de registro.';
COMMENT ON COLUMN maquina.observaciones IS 'Comentarios.';
COMMENT ON COLUMN falla_maquina.id_falla IS 'Identificador unico de falla.';
COMMENT ON COLUMN falla_maquina.id_maquina IS 'Maquina afectada.';
COMMENT ON COLUMN falla_maquina.id_usuario_registro IS 'Usuario que registro.';
COMMENT ON COLUMN falla_maquina.fecha_falla IS 'Fecha y hora de falla.';
COMMENT ON COLUMN falla_maquina.descripcion IS 'Descripcion tecnica.';
COMMENT ON COLUMN falla_maquina.responsable_registro IS 'Persona que reporto.';
COMMENT ON COLUMN falla_maquina.estado_atencion IS 'Estado de atencion.';
COMMENT ON COLUMN falla_maquina.tiempo_perdido_horas IS 'Horas perdidas.';
COMMENT ON COLUMN falla_maquina.impacto_produccion IS 'Impacto en produccion.';
COMMENT ON COLUMN reparacion.id_reparacion IS 'Identificador unico de reparacion.';
COMMENT ON COLUMN reparacion.id_falla IS 'Falla asociada.';
COMMENT ON COLUMN reparacion.fecha_reparacion IS 'Fecha de reparacion.';
COMMENT ON COLUMN reparacion.tecnico_proveedor IS 'Tecnico o proveedor.';
COMMENT ON COLUMN reparacion.mano_obra IS 'Costo de mano de obra.';
COMMENT ON COLUMN reparacion.costo_total IS 'Costo total.';
COMMENT ON COLUMN reparacion.estado_reparacion IS 'Estado de reparacion.';
COMMENT ON COLUMN reparacion.observaciones IS 'Detalles adicionales.';
COMMENT ON COLUMN repuesto.id_repuesto IS 'Identificador unico de repuesto.';
COMMENT ON COLUMN repuesto.id_proveedor IS 'Proveedor del repuesto.';
COMMENT ON COLUMN repuesto.nombre_repuesto IS 'Nombre del repuesto.';
COMMENT ON COLUMN repuesto.descripcion IS 'Descripcion.';
COMMENT ON COLUMN repuesto.costo_unitario IS 'Costo unitario.';
COMMENT ON COLUMN repuesto.estado IS 'Indica si esta activo.';
COMMENT ON COLUMN detalle_repuesto_reparacion.id_detalle_repuesto IS 'Identificador del detalle de repuesto.';
COMMENT ON COLUMN detalle_repuesto_reparacion.id_reparacion IS 'Reparacion relacionada.';
COMMENT ON COLUMN detalle_repuesto_reparacion.id_repuesto IS 'Repuesto usado.';
COMMENT ON COLUMN detalle_repuesto_reparacion.cantidad IS 'Cantidad usada.';
COMMENT ON COLUMN detalle_repuesto_reparacion.costo_unitario IS 'Costo unitario aplicado.';
COMMENT ON COLUMN detalle_repuesto_reparacion.subtotal IS 'Costo parcial.';
COMMENT ON COLUMN mantenimiento_preventivo.id_mantenimiento IS 'Identificador unico de mantenimiento.';
COMMENT ON COLUMN mantenimiento_preventivo.id_maquina IS 'Maquina asociada.';
COMMENT ON COLUMN mantenimiento_preventivo.id_usuario_programa IS 'Usuario que programo.';
COMMENT ON COLUMN mantenimiento_preventivo.fecha_programada IS 'Fecha programada.';
COMMENT ON COLUMN mantenimiento_preventivo.fecha_realizada IS 'Fecha realizada.';
COMMENT ON COLUMN mantenimiento_preventivo.responsable IS 'Responsable.';
COMMENT ON COLUMN mantenimiento_preventivo.actividad IS 'Actividad preventiva.';
COMMENT ON COLUMN mantenimiento_preventivo.estado IS 'Estado del mantenimiento.';
COMMENT ON COLUMN mantenimiento_preventivo.observaciones IS 'Comentarios.';
COMMENT ON COLUMN reporte.id_reporte IS 'Identificador unico de reporte.';
COMMENT ON COLUMN reporte.id_usuario IS 'Usuario generador.';
COMMENT ON COLUMN reporte.tipo_reporte IS 'Tipo de reporte.';
COMMENT ON COLUMN reporte.fecha_generacion IS 'Fecha y hora de generacion.';
COMMENT ON COLUMN reporte.formato IS 'Formato generado.';
COMMENT ON COLUMN reporte.parametros IS 'Parametros usados.';
COMMENT ON COLUMN reporte.ruta_archivo IS 'Ruta o referencia del archivo.';
COMMENT ON COLUMN reporte.estado IS 'Estado del reporte.';
COMMENT ON COLUMN dashboard_indicador.id_indicador IS 'Identificador unico de indicador.';
COMMENT ON COLUMN dashboard_indicador.nombre_indicador IS 'Nombre del indicador.';
COMMENT ON COLUMN dashboard_indicador.categoria IS 'Area o categoria.';
COMMENT ON COLUMN dashboard_indicador.valor_numerico IS 'Valor numerico.';
COMMENT ON COLUMN dashboard_indicador.valor_texto IS 'Valor textual.';
COMMENT ON COLUMN dashboard_indicador.unidad IS 'Unidad de medida.';
COMMENT ON COLUMN dashboard_indicador.fecha_actualizacion IS 'Fecha y hora de actualizacion.';
COMMENT ON COLUMN dashboard_indicador.descripcion IS 'Descripcion.';
COMMENT ON COLUMN exportacion_datos.id_exportacion IS 'Identificador unico de exportacion.';
COMMENT ON COLUMN exportacion_datos.id_usuario IS 'Usuario ejecutor.';
COMMENT ON COLUMN exportacion_datos.modulo_origen IS 'Modulo origen.';
COMMENT ON COLUMN exportacion_datos.formato IS 'Formato exportado.';
COMMENT ON COLUMN exportacion_datos.fecha_exportacion IS 'Fecha y hora de exportacion.';
COMMENT ON COLUMN exportacion_datos.parametros IS 'Parametros usados.';
COMMENT ON COLUMN exportacion_datos.estado IS 'Estado de exportacion.';
COMMENT ON COLUMN exportacion_datos.ruta_archivo IS 'Ruta o referencia del archivo.';


-- =============================================================
-- 5. OPTIONAL SEED DATA FOR BASIC ROLES AND EXPENSE CATEGORIES
-- Ejecutar solo si se desea cargar datos iniciales.
-- =============================================================

-- INSERT INTO rol (id_rol, nombre_rol, descripcion, estado) VALUES
-- ('ROL00000001', 'Administrador/Dueno', 'Acceso total al sistema.', TRUE),
-- ('ROL00000002', 'Maestro de taller', 'Gestion operativa de produccion e inventario.', TRUE),
-- ('ROL00000003', 'Vendedor', 'Gestion comercial de clientes, pedidos y proformas.', TRUE);

-- INSERT INTO categoria_gasto (id_categoria_gasto, nombre_categoria, descripcion, estado) VALUES
-- ('CGA00000001', 'repuestos', 'Gastos por compra de repuestos.', TRUE),
-- ('CGA00000002', 'consumibles', 'Gastos por consumibles de taller.', TRUE),
-- ('CGA00000003', 'transporte', 'Gastos de transporte.', TRUE),
-- ('CGA00000004', 'mantenimiento', 'Gastos de mantenimiento.', TRUE),
-- ('CGA00000005', 'refrigerios', 'Gastos de refrigerios.', TRUE),
-- ('CGA00000006', 'otros', 'Otros gastos menores.', TRUE);

-- =============================================================
-- FIN DEL DDL
-- =============================================================
