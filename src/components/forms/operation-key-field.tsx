"use client";

import { useEffect, useRef } from "react";

/** Nombre del campo que lee la accion y valida su esquema. */
export const OPERATION_KEY_FIELD = "clave_operacion";

const STORAGE_PREFIX = "clave-operacion:";

function readStoredKey(storageKey: string) {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function storeKey(storageKey: string, value: string) {
  try {
    sessionStorage.setItem(storageKey, value);
  } catch {
    // Sin sessionStorage (bloqueado, modo privado estricto) la clave vale por montaje.
  }
}

type OperationKeyFieldProps = {
  /** Operacion y registro, por ejemplo "pago_proveedor:COM00000003". */
  scope: string;
  /** La clave que el servidor confirmo como terminada en la ultima respuesta. */
  completedKey?: string;
};

// Clave de idempotencia de un formulario (11.2a, D12 opcion B). La accion la
// reclama en operacion_idempotente (src/lib/idempotency.ts) como primera
// sentencia de su transaccion.
//
// La clave se guarda en sessionStorage por operacion y registro, asi que
// recargar la pagina o remontar los campos tras un error la conserva: si la
// operacion anterior si se guardo y su respuesta se perdio, reenviar responde
// con lo guardado en lugar de repetirla; si no se guardo, la transaccion
// fallida libero la clave y vale de nuevo. Solo cambia cuando la respuesta
// confirma la operacion con esa misma clave (completedKey). sessionStorage es
// de la pestana: dos pestanas no comparten clave.
//
// Va dentro de ActionForm: cada respuesta remonta sus campos y el efecto vuelve
// a decidir. El valor se escribe tras montar, no en el render, para que el HTML
// del servidor y la hidratacion coincidan; un envio antes de hidratar llega sin
// clave y el esquema lo rechaza. El campo no lleva value ni defaultValue: en un
// input oculto el valor es el atributo, y React lo reescribia con cada render del
// formulario, borrando la clave (hallazgo de la 11.2b). No entra en la galeria:
// no pinta nada.
export function OperationKeyField({ scope, completedKey }: OperationKeyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storageKey = `${STORAGE_PREFIX}${scope}`;
    let key = readStoredKey(storageKey);

    if (!key || key === completedKey) {
      key = crypto.randomUUID();
      storeKey(storageKey, key);
    }

    if (inputRef.current) {
      inputRef.current.value = key;
    }
  }, [scope, completedKey]);

  return <input ref={inputRef} type="hidden" name={OPERATION_KEY_FIELD} />;
}
