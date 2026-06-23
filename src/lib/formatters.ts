export function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value.toString());

  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return `S/ ${numericValue.toFixed(2)}`;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

export function formatDecimal(value: unknown, decimals = 2) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value.toString());

  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return numericValue.toFixed(decimals);
}

// Este archivo sirve para centralizar funciones de formateo comunes en toda la aplicación,
//  como formateo de dinero, fechas, etc. De esta manera, evitamos duplicar código y
//  mantenemos un estilo consistente en toda la app.