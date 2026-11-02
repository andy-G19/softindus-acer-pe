import { Alert, AlertDescription } from "@/components/ui/alert";
import { hasUnitDrift } from "@/modules/production/recipe-details/recipe-detail-rules";

// Avisos del alta y la edicion de lineas de receta (entrega 10.6b). Viven aparte
// porque la pagina y el panel leen lo mismo y deben mostrar lo mismo; el formulario
// los recibe y los pone dentro de su cuerpo desplazable.

type VersionForNotices = {
  estado: string;
  receta_tecnica: { estado: string };
  _count: { orden_trabajo: number };
};

type NewRecipeDetailNoticesProps = {
  version: VersionForNotices;
  hasMaterials: boolean;
};

export function NewRecipeDetailNotices({ version, hasMaterials }: NewRecipeDetailNoticesProps) {
  return (
    <>
      {version.estado !== "vigente" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión no está vigente. Solo se pueden agregar materiales a una versión vigente.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.receta_tecnica.estado !== "activa" ? (
        <Alert variant="warning">
          <AlertDescription>Esta receta no está activa. Actívala antes de agregar materiales.</AlertDescription>
        </Alert>
      ) : null}

      {!hasMaterials ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay materiales activos disponibles o todos los materiales activos ya fueron agregados a esta versión de
            receta.
          </AlertDescription>
        </Alert>
      ) : null}

      {version._count.orden_trabajo > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión ya fue usada por órdenes de trabajo. Crea una nueva versión para cambiar materiales sin afectar
            órdenes históricas.
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertDescription>
          La cantidad registrada representa el consumo estimado para fabricar
          <strong> una unidad</strong> del producto. Se multiplica por la cantidad de la orden al calcular los materiales
          requeridos.
        </AlertDescription>
      </Alert>
    </>
  );
}

type EditRecipeDetailNoticesProps = {
  version: VersionForNotices;
  detail: {
    unidad_medida: string;
    material: { unidad_medida: string };
  };
};

export function EditRecipeDetailNotices({ version, detail }: EditRecipeDetailNoticesProps) {
  return (
    <>
      {version._count.orden_trabajo > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión ya fue usada por órdenes de trabajo y no puede modificarse. Crea una nueva versión para cambiar
            materiales sin afectar órdenes históricas.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.estado !== "vigente" ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta versión no está vigente. Solo se pueden editar materiales de una versión vigente.
          </AlertDescription>
        </Alert>
      ) : null}

      {version.receta_tecnica.estado !== "activa" ? (
        <Alert variant="warning">
          <AlertDescription>Esta receta no está activa. Actívala antes de editar materiales.</AlertDescription>
        </Alert>
      ) : null}

      {hasUnitDrift(detail.unidad_medida, detail.material.unidad_medida) ? (
        <Alert variant="warning">
          <AlertDescription>
            Esta línea está registrada en <strong>{detail.unidad_medida}</strong> y el material hoy se mide en{" "}
            <strong>{detail.material.unidad_medida}</strong>. Al guardar, la unidad se actualizará a la del material:
            revisa que la cantidad siga siendo correcta en esa unidad.
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
