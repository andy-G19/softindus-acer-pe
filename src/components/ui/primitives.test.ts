import { createElement as h, Fragment, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Info, Package, Plus, TriangleAlert, type LucideProps } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/commercial/status-badge";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field, FieldError, type FieldControlProps } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { SearchableSelectFilter } from "@/components/forms/searchable-select-filter";
import { BackButton } from "@/components/navigation/back-button";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { PageHeader } from "@/components/navigation/page-header";
import { PaginationControls } from "@/components/pagination-controls";
import {
  RowActions,
  RowEditLink,
  RowToggleStatusButton,
} from "@/components/table/row-actions";
import { TableLoadingRows } from "@/components/table/table-loading-rows";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getPaginationMeta } from "@/lib/pagination";

// Caracterizacion visual de las primitivas (entrega 8). A diferencia del arnes
// de paginas, que quita class, style y data-slot para fijar solo estructura y
// texto, aqui se fija el HTML completo, con sus clases: es lo que decide el
// aspecto. Cada variante, tamano y estado que usan las pantallas queda en el
// snapshot, de modo que un cambio de clases en la base visual aparece en el
// diff y se revisa a proposito. Los estilos que el navegador calcula a partir
// de esas clases se comprueban aparte, con la huella visual de staging.
//
// Los atributos data-* que JSX admite sin declararlos se pasan con una asercion
// de tipo, porque createElement los trata como propiedades desconocidas.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back() {}, forward() {}, push() {}, replace() {}, refresh() {}, prefetch() {} }),
  usePathname: () => "/dashboard/commercial/clients",
  useSearchParams: () => new URLSearchParams(),
}));

// Una etiqueta por linea: el diff de un snapshot senala el elemento que cambio.
function markup(node: ReactNode) {
  return renderToStaticMarkup(h(Fragment, null, node)).replace(/></g, ">\n<");
}

type Case = [name: string, node: ReactNode];

function characterize(cases: Case[]) {
  it.each(cases)("%s", (_name, node) => {
    expect(markup(node)).toMatchSnapshot();
  });
}

const buttonVariants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
  "clear",
] as const;

const buttonSizes = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const;

type ButtonSize = (typeof buttonSizes)[number];

// Los tamanos de solo icono exigen aria-label: el guardian se lo dice a los tipos.
function isIconSize(size: ButtonSize): size is Extract<ButtonSize, `icon${string}`> {
  return size.startsWith("icon");
}

describe("Button", () => {
  characterize([
    ...buttonVariants.map((variant): Case => [
      `variante ${variant} en cada tamano`,
      buttonSizes.map((size) =>
        isIconSize(size)
          ? h(Button, { key: size, variant, size, "aria-label": "Agregar" }, h(Plus))
          : h(Button, { key: size, variant, size }, "Guardar"),
      ),
    ]),
    ["deshabilitado", h(Button, { disabled: true }, "Guardar")],
    ["envio con clase propia", h(Button, { type: "submit", className: "w-full" }, "Filtrar")],
    [
      "con icono al inicio y al final",
      [
        h(Button, { key: "a" }, h(Plus, { "data-icon": "inline-start" } as LucideProps), "Nuevo"),
        h(Button, { key: "b", variant: "outline" }, "Siguiente", h(Plus, { "data-icon": "inline-end" } as LucideProps)),
      ],
    ],
    ["como enlace (asChild)", h(Button, { asChild: true }, h(Link, { href: "/dashboard/commercial/clients/new" }, "Nuevo cliente"))],
    ["limpiar filtros como enlace", h(Button, { variant: "clear", asChild: true }, h(Link, { href: "/dashboard/commercial/clients" }, "Limpiar filtros"))],
    ["pendiente con texto pendiente", h(Button, { type: "submit", pending: true, pendingText: "Guardando..." }, "Guardar")],
    ["pendiente sin texto pendiente", h(Button, { variant: "outline", pending: true }, "Exportar")],
    [
      "pendiente con icono propio y texto pendiente",
      h(Button, { variant: "destructive", pending: true, pendingText: "Anulando..." }, h(Plus, { "data-icon": "inline-start" } as LucideProps), "Anular"),
    ],
    [
      "pendiente de solo icono",
      (["icon-xs", "icon"] as const).map((size) =>
        h(Button, { key: size, size, variant: "ghost", pending: true, "aria-label": "Eliminar" }, h(Plus)),
      ),
    ],
    ["pendiente y deshabilitado", h(Button, { disabled: true, pending: true, pendingText: "Guardando..." }, "Guardar")],
    ["no pendiente", h(Button, { pending: false, pendingText: "Guardando..." }, "Guardar")],
  ]);
});

describe("Badge", () => {
  characterize([
    [
      "cada variante",
      (["default", "success", "warning", "info", "secondary", "destructive", "outline", "ghost", "link"] as const).map(
        (variant) => h(Badge, { key: variant, variant }, variant),
      ),
    ],
    ["con clase propia", h(Badge, { variant: "success", className: "text-[10.5px]" }, "Sistema activo")],
    ["como enlace (asChild)", h(Badge, { asChild: true }, h(Link, { href: "/dashboard" }, "Ver"))],
  ]);
});

describe("Alert", () => {
  characterize([
    ...(["default", "destructive", "success", "warning", "info"] as const).map((variant): Case => [
      `variante ${variant}`,
      h(
        Alert,
        { variant },
        h(variant === "destructive" ? TriangleAlert : Info),
        h(AlertTitle, null, "Titulo"),
        h(AlertDescription, null, "Descripcion con ", h("a", { href: "#detalle" }, "enlace"), "."),
      ),
    ]),
    [
      "con accion",
      h(Alert, null, h(AlertTitle, null, "Titulo"), h(AlertAction, null, h(Button, { size: "sm", variant: "outline" }, "Cerrar"))),
    ],
  ]);
});

describe("Campos", () => {
  characterize([
    ["etiqueta", h(Label, { htmlFor: "nombre" }, "Nombre")],
    ["input", h(Input, { id: "nombre", name: "nombre", placeholder: "Nombre o razon social" })],
    ["input deshabilitado", h(Input, { disabled: true, defaultValue: "CLI00000001" })],
    ["input invalido", h(Input, { "aria-invalid": true, defaultValue: "x" })],
    ["input de archivo", h(Input, { type: "file" })],
    [
      "select nativo",
      h(NativeSelect, { id: "estado", name: "estado", defaultValue: "" }, h("option", { value: "" }, "Todos"), h("option", { value: "activo" }, "Activo")),
    ],
    ["select nativo deshabilitado", h(NativeSelect, { disabled: true }, h("option", null, "Unico"))],
    ["textarea", h(Textarea, { placeholder: "Observaciones" })],
    ["textarea deshabilitado", h(Textarea, { disabled: true })],
    ["textarea invalido", h(Textarea, { "aria-invalid": true })],
    ["input de solo lectura", h(Input, { readOnly: true, defaultValue: "CLI00000001" })],
    ["textarea de solo lectura", h(Textarea, { readOnly: true, defaultValue: "Registrado por el sistema" })],
    ["select nativo invalido", h(NativeSelect, { "aria-invalid": true, defaultValue: "" }, h("option", { value: "" }, "Seleccione"))],
    ["interruptor encendido", h(Switch, { checked: true, "aria-label": "Activo" })],
    ["interruptor apagado", h(Switch, { checked: false, "aria-label": "Activo" })],
    ["interruptor deshabilitado", h(Switch, { disabled: true, "aria-label": "Activo" })],
    [
      "busqueda con lista",
      h(SearchableSelect, {
        name: "client",
        label: "Cliente",
        placeholder: "Buscar cliente",
        items: [
          { id: "CLI00000001", label: "Metalmecanica Lima", description: "CLI00000001 - Empresa" },
          { id: "CLI00000002", label: "Taller Arequipa" },
        ],
        emptyMessage: "No se encontraron clientes.",
      }),
    ],
    [
      "busqueda con valor y obligatoria",
      h(SearchableSelect, {
        name: "client",
        label: "Cliente",
        items: [{ id: "CLI00000001", label: "Metalmecanica Lima" }],
        value: "CLI00000001",
        required: true,
      }),
    ],
    ["busqueda deshabilitada", h(SearchableSelect, { name: "client", label: "Cliente", items: [], disabled: true })],
    [
      "filtro de busqueda",
      h(SearchableSelectFilter, { name: "client", label: "Cliente", items: [{ id: "CLI00000001", label: "Metalmecanica Lima" }], value: "CLI00000001" }),
    ],
  ]);
});

describe("Campo compartido", () => {
  characterize([
    ["error", h(FieldError, { messages: ["Ingrese un correo valido."] })],
    ["error con id", h(FieldError, { id: "correo-error", messages: ["Ingrese un correo valido."] })],
    ["error pequeno", h(FieldError, { messages: ["Requerido"], size: "sm" })],
    [
      "campo completo con error",
      h(Field, {
        id: "correo",
        label: "Correo",
        description: "Se usa para enviar la proforma.",
        errors: ["Ingrese un correo valido."],
        required: true,
        children: (control: FieldControlProps) => h(Input, { ...control, name: "correo", defaultValue: "ventas@" }),
      }),
    ],
    [
      "campo deshabilitado",
      h(Field, { id: "codigo", label: "Codigo", disabled: true, children: (control: FieldControlProps) => h(Input, { ...control, defaultValue: "CLI00000001" }) }),
    ],
    [
      "campo de solo lectura",
      h(Field, { id: "codigo", label: "Codigo", readOnly: true, children: (control: FieldControlProps) => h(Input, { ...control, defaultValue: "CLI00000001" }) }),
    ],
    [
      "lista con error",
      h(Field, {
        id: "tipo",
        label: "Tipo de cliente",
        errors: ["Seleccione un tipo."],
        required: true,
        children: (control: FieldControlProps) => h(NativeSelect, { ...control, name: "tipo", defaultValue: "" }, h("option", { value: "" }, "Seleccione")),
      }),
    ],
  ]);
});

describe("Presentacion", () => {
  characterize([
    [
      "tarjeta completa",
      h(
        Card,
        null,
        h(CardHeader, { className: "border-b" }, h(CardTitle, null, "Titulo"), h(CardDescription, null, "Descripcion"), h(CardAction, null, h(Button, { size: "sm" }, "Accion"))),
        h(CardContent, null, "Contenido"),
        h(CardFooter, null, "Pie"),
      ),
    ],
    ["tarjeta con barra termica", h(Card, { heatBar: true }, h(CardContent, null, "Contenido"))],
    ["tarjeta pequena", h(Card, { size: "sm" }, h(CardContent, null, "Contenido"))],
    ["separador horizontal", h(Separator)],
    ["separador vertical", h(Separator, { orientation: "vertical" })],
    ...(["success", "warning", "info"] as const).map((tone): Case => [
      `indicador ${tone}`,
      h(KpiCard, { title: "Pedidos", value: "12", description: "Pendientes de entrega", tone }),
    ]),
    ["indicador con enlace e icono", h(KpiCard, { title: "Stock bajo", value: "3", description: "Materiales", href: "/dashboard/inventory/alerts", tone: "warning", icon: Package })],
    ["tarjeta de modulo por defecto", h(ModuleAccessCard, { title: "Clientes", description: "Gestion de clientes", href: "/dashboard/commercial/clients" })],
    ["tarjeta de modulo con tono, indice e icono", h(ModuleAccessCard, { title: "Materiales", description: "Catalogo", href: "/dashboard/inventory/materials", icon: Package, tone: "chart-3", index: 3 })],
    [
      "etiqueta de estado comercial",
      ["pagada", "Pendiente", "anulado", "en_produccion", "sin proforma", "desconocido", null].map((status) =>
        h(StatusBadge, { key: String(status), status }),
      ),
    ],
    ["estado vacio", h(EmptyState, { label: "No se encontraron clientes con los filtros aplicados." })],
    ["estado vacio completo", h(EmptyState, { label: "Sin materiales", description: "Registra el primero.", icon: Package, action: h(Button, { size: "sm" }, "Nuevo material") })],
    ["estado de error", h(ErrorState, { title: "No se pudo cargar" })],
    [
      "estado de error completo",
      h(ErrorState, { title: "No se pudo cargar", description: "Intenta de nuevo.", detail: "Tiempo de espera agotado", actions: h(Button, null, "Reintentar") }),
    ],
  ]);
});

describe("Carga", () => {
  characterize([
    ["carga en bloque", h(LoadingState, { label: "Cargando materiales..." })],
    ["carga en linea", h(LoadingState, { variant: "inline", label: "Buscando clientes..." })],
    ["carga solo para el lector", h(LoadingState, { variant: "inline", className: "sr-only" })],
    ["esqueleto", h(Skeleton, { className: "h-4 w-32" })],
  ]);
});

describe("Listados compartidos", () => {
  characterize([
    [
      "barra de filtros",
      h(
        FilterBar,
        {
          action: "/dashboard/commercial/clients",
          label: "Filtros de clientes",
          clearHref: "/dashboard/commercial/clients",
          children: h(
            Fragment,
            null,
            h(Field, { id: "q", label: "Busqueda general", children: (control: FieldControlProps) => h(Input, { ...control, name: "q" }) }),
            h(DateRangeFields, { id: "rango" }),
          ),
        },
      ),
    ],
    ["rango en orden", h(DateRangeFields, { id: "rango", defaultFrom: "2026-10-01", defaultTo: "2026-10-13" })],
    ["rango invertido", h(DateRangeFields, { id: "rango", defaultFrom: "2026-10-13", defaultTo: "2026-10-01" })],
    ["rango con los nombres de los reportes", h(DateRangeFields, { id: "rango", fromName: "dateFrom", toName: "dateTo" })],
    ["tabla cargando", h(Table, null, h(TableBody, null, h(TableLoadingRows, { columns: 3, rows: 2, label: "Cargando clientes..." })))],
  ]);
});

describe("Navegacion y listados", () => {
  characterize([
    ["migas de pan", h(Breadcrumbs, { items: [{ label: "Inicio", href: "/dashboard" }, { label: "Comercial", href: "/dashboard/commercial" }, { label: "Clientes" }] })],
    ["boton volver", h(BackButton, { fallbackHref: "/dashboard/commercial/clients" })],
    ["cabecera minima", h(PageHeader, { title: "Clientes" })],
    [
      "cabecera completa",
      h(PageHeader, {
        title: "Clientes",
        description: "Lista de clientes registrados en el sistema.",
        breadcrumbs: [{ label: "Inicio", href: "/dashboard" }, { label: "Clientes" }],
        backHref: "/dashboard/commercial",
        actions: h(Button, null, "Nuevo cliente"),
      }),
    ],
    [
      "tabla completa",
      h(
        Table,
        null,
        h(TableCaption, null, "Leyenda"),
        h(TableHeader, null, h(TableRow, null, h(TableHead, null, "Codigo"), h(TableHead, null, "Cliente"))),
        h(
          TableBody,
          null,
          h(TableRow, null, h(TableCell, null, "CLI00000001"), h(TableCell, { className: "font-medium" }, "Metalmecanica Lima")),
          h(TableRow, { "data-state": "selected" } as ComponentProps<typeof TableRow>, h(TableCell, null, "CLI00000002"), h(TableCell, null, "Taller Arequipa")),
        ),
        h(TableFooter, null, h(TableRow, null, h(TableCell, { colSpan: 2 }, "Total: 2"))),
      ),
    ],
    [
      "acciones por fila",
      h(
        RowActions,
        null,
        h(RowEditLink, { href: "/dashboard/commercial/clients/CLI00000001/edit" }),
        h(RowToggleStatusButton, { action: async () => {}, hiddenFieldName: "id_cliente", hiddenFieldValue: "CLI00000001", isActive: true }),
        h(RowToggleStatusButton, { action: async () => {}, hiddenFieldName: "id_cliente", hiddenFieldValue: "CLI00000002", isActive: false }),
      ),
    ],
    // Entrega 10: con sendsRequestedStatus envia tambien el estado pedido.
    [
      "acciones de fila con el estado pedido",
      h(
        RowActions,
        null,
        h(RowToggleStatusButton, { action: async () => {}, hiddenFieldName: "id_categoria_gasto", hiddenFieldValue: "CGA00000001", isActive: true, sendsRequestedStatus: true }),
        h(RowToggleStatusButton, { action: async () => {}, hiddenFieldName: "id_categoria_gasto", hiddenFieldValue: "CGA00000002", isActive: false, sendsRequestedStatus: true }),
      ),
    ],
    ...([1, 2, 3] as const).map((page): Case => [
      `paginacion en la pagina ${page} de 3`,
      h(PaginationControls, {
        meta: getPaginationMeta({ totalItems: 45, page, pageSize: 20 }),
        basePath: "/dashboard/commercial/clients",
        searchParams: { q: "lima", page: String(page) },
        itemLabel: "clientes",
      }),
    ]),
    ["paginacion vacia", h(PaginationControls, { meta: getPaginationMeta({ totalItems: 0, page: 1, pageSize: 20 }), basePath: "/dashboard/commercial/clients", searchParams: {} })],
  ]);
});
