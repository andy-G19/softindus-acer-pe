import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { getNextCorrelativeIds } from "@/lib/correlatives-core";
import { calculateRequiredQuantityRounded } from "@/lib/recipe-quantities";

// Script manual: congela el requerimiento de materiales de las ordenes de trabajo que se
// crearon ANTES de que createWorkOrderAction generara el snapshot.
//
// No importa "@/lib/db" ni "@/lib/correlatives": dependen del paquete "server-only", que
// solo resuelve dentro del bundler de Next.js. correlatives-core es la MISMA
// implementacion, y recipe-quantities es la MISMA formula que usa la app.
//
// ALCANCE DELIBERADO: solo ordenes que no esten finalizadas ni anuladas.
//
// El backfill reconstruye desde la receta de HOY, no desde la que realmente se uso el dia
// que se creo la orden. En una orden cerrada eso seria congelar un dato posiblemente
// falso, sin forma de contrastarlo. En una orden activa el dato sigue siendo el vigente y
// ademas es el que la fase D va a usar para entregar material.
//
// Es idempotente: omite las ordenes que ya tienen requerimiento.
//
// Uso:
//   npx tsx scripts/backfill-requerimientos-orden.ts           (simulacion)
//   npx tsx scripts/backfill-requerimientos-orden.ts --apply   (escribe)

const APPLY_FLAG = "--apply";
const ESTADOS_EXCLUIDOS = ["finalizada", "anulada"];

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value.toString());

  return Number.isNaN(parsed) ? 0 : parsed;
}

async function main() {
  const shouldApply = process.argv.includes(APPLY_FLAG);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL no esta definida en el entorno.");
    process.exitCode = 1;
    return;
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const ordenes = await prisma.orden_trabajo.findMany({
      where: {
        estado: { notIn: ESTADOS_EXCLUIDOS },
        requerimiento_orden_material: { none: {} },
      },
      include: {
        producto: { select: { nombre_producto: true } },
        version_receta: {
          include: {
            detalle_receta: {
              include: {
                material: {
                  select: {
                    id_material: true,
                    nombre_material: true,
                    costo_unitario_actual: true,
                  },
                },
              },
              orderBy: { id_detalle_receta: "asc" },
            },
          },
        },
        movimiento_inventario: {
          where: { tipo_movimiento: "salida" },
          select: { id_material: true, cantidad: true },
        },
      },
      orderBy: { id_orden_trabajo: "asc" },
    });

    const totalActivas = await prisma.orden_trabajo.count({
      where: { estado: { notIn: ESTADOS_EXCLUIDOS } },
    });

    console.log(
      `Ordenes activas: ${totalActivas}. Sin requerimiento congelado: ${ordenes.length}.\n`,
    );

    if (ordenes.length === 0) {
      console.log("No hay nada que congelar.");
      return;
    }

    const sinReceta: string[] = [];

    for (const orden of ordenes) {
      console.log(
        `${orden.id_orden_trabajo} [${orden.estado}] · ${orden.producto.nombre_producto} · cantidad ${orden.cantidad.toString()}`,
      );

      if (!orden.version_receta || orden.version_receta.detalle_receta.length === 0) {
        console.log("   SIN RECETA O SIN MATERIALES: se omite.\n");
        sinReceta.push(orden.id_orden_trabajo);
        continue;
      }

      // Lo ya entregado se deduce de las salidas de inventario existentes. Sin esto, la
      // fase D veria la orden como "nunca se entrego nada" y permitiria entregar de
      // nuevo, descontando stock dos veces.
      const entregadoPorMaterial = new Map<string, number>();

      for (const movimiento of orden.movimiento_inventario) {
        entregadoPorMaterial.set(
          movimiento.id_material,
          (entregadoPorMaterial.get(movimiento.id_material) ?? 0) +
            toNumber(movimiento.cantidad),
        );
      }

      const filas = orden.version_receta.detalle_receta.map((detalle) => {
        const requerida = calculateRequiredQuantityRounded({
          quantityPerUnit: detalle.cantidad_requerida,
          wastePercentage: detalle.merma_estimada_porcentaje,
          orderQuantity: orden.cantidad,
        });

        const entregada = entregadoPorMaterial.get(detalle.id_material) ?? 0;

        return { detalle, requerida, entregada };
      });

      for (const fila of filas) {
        const marcaEntrega =
          fila.entregada > 0
            ? ` | ya entregado: ${fila.entregada.toFixed(2)}`
            : "";

        console.log(
          `   - ${fila.detalle.material.nombre_material}: ${fila.detalle.cantidad_requerida.toString()} x ${orden.cantidad.toString()} + ${fila.detalle.merma_estimada_porcentaje?.toString() ?? "0"}% = ${fila.requerida.toFixed(2)} ${fila.detalle.unidad_medida} | costo ${fila.detalle.material.costo_unitario_actual.toString()}${marcaEntrega}`,
        );
      }

      if (!shouldApply) {
        console.log("");
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const ids = await getNextCorrelativeIds(tx, {
          codigoEntidad: "requerimiento_orden_material",
          prefijo: "ROM",
          cantidad: filas.length,
        });

        await tx.requerimiento_orden_material.createMany({
          data: filas.map((fila, index) => ({
            id_requerimiento: ids[index],
            id_orden_trabajo: orden.id_orden_trabajo,
            id_material: fila.detalle.id_material,
            cantidad_por_unidad: fila.detalle.cantidad_requerida,
            merma_estimada_porcentaje: fila.detalle.merma_estimada_porcentaje,
            unidad_medida: fila.detalle.unidad_medida,
            tipo_consumo: fila.detalle.tipo_consumo,
            costo_unitario_registrado:
              fila.detalle.material.costo_unitario_actual,
            cantidad_requerida: fila.requerida,
            cantidad_entregada: fila.entregada,
          })),
        });
      });

      console.log(`   -> congelado (${filas.length} material(es)).\n`);
    }

    if (sinReceta.length > 0) {
      console.log(
        `\nOmitidas por no tener receta con materiales: ${sinReceta.join(", ")}`,
      );
    }

    if (!shouldApply) {
      console.log(
        `\nSimulacion. Nada fue escrito. Revise que las cantidades coincidan con lo que muestra hoy la pantalla de cada orden; si difieren, la receta cambio bajo esa orden y conviene entenderlo antes de congelar.\nVuelva a ejecutar con ${APPLY_FLAG} para aplicar.`,
      );
    } else {
      console.log("\nListo.");
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "No se pudo completar el backfill de requerimientos.",
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
