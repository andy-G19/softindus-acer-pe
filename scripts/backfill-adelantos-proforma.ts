import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { getNextCorrelativeId } from "@/lib/correlatives-core";

// Script manual y excepcional: repara los adelantos iniciales de proformas
// creadas ANTES de que createQuoteAction registrara el adelanto como un
// pago_cliente real. Esas proformas descontaron el adelanto del saldo pero
// nunca dejaron la fila de pago, asi que el adelanto no aparece en el
// historial de pagos y no bloquea la anulacion de una proforma ya cobrada.
//
// No importa "@/lib/db" ni "@/lib/correlatives": esos modulos dependen del
// paquete "server-only", que solo resuelve dentro del bundler de Next.js.
// Se reutiliza correlatives-core, la MISMA implementacion que usa la app.
//
// Es idempotente: detecta si el adelanto ya esta representado como pago
// comparando monto_total - suma(pagos) - saldo contra adelanto_inicial. Si
// esa diferencia ya es cero, la proforma esta sana y se omite.
//
// Uso:
//   npx tsx scripts/backfill-adelantos-proforma.ts           (simulacion)
//   npx tsx scripts/backfill-adelantos-proforma.ts --apply   (escribe)

const APPLY_FLAG = "--apply";
const TOLERANCE = 0.01;

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
    const quotes = await prisma.proforma.findMany({
      where: {
        adelanto_inicial: {
          gt: 0,
        },
      },
      select: {
        id_proforma: true,
        id_pedido: true,
        numero_proforma: true,
        fecha_emision: true,
        monto_total: true,
        adelanto_inicial: true,
        saldo: true,
        pedido: {
          select: {
            id_usuario_registro: true,
          },
        },
        pago_cliente: {
          select: {
            monto_pagado: true,
          },
        },
      },
      orderBy: {
        id_proforma: "asc",
      },
    });

    const pending = quotes.filter((quote) => {
      const advance = toNumber(quote.adelanto_inicial);
      const paid = quote.pago_cliente.reduce((total, payment) => {
        return total + toNumber(payment.monto_pagado);
      }, 0);

      // Hueco = lo que la proforma da por cobrado pero no esta respaldado por
      // ninguna fila de pago. Si coincide con el adelanto, falta registrarlo.
      const gap = toNumber(quote.monto_total) - paid - toNumber(quote.saldo);

      return Math.abs(gap - advance) < TOLERANCE && advance > 0;
    });

    console.log(
      `Proformas con adelanto: ${quotes.length}. Sin pago registrado: ${pending.length}.`,
    );

    if (pending.length === 0) {
      console.log("No hay nada que reparar.");
      return;
    }

    for (const quote of pending) {
      const advance = toNumber(quote.adelanto_inicial);
      // Saldo historico inmediatamente despues del adelanto, no el saldo de
      // hoy: los pagos posteriores ya tienen su propia fila con su saldo.
      const balanceAfterAdvance = Number(
        (toNumber(quote.monto_total) - advance).toFixed(2),
      );

      console.log(
        `${quote.numero_proforma} (${quote.id_proforma}): adelanto S/ ${advance.toFixed(
          2,
        )}, saldo tras adelanto S/ ${balanceAfterAdvance.toFixed(2)}`,
      );

      if (!shouldApply) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const idPagoCliente = await getNextCorrelativeId(tx, {
          codigoEntidad: "pago_cliente",
          prefijo: "PCL",
        });

        await tx.pago_cliente.create({
          data: {
            id_pago_cliente: idPagoCliente,
            id_proforma: quote.id_proforma,
            id_pedido: quote.id_pedido,
            // Se atribuye al usuario que registro el pedido: es el dato real
            // mas cercano disponible, no se inventa un usuario del sistema.
            id_usuario_registro: quote.pedido.id_usuario_registro,
            fecha_pago: quote.fecha_emision,
            monto_pagado: advance,
            metodo_pago: "otro",
            tipo_pago: balanceAfterAdvance <= 0 ? "cancelacion" : "adelanto",
            saldo_actual: balanceAfterAdvance,
            observaciones:
              "Adelanto inicial regularizado: la proforma se creo antes de que el adelanto se registrara como pago.",
          },
        });
      });

      console.log(`  -> pago registrado.`);
    }

    if (!shouldApply) {
      console.log(
        `\nSimulacion. Nada fue escrito. Vuelva a ejecutar con ${APPLY_FLAG} para aplicar.`,
      );
    } else {
      console.log(`\nListo: ${pending.length} adelanto(s) regularizado(s).`);
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "No se pudo completar el backfill de adelantos.",
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
