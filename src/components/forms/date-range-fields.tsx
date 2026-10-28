"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { DATE_RANGE_INVERTED_MESSAGE, isDateRangeInverted, toDateInputValue } from "@/lib/date-range";
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
// Dentro de FilterBar ocupa dos columnas si la barra tiene sitio. Un valor de
// la URL que no es una fecha "aaaa-mm-dd" que existe empieza vacio, como lo
// muestra el navegador, y no cuenta para el rango (entrega 10.2). Next no
// vuelve a montar la pagina cuando la URL cambia con next/link (Limpiar,
// Atras, Adelante): si cambian las fechas de la URL, los campos las toman; si
// no cambian, conservan lo que eligio el usuario. Lo que el usuario elige antes
// de que React hidrate la pagina solo cambia el DOM: al montar, los campos
// leen su valor y lo pasan al estado; si no, el siguiente render lo borraba y
// el rango no se validaba (D7 de la 10.4).
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
  const [urlRange, setUrlRange] = useState({ from: defaultFrom, to: defaultTo });
  const [from, setFrom] = useState(() => toDateInputValue(defaultFrom));
  const [to, setTo] = useState(() => toDateInputValue(defaultTo));

  // Patron de React para ajustar el estado cuando cambia una prop: durante el
  // render, sin efecto, para no pintar antes las fechas anteriores.
  if (urlRange.from !== defaultFrom || urlRange.to !== defaultTo) {
    setUrlRange({ from: defaultFrom, to: defaultTo });
    setFrom(toDateInputValue(defaultFrom));
    setTo(toDateInputValue(defaultTo));
  }

  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const inverted = isDateRangeInverted(from, to);

  // Hidratar no pisa el valor del DOM, pero el estado sigue con el de la URL.
  // React deja en defaultValue el valor que pinto: si el campo muestra otro, lo
  // eligio el usuario. Solo se actualiza si difiere: una actualizacion que no
  // cambia nada quedaba en la cola y volvia a poner esa fecha despues de que
  // la URL cambiara.
  useLayoutEffect(() => {
    const fromInput = fromRef.current;
    const toInput = toRef.current;

    if (fromInput && fromInput.value !== fromInput.defaultValue) {
      setFrom(fromInput.value);
    }

    if (toInput && toInput.value !== toInput.defaultValue) {
      setTo(toInput.value);
    }
  }, []);

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
            ref={fromRef}
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
