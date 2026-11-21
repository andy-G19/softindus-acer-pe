import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RowActions, RowEditLink } from "@/components/table/row-actions";
import { Button } from "@/components/ui/button";
import type { NotificationDefinition } from "@/lib/notification-catalog";
import { ClientStatusButton } from "@/modules/commercial/clients/client-status-button";
import { ProductStatusButton } from "@/modules/commercial/products/product-status-button";
import { MaterialStatusButton } from "@/modules/inventory/materials/material-status-button";
import { SupplierStatusButton } from "@/modules/inventory/suppliers/supplier-status-button";
import { RecipeDetailDeleteButton } from "@/modules/production/recipe-details/recipe-detail-delete-button";

// Diseno de listados y navegacion (propuesta del responsable, 2026-11-21; D166). Las acciones de
// una fila son enlaces de texto claro que al pasar el puntero toman el cobre con subrayado (la
// variante row-link de Button), alineados a la derecha; la accion destructiva es un boton xs, y
// activar, que no destruye nada, es un enlace. La confirmacion sigue siendo la ventana (D167).

function classesOf(html: string, slot: string) {
  return (html.match(new RegExp(`<[a-z]+ data-slot="${slot}"[^>]* class="([^"]*)"`))?.[1] ?? "")
    .replaceAll("&amp;", "&")
    .split(" ");
}

function buttonOf(element: ReactElement) {
  const html = renderToStaticMarkup(element);
  const tag = html.match(/<button[^>]*>/)?.[0] ?? "";

  return {
    variant: tag.match(/data-variant="([^"]*)"/)?.[1],
    size: tag.match(/data-size="([^"]*)"/)?.[1],
  };
}

const notification: NotificationDefinition = { type: "success", message: "Listo." };
const action = async () => ({ status: "idle" }) as never;

describe("variante row-link de Button", () => {
  // El tamano no la cambia: va en compoundVariants, que se aplica despues del tamano.
  for (const size of ["sm", "xs", "default"] as const) {
    it(`texto claro de 13 px, subrayado transparente y 24 px de alto (tamano ${size})`, () => {
      const html = renderToStaticMarkup(h(Button, { variant: "row-link", size, type: "button" }, "Editar"));
      const button = classesOf(html, "button");

      expect(button).toEqual(
        expect.arrayContaining([
          "h-6",
          "px-0",
          "text-[13px]",
          "font-medium",
          "text-foreground",
          "underline",
          "decoration-transparent",
          "underline-offset-2",
        ]),
      );
      expect(button).not.toContain("h-7");
      expect(button).not.toContain("px-2.5");
      expect(button).not.toContain("text-[0.8rem]");
    });
  }

  it("al pasar el puntero toma el cobre con subrayado y no se mueve", () => {
    const html = renderToStaticMarkup(h(Button, { variant: "row-link", type: "button" }, "Editar"));
    const button = classesOf(html, "button");

    expect(button).toEqual(
      expect.arrayContaining([
        "hover:text-primary-hover",
        "hover:decoration-current",
        "hover:translate-y-0",
        "active:not-aria-[haspopup]:translate-y-0",
        "active:not-aria-[haspopup]:scale-100",
      ]),
    );
  });
});

describe("acciones de fila", () => {
  it("Editar es un enlace row-link", () => {
    const html = renderToStaticMarkup(h(RowEditLink, { href: "/dashboard/commercial/clients/CLI00000001/edit" }));

    expect(html).toMatch(/^<a [^>]*data-variant="row-link"/);
    expect(html).toContain('href="/dashboard/commercial/clients/CLI00000001/edit"');
  });

  it("alineadas a la derecha, con 8 px entre ellas", () => {
    const html = renderToStaticMarkup(h(RowActions, null, "Editar"));

    expect(classesOf(html, "row-actions")).toEqual(
      expect.arrayContaining(["flex", "items-center", "justify-end", "gap-2"]),
    );
  });
});

describe("botones de estado en las filas", () => {
  const cases = [
    {
      name: "cliente",
      render: (estado: boolean) =>
        h(ClientStatusButton, {
          client: { id_cliente: "CLI00000001", nombre_razon_social: "Taller Arequipa", estado },
          action,
          activatedNotification: notification,
          deactivatedNotification: notification,
        }),
    },
    {
      name: "producto",
      render: (estado: boolean) =>
        h(ProductStatusButton, {
          product: { id_producto: "PRO00000001", nombre_producto: "Escalera", estado },
          action,
          activatedNotification: notification,
          deactivatedNotification: notification,
        }),
    },
    {
      name: "material",
      render: (estado: boolean) =>
        h(MaterialStatusButton, {
          material: { id_material: "MAT00000001", nombre_material: "Plancha", estado },
          action,
          activatedNotification: notification,
          deactivatedNotification: notification,
        }),
    },
    {
      name: "proveedor",
      render: (estado: boolean) =>
        h(SupplierStatusButton, {
          supplier: { id_proveedor: "PRV00000001", razon_social: "Aceros SAC", estado },
          action,
          activatedNotification: notification,
          deactivatedNotification: notification,
        }),
    },
  ];

  for (const { name, render } of cases) {
    it(`${name}: Inactivar es un boton destructivo xs`, () => {
      expect(buttonOf(render(true))).toEqual({ variant: "destructive", size: "xs" });
    });

    it(`${name}: Activar es un enlace row-link`, () => {
      expect(buttonOf(render(false)).variant).toBe("row-link");
    });
  }

  it("linea de receta: Eliminar es un boton destructivo xs", () => {
    expect(
      buttonOf(
        h(RecipeDetailDeleteButton, {
          detail: { id_detalle_receta: "DRC00000001", material: { nombre_material: "Plancha" } },
          action,
          deletedNotification: notification,
        }),
      ),
    ).toEqual({ variant: "destructive", size: "xs" });
  });
});
