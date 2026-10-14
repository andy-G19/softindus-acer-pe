"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { DATE_RANGE_INVERTED_MESSAGE, isDateRangeInverted } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangeFieldsProps = {
  /** Base de los id ("filtro-fecha" da "filtro-fecha-desde" y "filtro-fecha-hasta"). */
  id?: string;
  /** Nombre del grupo para el lector de pantalla. */
  legend?: string;
  /** Parametros de la URL: from/to, dateFrom/dateTo en reportes, desde/hasta en caja chica. */
  fromName?: string;
  toName?: string;
  fromLabel?: string;
  toLabel?: string;
  /** Valores que llegan en la URL ("aaaa-mm-dd"). */
  defaultFrom?: string;
  defaultTo?: string;
  className?: string;
};

// Rango de fechas de un filtro (entrega 8). Si "Desde" es posterior a "Hasta",
// muestra bajo "Hasta" el mismo mensaje que la ruta de exportacion y el
// navegador no envia el formulario (setCustomValidity). "Hasta" lleva min para
// que el selector no ofrezca fechas anteriores; "Desde" no lleva max, porque
// el navegador lo marcaria invalido con su mensaje generico en lugar de este.
// Dentro de FilterBar ocupa dos columnas si la barra tiene sitio.
export function DateRangeFields({
  id,
  legend = "Rango de fechas",
  fromName = "from",
  toName = "to",
  fromLabel = "Desde",
  toLabel = "Hasta",
  defaultFrom = "",
  defaultTo = "",
  className,
}: DateRangeFieldsProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const toRef = useRef<HTMLInputElement>(null);
  const inverted = isDateRangeInverted(from, to);

  useEffect(() => {
    toRef.current?.setCustomValidity(inverted ? DATE_RANGE_INVERTED_MESSAGE : "");
  }, [inverted]);

  return (
    <fieldset className={cn("grid min-w-0 gap-3 @md:col-span-2 @md:grid-cols-2", className)}>
      <legend className="sr-only">{legend}</legend>
      <Field id={`${baseId}-desde`} label={fromLabel}>
        {(control) => (
          <Input
            {...control}
            type="date"
            name={fromName}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        )}
      </Field>
      <Field
        id={`${baseId}-hasta`}
        label={toLabel}
        errors={inverted ? [DATE_RANGE_INVERTED_MESSAGE] : undefined}
      >
        {(control) => (
          <Input
            {...control}
            ref={toRef}
            type="date"
            name={toName}
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        )}
      </Field>
    </fieldset>
  );
}
