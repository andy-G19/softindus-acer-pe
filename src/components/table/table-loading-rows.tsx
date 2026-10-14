import { LoadingState } from "@/components/ui/loading-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type TableLoadingRowsProps = {
  /** Columnas de la tabla: una celda con un bloque por columna. */
  columns: number;
  rows?: number;
  /** Lo que anuncia el lector de pantalla: "Cargando clientes...". */
  label?: string;
};

// Filas de carga de una tabla (entrega 8): van dentro del TableBody mientras
// llegan los datos. Los bloques son decorativos; el anuncio es un LoadingState
// oculto a la vista dentro de la primera celda, porque un role="status" en una
// fila rompería la estructura de la tabla.
export function TableLoadingRows({ columns, rows = 5, label = "Cargando..." }: TableLoadingRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} data-slot="table-loading-row">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              {row === 0 && column === 0 ? (
                <LoadingState variant="inline" label={label} className="sr-only" />
              ) : null}
              <Skeleton className={column === 0 ? "h-4 w-24" : "h-4 w-full max-w-40"} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
