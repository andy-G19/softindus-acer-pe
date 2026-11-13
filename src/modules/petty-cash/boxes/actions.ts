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

  // C7 de la 11.4a: el nombre repetido se comprueba dentro de la transaccion que crea la caja, y
  // el rechazo se devuelve desde ella antes de escribir nada. No hay fila que bloquear para un
  // nombre nuevo ni un indice unico sin distinguir mayusculas (seria una migracion): dos aperturas
  // simultaneas con el mismo nombre todavia pueden pasar las dos.
  const result = await prisma.$transaction(async (tx) => {
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
      return { duplicated: true as const };
    }

    const idCajaChica = await getNextCorrelativeId(tx, {
      codigoEntidad: "caja_chica",
      prefijo: "CAJ",
    });

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

    return { duplicated: false as const, idCajaChica };
  });

  if (result.duplicated) {
    return fail(DUPLICATE_NAME_MESSAGE, { nombre_caja: [DUPLICATE_NAME_MESSAGE] });
  }

  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/boxes");

  return {
    status: "success",
    data: { id_caja_chica: result.idCajaChica },
    values,
    operationId: newOperationId(),
  };
}
