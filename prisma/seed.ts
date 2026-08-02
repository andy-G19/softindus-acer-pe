import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Este seed contiene unicamente datos estructurales y catalogos.
// Los usuarios productivos no deben crearse ni actualizarse desde el seed.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const roles = [
  {
    id_rol: "ROL00000001",
    nombre_rol: "ADMIN",
    descripcion: "Usuario con acceso total al sistema.",
    estado: true,
  },
  {
    id_rol: "ROL00000002",
    nombre_rol: "SELLER",
    descripcion: "Usuario responsable del módulo comercial: clientes, pedidos, proformas, pagos y comprobantes.",
    estado: true,
  },
  {
    id_rol: "ROL00000003",
    nombre_rol: "WORKSHOP_MASTER",
    descripcion: "Usuario responsable de producción, órdenes de trabajo, avances e inventario operativo.",
    estado: true,
  },
];

const productCategories = [
  {
    id_categoria_producto: "CPR00000001",
    nombre: "Lampa",
    slug: "lampa",
    descripcion: "Categoria base para productos tipo lampa.",
    estado: true,
  },
  {
    id_categoria_producto: "CPR00000002",
    nombre: "Rastrillo",
    slug: "rastrillo",
    descripcion: "Categoria base para productos tipo rastrillo.",
    estado: true,
  },
  {
    id_categoria_producto: "CPR00000003",
    nombre: "Tripode",
    slug: "tripode",
    descripcion: "Categoria base para productos tipo tripode.",
    estado: true,
  },
  {
    id_categoria_producto: "CPR00000004",
    nombre: "Otro",
    slug: "otro",
    descripcion: "Categoria base para productos generales.",
    estado: true,
  },
];

const materialCategories = [
  {
    id_categoria_material: "CMA00000001",
    nombre: "Materia prima",
    slug: "materia_prima",
    descripcion: "Categoria base para materias primas.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000002",
    nombre: "Consumible",
    slug: "consumible",
    descripcion: "Categoria base para consumibles.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000003",
    nombre: "Repuesto",
    slug: "repuesto",
    descripcion: "Categoria base para repuestos.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000004",
    nombre: "Herramienta",
    slug: "herramienta",
    descripcion: "Categoria base para herramientas.",
    estado: true,
  },
  {
    id_categoria_material: "CMA00000005",
    nombre: "Otro",
    slug: "otro",
    descripcion: "Categoria base para otros materiales.",
    estado: true,
  },
];

const supplierTypes = [
  {
    id_tipo_proveedor: "TPR00000001",
    nombre: "Materia prima",
    slug: "materia_prima",
    descripcion: "Tipo base para proveedores de materia prima.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000002",
    nombre: "Consumibles",
    slug: "consumibles",
    descripcion: "Tipo base para proveedores de consumibles.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000003",
    nombre: "Repuestos",
    slug: "repuestos",
    descripcion: "Tipo base para proveedores de repuestos.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000004",
    nombre: "Servicios",
    slug: "servicios",
    descripcion: "Tipo base para proveedores de servicios.",
    estado: true,
  },
  {
    id_tipo_proveedor: "TPR00000005",
    nombre: "Otros",
    slug: "otros",
    descripcion: "Tipo base para otros proveedores.",
    estado: true,
  },
];

const correlatives = [
  {
    codigo_entidad: "usuario",
    prefijo: "USU",
    descripcion: "Correlativo transaccional para usuario (prefijo USU).",
  },
  {
    codigo_entidad: "movimiento_inventario",
    prefijo: "MVI",
    descripcion: "Correlativo transaccional para movimiento_inventario (prefijo MVI).",
  },
  {
    codigo_entidad: "bitacora_operacion",
    prefijo: "BIT",
    descripcion: "Correlativo transaccional para bitacora_operacion (prefijo BIT).",
  },
  {
    codigo_entidad: "cliente",
    prefijo: "CLI",
    descripcion: "Correlativo transaccional para cliente (prefijo CLI).",
  },
  {
    codigo_entidad: "producto",
    prefijo: "PRO",
    descripcion: "Correlativo transaccional para producto (prefijo PRO).",
  },
  {
    codigo_entidad: "categoria_producto",
    prefijo: "CPR",
    ultimo_numero: productCategories.length,
    descripcion: "Correlativo transaccional para categoria_producto (prefijo CPR).",
  },
  {
    codigo_entidad: "pedido",
    prefijo: "PED",
    descripcion: "Correlativo transaccional para pedido (prefijo PED).",
  },
  {
    codigo_entidad: "detalle_pedido",
    prefijo: "DPE",
    descripcion: "Correlativo transaccional para detalle_pedido (prefijo DPE).",
  },
  {
    codigo_entidad: "proforma",
    prefijo: "PRF",
    descripcion: "Correlativo transaccional para proforma (prefijo PRF).",
  },
  {
    codigo_entidad: "pago_cliente",
    prefijo: "PCL",
    descripcion: "Correlativo transaccional para pago_cliente (prefijo PCL).",
  },
  {
    codigo_entidad: "comprobante_venta",
    prefijo: "CMP",
    descripcion: "Correlativo transaccional para comprobante_venta (prefijo CMP).",
  },
  {
    codigo_entidad: "material",
    prefijo: "MAT",
    descripcion: "Correlativo transaccional para material (prefijo MAT).",
  },
  {
    codigo_entidad: "categoria_material",
    prefijo: "CMA",
    ultimo_numero: materialCategories.length,
    descripcion: "Correlativo transaccional para categoria_material (prefijo CMA).",
  },
  {
    codigo_entidad: "proveedor",
    prefijo: "PVE",
    descripcion: "Correlativo transaccional para proveedor (prefijo PVE).",
  },
  {
    codigo_entidad: "tipo_proveedor_catalogo",
    prefijo: "TPR",
    ultimo_numero: supplierTypes.length,
    descripcion: "Correlativo transaccional para tipo_proveedor_catalogo (prefijo TPR).",
  },
  {
    codigo_entidad: "proveedor_material",
    prefijo: "PVM",
    descripcion: "Correlativo transaccional para proveedor_material (prefijo PVM).",
  },
  {
    codigo_entidad: "compra",
    prefijo: "COM",
    descripcion: "Correlativo transaccional para compra (prefijo COM).",
  },
  {
    codigo_entidad: "detalle_compra",
    prefijo: "DCO",
    descripcion: "Correlativo transaccional para detalle_compra (prefijo DCO).",
  },
  {
    codigo_entidad: "historial_precio_proveedor",
    prefijo: "HPP",
    descripcion: "Correlativo transaccional para historial_precio_proveedor (prefijo HPP).",
  },
  {
    codigo_entidad: "pago_proveedor",
    prefijo: "PPR",
    descripcion: "Correlativo transaccional para pago_proveedor (prefijo PPR).",
  },
  {
    codigo_entidad: "alerta_stock",
    prefijo: "ALE",
    descripcion: "Correlativo transaccional para alerta_stock (prefijo ALE).",
  },
  {
    codigo_entidad: "ruta_fabricacion",
    prefijo: "RUT",
    descripcion: "Correlativo transaccional para ruta_fabricacion (prefijo RUT).",
  },
  {
    codigo_entidad: "etapa_ruta",
    prefijo: "ETA",
    descripcion: "Correlativo transaccional para etapa_ruta (prefijo ETA).",
  },
  {
    codigo_entidad: "etapa_ruta_maquina",
    prefijo: "ERM",
    descripcion:
      "Correlativo transaccional para etapa_ruta_maquina (prefijo ERM).",
  },
  {
    codigo_entidad: "receta_tecnica",
    prefijo: "REC",
    descripcion: "Correlativo transaccional para receta_tecnica (prefijo REC).",
  },
  {
    codigo_entidad: "version_receta",
    prefijo: "VER",
    descripcion: "Correlativo transaccional para version_receta (prefijo VER).",
  },
  {
    codigo_entidad: "detalle_receta",
    prefijo: "DRE",
    descripcion: "Correlativo transaccional para detalle_receta (prefijo DRE).",
  },
  {
    codigo_entidad: "orden_trabajo",
    prefijo: "OTR",
    descripcion: "Correlativo transaccional para orden_trabajo (prefijo OTR).",
  },
  {
    codigo_entidad: "avance_orden",
    prefijo: "AVN",
    descripcion: "Correlativo transaccional para avance_orden (prefijo AVN).",
  },
  {
    codigo_entidad: "campania_produccion",
    prefijo: "CAM",
    descripcion: "Correlativo transaccional para campania_produccion (prefijo CAM).",
  },
  {
    codigo_entidad: "campania_detalle",
    prefijo: "CPD",
    descripcion: "Correlativo transaccional para campania_detalle (prefijo CPD).",
  },
  {
    codigo_entidad: "reasignacion_tarea",
    prefijo: "REA",
    descripcion: "Correlativo transaccional para reasignacion_tarea (prefijo REA).",
  },
  {
    codigo_entidad: "costeo",
    prefijo: "COS",
    descripcion: "Correlativo transaccional para costeo (prefijo COS).",
  },
  {
    codigo_entidad: "costo_indirecto",
    prefijo: "CIN",
    descripcion: "Correlativo transaccional para costo_indirecto (prefijo CIN).",
  },
  {
    codigo_entidad: "margen_ganancia",
    prefijo: "MGN",
    descripcion: "Correlativo transaccional para margen_ganancia (prefijo MGN).",
  },
  {
    codigo_entidad: "rentabilidad",
    prefijo: "REN",
    descripcion: "Correlativo transaccional para rentabilidad (prefijo REN).",
  },
  {
    codigo_entidad: "caja_chica",
    prefijo: "CAJ",
    descripcion: "Correlativo transaccional para caja_chica (prefijo CAJ).",
  },
  {
    codigo_entidad: "categoria_gasto",
    prefijo: "CGA",
    descripcion: "Correlativo transaccional para categoria_gasto (prefijo CGA).",
  },
  {
    codigo_entidad: "movimiento_caja",
    prefijo: "MCA",
    descripcion: "Correlativo transaccional para movimiento_caja (prefijo MCA).",
  },
  {
    codigo_entidad: "operario",
    prefijo: "OPE",
    descripcion: "Correlativo transaccional para operario (prefijo OPE).",
  },
  {
    codigo_entidad: "asistencia",
    prefijo: "ASI",
    descripcion: "Correlativo transaccional para asistencia (prefijo ASI).",
  },
  {
    codigo_entidad: "planilla_pago",
    prefijo: "PLA",
    descripcion: "Correlativo transaccional para planilla_pago (prefijo PLA).",
  },
  {
    codigo_entidad: "historial_pago_operario",
    prefijo: "HPO",
    descripcion: "Correlativo transaccional para historial_pago_operario (prefijo HPO).",
  },
  {
    codigo_entidad: "tarea_operario",
    prefijo: "TAR",
    descripcion: "Correlativo transaccional para tarea_operario (prefijo TAR).",
  },
  {
    codigo_entidad: "maquina",
    prefijo: "MAQ",
    descripcion: "Correlativo transaccional para maquina (prefijo MAQ).",
  },
  {
    codigo_entidad: "falla_maquina",
    prefijo: "FAL",
    descripcion: "Correlativo transaccional para falla_maquina (prefijo FAL).",
  },
  {
    codigo_entidad: "mantenimiento_preventivo",
    prefijo: "MTP",
    descripcion: "Correlativo transaccional para mantenimiento_preventivo (prefijo MTP).",
  },
  {
    codigo_entidad: "reparacion",
    prefijo: "RPA",
    descripcion: "Correlativo transaccional para reparacion (prefijo RPA).",
  },
  {
    codigo_entidad: "detalle_repuesto_reparacion",
    prefijo: "DRP",
    descripcion: "Correlativo transaccional para detalle_repuesto_reparacion (prefijo DRP).",
  },
  {
    codigo_entidad: "repuesto",
    prefijo: "REP",
    descripcion: "Correlativo transaccional para repuesto (prefijo REP).",
  },
  {
    codigo_entidad: "chatarra",
    prefijo: "CHA",
    descripcion: "Correlativo transaccional para chatarra (prefijo CHA).",
  },
  {
    codigo_entidad: "retazo_reutilizable",
    prefijo: "RET",
    descripcion: "Correlativo transaccional para retazo_reutilizable (prefijo RET).",
  },
  {
    codigo_entidad: "venta_chatarra",
    prefijo: "VCH",
    descripcion: "Correlativo transaccional para venta_chatarra (prefijo VCH).",
  },
  {
    codigo_entidad: "exportacion_datos",
    prefijo: "EXP",
    descripcion: "Correlativo transaccional para exportacion_datos (prefijo EXP).",
  },
];

async function main() {
  console.log("Iniciando seed oficial de Aceros Perú...");

  console.log("Creando roles...");

  for (const role of roles) {
    await prisma.rol.upsert({
      where: {
        id_rol: role.id_rol,
      },
      update: {
        nombre_rol: role.nombre_rol,
        descripcion: role.descripcion,
        estado: role.estado,
      },
      create: role,
    });

    console.log(`Rol creado/actualizado: ${role.nombre_rol}`);
  }

  console.log("Creando categorias base de productos...");

  for (const category of productCategories) {
    await prisma.categoria_producto.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        nombre: category.nombre,
        descripcion: category.descripcion,
        estado: category.estado,
      },
      create: category,
    });

    console.log(`Categoria de producto creada/actualizada: ${category.nombre}`);
  }

  console.log("Creando categorias base de materiales...");

  for (const category of materialCategories) {
    await prisma.categoria_material.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        nombre: category.nombre,
        descripcion: category.descripcion,
        estado: category.estado,
      },
      create: category,
    });

    console.log(`Categoria de material creada/actualizada: ${category.nombre}`);
  }

  console.log("Creando tipos base de proveedor...");

  for (const supplierType of supplierTypes) {
    await prisma.tipo_proveedor_catalogo.upsert({
      where: {
        slug: supplierType.slug,
      },
      update: {
        nombre: supplierType.nombre,
        descripcion: supplierType.descripcion,
        estado: supplierType.estado,
      },
      create: supplierType,
    });

    console.log(`Tipo de proveedor creado/actualizado: ${supplierType.nombre}`);
  }

  console.log("Creando correlativos base del sistema...");

  for (const correlative of correlatives) {
    await prisma.correlativo_sistema.upsert({
      where: {
        codigo_entidad: correlative.codigo_entidad,
      },
      update: {
        prefijo: correlative.prefijo,
        descripcion: correlative.descripcion,
      },
      create: correlative,
    });

    console.log(`Correlativo creado/actualizado: ${correlative.codigo_entidad}`);
  }

  console.log("Seed oficial completado correctamente.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
