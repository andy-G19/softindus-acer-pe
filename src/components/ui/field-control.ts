/**
 * Aspecto comun de los campos (Input, NativeSelect, Textarea y la busqueda de
 * SearchableSelect), segun la propuesta del responsable (2026-11-19):
 * - reposo: tarjeta con textura de metal cepillado y borde de acero (3:1);
 * - foco: borde naranja y el anillo con hueco de los botones;
 * - error: borde y anillo rojos, sin halo en reposo;
 * - deshabilitado: sin textura, fondo apagado y texto atenuado;
 * - transicion de --motion-base, ninguna con reducir movimiento.
 * La altura y el relleno los pone cada componente: se conservan los de antes.
 * El hover es un hover simple a proposito: la regla de hover del login, en
 * brand.css, va despues y debe seguir ganando.
 */
export const fieldControlClassName = [
  "border border-control-border bg-card bg-(image:--texture-metal) text-foreground outline-none",
  "transition-[color,background-color,border-color,box-shadow] duration-(--motion-base) ease-out motion-reduce:transition-none",
  "hover:border-control-border-hover",
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "aria-invalid:border-destructive-outline aria-invalid:focus-visible:border-destructive-outline aria-invalid:focus-visible:ring-destructive-outline",
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:bg-none disabled:text-muted-foreground disabled:opacity-65",
].join(" ");

/** Solo lectura: el dato esta fijado, no deshabilitado; borde y anillo de acero. */
export const readOnlyFieldClassName =
  "[&[readonly]]:cursor-default [&[readonly]]:border-readonly-border [&[readonly]]:focus-visible:border-accent-steel [&[readonly]]:focus-visible:ring-accent-steel";
