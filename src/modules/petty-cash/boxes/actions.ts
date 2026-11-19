"use server";

import { revalidatePath } from "next/cache";

import { newOperationId, type FormActionState } from "@/lib/action-result";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { APP_ROLES } from "@/lib/permissions";
import { pettyCashBoxSchema } from "@/schemas/petty-cash/petty-cash-box.schema";

/** Lo que el formulario de apertura envio, para volver a mostrarlo. */
export type PettyCashBoxFormValues = {
  nombre_caja: string;
  saldo_inicial: string;
  fecha_apertura: string;
  responsable: string;
  observaciones: string;
};

// C7 de la 11.4a (D46): abrir caja devuelve el resultado y el formulario da el aviso y vuelve al
// listado de cajas. Un error queda en el formulario, junto a su campo (el nombre repetido en el
// nombre), en lugar de la pagina de error; sin permiso responde con un error. Sin clave de
// operacion: no mueve dinero de otra caja, y un reenvio choca con el nombre que ya guardo.
export type PettyCashBoxFormState = FormActionState<PettyCashBoxFormValues, { id_caja_chica: string }>;

const DUPLICATE_NAME_MESSAGE = "Ya existe una caja chica con ese nombre.";

// El nombre ya existe: se lanza desde la transaccion de la apertura para revertirla, y con ella la
// reserva del correlativo (C1 del grupo de fixes). No se exporta: un archivo "use server" solo
// exporta acciones.
class DuplicateBoxNameError extends Error {
  constructor() {
    super(DUPLICATE_NAME_MESSAGE);
  }
}

function getBoxFormValues(formData: FormData): PettyCashBoxFormValues {
  const text = (name: keyof PettyCashBoxFormValues) => formData.get(name)?.toString() ?? "";

  return {
    nombre_caja: text("nombre_caja"),
    saldo_inicial: text("saldo_inicial"),
    fecha_apertura: text("fecha_apertura"),
    responsable: text("responsable"),
    observaciones: text("observaciones"),
  };
}

export async function createPettyCashBoxAction(
  _prevState: PettyCashBoxFormState,
  formData: FormData,
): Promise<PettyCashBoxFormState> {
  const values = getBoxFormValues(formData);
  const fail = (error: string, fieldErrors?: FieldErrors): PettyCashBoxFormState => ({
    status: "error",
    error,
    fieldErrors,
    values,
    operationId: newOperationId(),
  });

  const session = await getAuthorizedSession([APP_ROLES.ADMIN]);

  if (!session) {
    return fail("No tienes permisos para abrir cajas chicas.");
  }

  const parsedData = pettyCashBoxSchema.safeParse(values);

  if (!parsedData.success) {
    return fail("Revisa los datos de la caja.", parsedData.error.flatten().fieldErrors);
  }

  const data = parsedData.data;
  const boxName = data.nombre_caja.trim();

  // C1 del grupo de fixes (D123, hallazgo 7 de la 11.4a): el nombre se busca dentro de la
  // transaccion, despues de reservar el correlativo de caja. No hay fila que bloquear para un nombre
  // nuevo ni un indice unico sin distinguir mayusculas (seria una migracion), pero la reserva bloquea
  // la fila del contador (FOR UPDATE) hasta el final: dos aperturas no corren a la vez, y la segunda
  // espera y ve la caja que creo la primera. Si el nombre ya existe, se lanza para revertir la
  // transaccion y la reserva: devolver desde el callback guardaria el contador avanzado y se
  // perderia un numero. Es el patron del alta rapida de proveedor (C1 de la 11.7d).
  let idCajaChica = "";

  try {
    await prisma.$transaction(async (tx) => {
      idCajaChica = await getNextCorrelativeId(tx, {
        codigoEntidad: "caja_chica",
        prefijo: "CAJ",
      });

      const existingBox = await tx.caja_chica.findFirst({
        where: {
          nombre_caja: {
            equals: boxName,
            mode: "insensitive",
          },
        },
        select: {
          id_caja_chica: true,
        },
      });

      if (existingBox) {
        throw new DuplicateBoxNameError();
      }

      await tx.caja_chica.create({
        data: {
          id_caja_chica: idCajaChica,
          nombre_caja: boxName,
          saldo_inicial: data.saldo_inicial,
          saldo_actual: data.saldo_inicial,
          fecha_apertura: data.fecha_apertura,
          estado: "abierta",
          responsable: data.responsable || null,
          observaciones: data.observaciones || null,
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateBoxNameError) {
      return fail(DUPLICATE_NAME_MESSAGE, { nombre_caja: [DUPLICATE_NAME_MESSAGE] });
    }

    throw error;
  }

  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/boxes");

  return {
    status: "success",
    data: { id_caja_chica: idCajaChica },
    values,
    operationId: newOperationId(),
  };
}
